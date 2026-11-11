import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, PLATFORMS } from './l3ip.js';

test('SAOS10 defaults emit an interface config and verification commands', () => {
  const out = generate();
  assert.deepEqual(out.errors, []);
  assert.ok(out.config.some(line => line.includes('oc-if:interfaces interface int_ip1')));
  assert.ok(out.config.some(line => line.includes('fps fp fp8_ip1')));
  assert.ok(out.show.includes('show ip interface brief'));
  assert.ok(out.show.includes('show flow-points flow-point fp8_ip1'));
});

test('SAOS10 Management role is explicit and Data preserves the default', () => {
  for (const platform of PLATFORMS.slice(0, 2)) {
    for (const networkType of ['broadcast', 'point-to-point']) {
      const out = generate({ platform, networkType, role: 'Management', name: 'DummyIP1', mtu: '1500' });
      assert.deepEqual(out.errors, []);
      assert.ok(out.config.includes(`oc-if:interfaces interface int_DummyIP1 config name int_DummyIP1 admin-status true role management${networkType === 'point-to-point' ? ' type point-to-point' : ''} underlay-binding config fd fd_DummyIP1`));
    }
  }
  assert.ok(!generate().config.some(line => line.includes('role management')));
  assert.ok(generate({ role: 'invalid' }).errors.length);
  for (const platform of PLATFORMS.slice(2)) {
    const out = generate({ platform, role: 'Management' });
    assert.ok(out.errors.some(error => error.includes('only for SAOS10')));
    assert.deepEqual(out.config, []);
  }
});

test('IP configs have no comment placeholders on any platform', () => {
  for (const platform of PLATFORMS) {
    for (const vlan of ['0', '1000']) {
      assert.ok(generate({ platform, vlan }).config.every(line => !line.startsWith('#')));
    }
  }
});

test('SAOS6 and SAOS8 produce their platform-specific interface setup', () => {
  const saos6 = generate({ platform: 'SAOS6' });
  assert.deepEqual(saos6.errors, []);
  assert.ok(saos6.config[0].startsWith('vlan create vlan'));
  assert.ok(saos6.config.some(line => line.includes('interface create ip-interface ip1')));
  assert.ok(saos6.show.includes('ip fib show'));
  const saos8 = generate({ platform: PLATFORMS[2] });
  assert.deepEqual(saos8.errors, []);
  assert.ok(saos8.config.some(line => line.includes('cpu-interface sub-interface create')));
  assert.ok(saos8.config.some(line => line.includes('sub-port add sub-port')));
  assert.ok(saos8.show.includes('ip fib show'));
  assert.ok(!saos8.config.some(line => line.startsWith('show ')));
});

test('QinQ only generates on supported SAOS10 variants', () => {
  const out = generate({ qinq: true, innerVlan: '200' });
  assert.deepEqual(out.errors, []);
  assert.ok(out.config.some(line => line.includes('vtags 2 vlan-id 200')));
  assert.ok(out.config.some(line => line.includes('initiate-l2-transform vlan-stack 1')));
  assert.ok(generate({ qinq: true, platform: PLATFORMS[0] }).errors.length > 0);
  assert.ok(generate({ qinq: true, vlan: '0' }).errors.length > 0);
});

test('invalid CLI tokens and numeric fields block generated configuration', () => {
  const out = generate({ name: 'ip1\nno fds fd', address: '999.1.1.1', vlan: '4095' });
  assert.ok(out.errors.length >= 3);
  assert.deepEqual(out.config, []);
  assert.ok(generate({ platform: null }).errors.length > 0);
});

test('SAOS10 generated interface names respect the 15-character device limit', () => {
  const valid = generate({ platform: PLATFORMS[0], name: '12345678901' });
  assert.deepEqual(valid.errors, []);
  assert.ok(valid.config.some(line => line.includes('interface int_12345678901')));

  const invalid = generate({ platform: PLATFORMS[0], name: '123456789012' });
  assert.ok(invalid.errors.some(error => error.includes('11 characters or fewer')));
  assert.deepEqual(invalid.config, []);
});

