import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, defaults, emixPattern } from './sat.js';

const sampleNames = { generatorFlowPoint: '6_evpl-ImOn-v1337_1', reflectorFlowPoint: '6_evpl-ImOn-v1337_1' };

test('SAOS10 generator and reflector emit the expected baseline command structure', () => {
  const out = generate(sampleNames);
  assert.deepEqual(out.errors, []);
  assert.ok(out.generatorConfig.some(line => line.startsWith('sat test-profile prof_evpl-ImOn-v1337')));
  assert.ok(out.generatorConfig.some(line => line.includes('flow-point-id 6_evpl-ImOn-v1337_1')));
  assert.ok(out.reflectorConfig.some(line => line.includes('role reflector')));
  assert.ok(out.generatorRemove.some(line => line.includes('no sat test-profile')));
  assert.ok(!out.reflectorConfig.some(line => line.includes('#REF!')));
  assert.deepEqual(defaults().testTypes, ['throughput', 'latency', 'pdv', 'frameloss']);
});

test('SAOS8 legacy generator emits a sub-port attachment', () => {
  const out = generate({ ...sampleNames, generatorPlatform: 'SAOS8' });
  assert.deepEqual(out.errors, []);
  assert.ok(out.generatorConfig.some(line => line.includes('sub-port 6_evpl-ImOn-v1337_1')));
});

test('SAOS6 and SAOS8 have distinct legacy commands and removals', () => {
  const saos6 = generate({ ...sampleNames, generatorPlatform: 'SAOS6', reflectorPlatform: 'SAOS6' });
  assert.deepEqual(saos6.errors, []);
  assert.ok(saos6.generatorConfig.includes('benchmark profile enable name prof-evpl-ImOn-v1337'));
  assert.ok(saos6.generatorConfig.includes('benchmark enable'));
  assert.ok(saos6.reflectorConfig.includes('benchmark test create name TestRef-evpl-ImOn-v1337-1337 vtag-stack 1337'));
  assert.ok(saos6.generatorRemove.some(line => line.includes('CLI_no_loss_saos6')));
  const saos8 = generate({ ...sampleNames, generatorPlatform: 'SAOS8', reflectorPlatform: 'SAOS8' });
  assert.deepEqual(saos8.errors, []);
  assert.ok(saos8.generatorConfig.some(line => line.endsWith('sub-port 6_evpl-ImOn-v1337_1')));
  assert.ok(saos8.reflectorConfig.some(line => line.includes('sub-port 6_evpl-ImOn-v1337_1')));
});

test('untagged and third-party settings adapt config for each platform', () => {
  const out = generate({ ...defaults(), vlan: '0', thirdParty: true, generatorPlatform: 'SAOS10', reflectorPlatform: 'SAOS10' });
  assert.ok(out.generatorConfig.some(line => line.includes('untagged true')));
  assert.ok(!out.generatorConfig.some(line => line.includes('c-vid 0')));
  assert.ok(out.reflectorConfig.some(line => line.includes('assoc-gen-vendor-type other reflector-mac-validation false')));
  const old = generate({ vlan: '0', generatorPlatform: 'SAOS6', reflectorPlatform: 'SAOS6' });
  assert.ok(old.reflectorConfig.some(line => line.includes('vlan-untagged-data')));
});

test('endpoint examples are obvious placeholders and legacy generators omit result-calculation warnings', () => {
  const out = generate();
  assert.ok(out.generatorConfig.some(line => line.includes('flow-point-id XXXX')));
  assert.ok(out.reflectorConfig.some(line => line.includes('flow-point-id YYYY')));
  for (const generatorPlatform of ['SAOS6', 'SAOS8']) {
    const legacy = generate({ generatorPlatform });
    assert.ok(!legacy.warnings.some(warning => warning.includes('Result calculation')));
    assert.ok(!legacy.generatorConfig.some(line => line.includes('bw-calculation-mode')));
  }
});