test('VLAN zero uses the untagged classifier on SAOS10', () => {
  const out = generate({ vlan: '0' });
  assert.ok(out.config.some(line => line.includes('CLASSIFIER_4096') && line.includes('untagged-exclude-priority-tagged')));
  assert.ok(out.config.every(line => !line.includes('vlan-id 0')));
});

test('SAOS10 subnet validation rejects broadcast /31 and network/broadcast hosts', () => {
  for (const platform of PLATFORMS.slice(0, 2)) {
    const invalid = [
      { prefix: '31', networkType: 'broadcast' },
      { address: '192.0.2.0', prefix: '24' },
      { address: '192.0.2.255', prefix: '24' },
    ];
    for (const input of invalid) {
      const out = generate({ platform, ...input });
      assert.ok(out.errors.length, JSON.stringify(input));
      assert.deepEqual(out.config, []);
    }
    for (const address of ['192.0.2.0', '192.0.2.1']) {
      const out = generate({ platform, address, prefix: '31', networkType: 'point-to-point' });
      assert.deepEqual(out.errors, []);
      assert.ok(out.config.some(line => line.includes('type point-to-point')));
    }
    assert.deepEqual(generate({ platform, address: '192.0.2.1', prefix: '24', networkType: 'broadcast' }).errors, []);
  }
});

test('broad-prefix warnings are scoped without imposing platform-specific limits', () => {
  for (const prefix of ['0', '1', '2']) {
    const out = generate({ address: '65.0.0.1', prefix });
    assert.deepEqual(out.errors, []);
    assert.ok(out.warnings.some(warning => warning.includes('Broad IPv4 prefixes')));
    assert.ok(out.config.some(line => line.endsWith(`prefix-length ${prefix}`)));
  }
  assert.deepEqual(generate({ address: '65.0.0.1', prefix: '3' }).warnings, []);
  for (const platform of [PLATFORMS[0], ...PLATFORMS.slice(2)])
    assert.deepEqual(generate({ platform, address: '65.0.0.1', prefix: '1' }).warnings, []);
});

test('/32 generates only a loopback with matching verification and removal on every platform', () => {
  for (const platform of PLATFORMS) {
    const out = generate({ platform, prefix: '32', name: 'lb0', address: '192.0.2.1',
      port: '', vlan: '', mtu: '', priority: '', networkType: 'broadcast', qinq: true, innerVlan: '' });
    assert.deepEqual(out.errors, []);
    assert.deepEqual(out.config, platform.startsWith('SAOS10') ? [
      'config',
      'oc-if:interfaces interface lb0 config name lb0 cn-if:type loopback',
      'oc-if:interfaces interface lb0 ipv4 addresses address 192.0.2.1 config ip 192.0.2.1 prefix-length 32',
    ] : ['interface create loopback lb0 ip 192.0.2.1']);
    assert.ok(out.show.some(line => line.includes('lb0')));
    assert.deepEqual(out.remove, platform.startsWith('SAOS10')
      ? ['config', 'no oc-if:interfaces interface lb0', 'exit'] : ['interface delete ip-interface lb0']);
    assert.ok(![...out.config, ...out.show, ...out.remove].some(line => /fd_lb0|fp8_lb0|CLASSIFIER_|vlan|sub-port|cpu-interface/.test(line)));
  }
  assert.ok(generate({ prefix: '32', role: 'Management' }).config.some(line => line.includes('role cn-if:management')));
  assert.deepEqual(generate({ prefix: '32', name: '123456789012345' }).errors, []);
  assert.ok(generate({ prefix: '32', name: '1234567890123456' }).errors.length);
  for (const input of [{ address: 'invalid' }, { name: 'bad\nname' }, { role: 'invalid' }]) {
    assert.deepEqual(generate({ prefix: '32', ...input }).config, []);
  }
});

test('SAOS10 explicitly emits requested sub-1500 MTU instead of silently using 1500', () => {
  for (const mtu of ['576', '1499']) {
    const out = generate({ mtu });
    assert.deepEqual(out.errors, []);
    assert.ok(out.config.some(line => line.includes(` mtu ${mtu} `)));
  }
  assert.ok(generate({ mtu: '1500' }).config.every(line => !line.includes(' mtu ')));
});