test('run and verify commands omit SSH shortcuts without removing payload IPs', () => {
  for (const generatorPlatform of ['SAOS10', 'SAOS8', 'SAOS6']) {
    const out = generate({ generatorPlatform, generatorIp: '192.0.2.1', reflectorIp: '192.0.2.2' });
    assert.ok([...out.generatorOps, ...out.reflectorOps].every(line => !line.startsWith('ssh ')));
    assert.ok(out.generatorConfig.some(line => line.includes('192.0.2.1')));
    assert.ok(out.generatorConfig.some(line => line.includes('192.0.2.2')));
  }
});

test('impact and unsupported combinations are surfaced before use', () => {
  const out = generate({ mode: 'in-service', thirdParty: true });
  assert.ok(out.warnings.some(w => w.includes('third-party generator')));
  const impact = generate({ mode: 'evc-out-of-service' });
  assert.ok(impact.warnings.some(w => w.includes('affects the service/port')));
  assert.ok(generate({ mode: 'evc-out-of-service', generatorPlatform: 'SAOS8' }).generatorConfig.some(line => line.includes('mode evc-out-of-service')));
  assert.ok(generate({ mode: 'evc-out-of-service', generatorPlatform: 'SAOS6' }).generatorConfig.some(line => line.includes('mode vid-out-of-service')));
  const bad = generate({ name: 'SAT; no config', reflectorMac: 'not-a-mac', frameSizes: '64,99999' });
  assert.ok(bad.errors.length >= 3);
  assert.deepEqual(bad.generatorConfig, []);
  assert.ok(generate({ frameSizes: '64,\nconfig save' }).errors.length > 0);
});

test('RFC2544 and Y.1564 suites emit their suite flags and profile parameters', () => {
  const rfc = generate({ ...sampleNames, name: 'sat-rfc', benchmarkType: 'rfc2544' });
  assert.deepEqual(rfc.errors, []);
  const rfcProfile = rfc.generatorConfig.find(line => line.startsWith('sat test-profile '));
  assert.match(rfcProfile, /rfc2544-suite true/);
  assert.match(rfcProfile, /max-searches 7/);
  assert.doesNotMatch(rfcProfile, /y1564-suite|outage-test|frame-size /);

  const y1564 = generate({ ...sampleNames, name: 'sat-y1564', benchmarkType: 'y1564' });
  assert.deepEqual(y1564.errors, []);
  const y1564Profile = y1564.generatorConfig.find(line => line.startsWith('sat test-profile '));
  assert.match(y1564Profile, /y1564-suite true/);
  assert.match(y1564Profile, /emix-sequence y1564/);
  assert.match(y1564Profile, /max-searches 16/);
  assert.doesNotMatch(y1564Profile, /rfc2544-suite|outage-test|throughput-test|frame-size /);
  assert.match(y1564Profile, /custom-payload Q2llbmEgU0FUIHBheWxvYWQ=/);
});

test('custom Y.1564 EMIX is created before use and removed after the profile', () => {
  const out = generate({ name: 'test-mix', benchmarkType: 'y1564', emixSequence: 'Custom',
    customFrameMix: 'aaubg', customEmixSize: '9000' });
  assert.deepEqual(out.errors, []);
  const create = 'sat emix-sequence emix_test-mix sequence aaubg u-frame-size 9000';
  assert.ok(out.generatorConfig.includes(create));
  assert.ok(out.generatorConfig.findIndex(line => line === create) <
    out.generatorConfig.findIndex(line => line.startsWith('sat test-profile ')));
  assert.match(out.generatorConfig.find(line => line.startsWith('sat test-profile ')), /emix-sequence emix_test-mix/);
  assert.ok(out.generatorRemove.indexOf('no sat test-profile prof_test-mix') <
    out.generatorRemove.indexOf('no sat emix-sequence emix_test-mix'));
  assert.equal(emixPattern('y1564'), 'abceg');
  assert.equal(emixPattern('ipv6-qinq'), 'xxxxxxduuuugg');
  assert.equal(emixPattern('ipv6'), 'vvvvvvduuuugg');
});

test('custom EMIX rejects unsafe patterns and invalid custom frame sizes', () => {
  const custom = { benchmarkType: 'y1564', emixSequence: 'Custom' };
  for (const customFrameMix of ['', 'abc;config', 'A', 'a'.repeat(33)]) {
    assert.ok(generate({ ...custom, customFrameMix }).errors.some(error => error.includes('Frame Size Mix')));
  }
  for (const customEmixSize of ['63', '9217', '700,800']) {
    assert.ok(generate({ ...custom, customFrameMix: 'au', customEmixSize }).errors.some(error => error.includes('Custom u')));
  }
  assert.ok(generate({ ...custom, encapType: 'qinq', customFrameMix: 'au', customEmixSize: '64' }).errors.length >= 2);
  assert.ok(generate({ ...custom, customFrameMix: 'a'.repeat(17) }).warnings.some(w => w.includes('longer than 16')));
  assert.ok(generate({ ...custom, customFrameMix: 'abcdefghu' }).warnings.some(w => w.includes('eight distinct')));
});

test('custom EMIX h size is optional, validated and limited to mixes using h', () => {
  const custom = { benchmarkType: 'y1564', emixSequence: 'Custom', customFrameMix: 'auhg', customEmixSize: '9000' };
  const entity = out => out.generatorConfig.find(line => line.startsWith('sat entity '));
  assert.doesNotMatch(entity(generate(custom)), /generator-h-frame-size/);
  const configured = generate({ ...custom, generatorHFrameSize: '9200' });
  assert.deepEqual(configured.errors, []);
  assert.match(entity(configured), /generator-h-frame-size 9200/);
  assert.ok(generate({ ...custom, generatorHFrameSize: '1500' }).warnings.some(w => w.includes('exceeds h')));
  for (const generatorHFrameSize of ['63', '9801', 'a', '1;config']) {
    assert.ok(generate({ ...custom, generatorHFrameSize }).errors.some(e => e.includes('Generator h frame size')));
  }
  assert.doesNotMatch(entity(generate({ ...custom, customFrameMix: 'aug', generatorHFrameSize: '9200' })), /generator-h-frame-size/);
  assert.doesNotMatch(entity(generate({ ...custom, emixSequence: 'y1564', generatorHFrameSize: '9200' })), /generator-h-frame-size/);
});

test('extended SAT settings preserve standard searches and custom duration without bounding Outage', () => {
  const standard = generate({ duration: 'Custom', customDuration: '30', maxSearches: '3' });
  assert.deepEqual(standard.errors, []);
  const profile = standard.generatorConfig.find(line => line.startsWith('sat test-profile '));
  assert.match(profile, /duration tCustom/);
  assert.match(profile, /custom-duration 30/);
  assert.match(profile, /max-searches 3/);
  const outage = generate({ benchmarkType: 'outage', duration: 'Custom', customDuration: '30' });
  assert.deepEqual(outage.errors, []);
  const outageProfile = outage.generatorConfig.find(line => line.startsWith('sat test-profile '));
  assert.match(outageProfile, /duration tIndefinite/);
  assert.doesNotMatch(outageProfile, /custom-duration/);
});

test('SAOS10 reflector derives the VLAN stack from its flow-point classifier', () => {
  const cases = [
    { benchmarkType: 'standard', vlan: '1337', encapType: 'dot1Q' },
    { benchmarkType: 'standard', vlan: '0', encapType: 'untagged' },
    { benchmarkType: 'standard', vlan: '1337', sVlan: '101', encapType: 'qinq' },
    { benchmarkType: 'rfc2544', vlan: '1337', encapType: 'dot1Q' },
    { benchmarkType: 'y1564', vlan: '1337', encapType: 'dot1Q' },
    { benchmarkType: 'outage', vlan: '1337', encapType: 'dot1Q' },
  ];
  for (const [index, options] of cases.entries()) {
    const name = `sat-reflector-${index}`;
    const out = generate({ ...sampleNames, ...options, name, reflectorFlowPoint: 'satfp' });
    const instance = out.reflectorConfig.find(line => line.startsWith('sat test-instance '));
    assert.equal(instance, `sat test-instance ${name} flow-point-id satfp admin-state enabled`);
  }
});

test('Outage is indefinite, low-rate by default, and explicitly manually stopped', () => {
  const out = generate({ ...sampleNames, name: 'sat-outage', benchmarkType: 'outage' });
  assert.deepEqual(out.errors, []);
  const profile = out.generatorConfig.find(line => line.startsWith('sat test-profile '));
  assert.match(profile, /bandwidth 1 /);
  assert.match(profile, /duration tIndefinite/);
  assert.match(profile, /outage-test true/);
  assert.match(profile, /frame-size 64/);
  assert.doesNotMatch(profile, /rfc2544-suite|y1564-suite|throughput-test|latency-test|pdv-test|frameloss-test/);
  assert.ok(out.warnings.some(warning => warning.includes('runs indefinitely')));
  assert.ok(out.warnings.some(warning => warning.includes('supported only on 3922, 3924, 3926')));
  assert.ok(out.warnings.every(warning => !warning.includes('two-node 3926 test') && !warning.includes('CN3984')));
  assert.ok(out.generatorOps.some(command => command.startsWith('sat stop ')));
});

test('Outage accepts one independent frame size and rejects malformed or out-of-range values', () => {
  const out = generate({ benchmarkType: 'outage', outageFrameSize: '512', frameSizes: '64,128,9000' });
  assert.deepEqual(out.errors, []);
  assert.match(out.generatorConfig.find(line => line.startsWith('sat test-profile ')), /frame-size 512$/);
  for (const outageFrameSize of ['', '63', '16001', '64,128', '64\nconfig save', '64.5']) {
    const invalid = generate({ benchmarkType: 'outage', outageFrameSize });
    assert.ok(invalid.errors.some(error => error.includes('one outage frame size')));
    assert.deepEqual(invalid.generatorConfig, []);
  }
  assert.deepEqual(generate({ benchmarkType: 'standard', outageFrameSize: '' }).errors, []);
});

test('only Outage places its statistics comment and command after manual stop', () => {
  for (const benchmarkType of ['standard', 'rfc2544', 'y1564', 'outage']) {
    for (const testConnectivity of [false, true]) {
      const out = generate({ benchmarkType, testConnectivity });
      assert.deepEqual(out.errors, []);
      assert.equal(out.generatorOps[0], `sat ping test-instances test-instance ${out.input.name}`,
        'Connectivity must remain enabled even when legacy settings disabled it');
      const stop = out.generatorOps.findIndex(command => command.startsWith('sat stop '));
      const statistics = out.generatorOps.indexOf(`show sat test-instances test-instance ${out.input.name} statistics`);
      const comment = '# Statistics are only shown after the test has stopped.';
      if (benchmarkType === 'outage') {
        assert.equal(out.generatorOps[stop + 1], comment);
        assert.equal(statistics, stop + 2);
      } else {
        assert.ok(statistics < stop);
        assert.ok(!out.generatorOps.includes(comment));
      }
    }
  }
});

test('special suites reject SAOS6/8 generators, invalid Y.1564 inputs, and multi-PCP RFC2544', () => {
  for (const generatorPlatform of ['SAOS6', 'SAOS8']) {
    const out = generate({ benchmarkType: 'rfc2544', generatorPlatform });
    assert.ok(out.errors.some(error => /require an SAOS10 generator/.test(error)));
    assert.deepEqual(out.generatorConfig, []);
  }
  assert.ok(generate({ benchmarkType: 'y1564', emixSequence: '' }).errors.some(error => /requires a valid configured Ethernet mix/.test(error)));
  assert.ok(generate({ benchmarkType: 'rfc2544', priorityCodePoints: ['pcp2', 'pcp4'] }).errors.some(error => /one priority code point/.test(error)));
  assert.ok(generate({ benchmarkType: 'y1564', encapType: 'qinq', vlan: '1337', sVlan: '101' }).generatorConfig
    .some(line => /encap-type qinq.*s-vid 101.*c-vid 1337/.test(line)));
});
