import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, configText, DEVICE_392X, DEVICE_OTHER } from './l2evc.js';

const byId = (out, id) => out.config.find(l => l.id === id)?.text ?? out.cfm.config.find(l => l.id === id)?.text;

test('legacy compatibility flag is ignored', () => {
  const normal = generate();
  const legacy = generate({ compat: true });
  assert.deepEqual(legacy, normal);
  assert.ok(!('compat' in legacy.input));
});

test('default (non-392x UNI/UNI ELAN) config', () => {
  const out = generate();
  assert.equal(byId(out, 'C19'), 'fds fd test1 description test1 mode vpls');
  assert.equal(byId(out, 'C20'), 'fps fp fp1_test1 fd-name test1 logical-port 1 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_101');
  assert.equal(byId(out, 'C24'), 'fps fp fp2_test1 fd-name test1 logical-port 2 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_101');
  assert.match(byId(out, 'C21'), /^# left blank/);
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  const txt = configText(out);
  assert.ok(txt.startsWith('config\n') && txt.endsWith('\nexit'));
  assert.ok(!txt.includes('# left blank'));
  assert.deepEqual(generate({ cfm: { enabled: false } }).cfm, out.cfm);
});

test('VLAN sets merge adjacent and overlapping IDs and reuse classifiers on both UNI endpoints', () => {
  const out = generate({
    left: { vlan: '355, 352,350-351,351' }, right: { vlan: '350-352,355' },
  });
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  const classifiers = out.config.filter(({ text }) => text.startsWith('classifiers classifier'));
  assert.deepEqual(classifiers.map(({ text }) => text), [
    'classifiers classifier CLASSIFIER_350-352 filter-entry classifier:vtag-stack vtags 1 vlan-id 350 vlan-id-max 352',
    'classifiers classifier CLASSIFIER_355 filter-entry classifier:vtag-stack vtags 1 vlan-id 355',
  ]);
  for (const id of ['C20', 'C24']) assert.match(byId(out, id), /classifier-list CLASSIFIER_350-352 CLASSIFIER_355$/);
  assert.deepEqual(out.nuke.filter(text => text.startsWith('no classifiers')), [
    'no classifiers classifier CLASSIFIER_350-352', 'no classifiers classifier CLASSIFIER_355',
  ]);
  assert.equal(out.diagram.K12, '350-352, 355');
  assert.equal(out.diagram.G12, 'c350');
  assert.match(byId(out, 'C113'), /vlanid 350$/);
  const explicit = generate({ left: { vlan: '350-352,355' }, right: { vlan: '350-352,355' }, cfm: { tagVlan: '352' } });
  assert.match(byId(explicit, 'C113'), /vlanid 352$/);
  assert.ok(!explicit.soam.notes.includes('classifier-miss'));
});

test('gapped VLANs get separate classifiers and cannot hide a UNI mismatch or fixed egress rewrite', () => {
  const out = generate({ left: { vlan: '350, 352' }, right: { role: 'ENNI', vlan: '900' }, cfm: { enabled: false } });
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  assert.match(byId(out, 'C20'), /classifier-list CLASSIFIER_350 CLASSIFIER_352$/);
  assert.match(byId(out, 'C26'), /push-vid 900$/);
  assert.ok(generate({ left: { vlan: '350,352' }, right: { vlan: '350-352' } }).warnings
    .some(w => w.level === 'error' && w.field === 'right.vlan' && w.msg.includes('must match')));
  const invalidEgress = generate({ right: { role: 'ENNI', vlan: '350-352' } });
  assert.ok(invalidEgress.warnings.some(w => w.level === 'error' && w.field === 'right.vlan' && w.msg.includes('requires a single VLAN')));
  for (const vlan of ['0', '4094-4095', '352-350', '350,,352', '350,', '350 352', '350-352x']) {
    const invalid = generate({ left: { vlan } });
    assert.ok(invalid.warnings.some(w => w.level === 'error' && w.field === 'left.vlan'), vlan);
    assert.deepEqual(invalid.vars.left.classifiers, []);
  }
});

test('392x UNI -> ENNI uses push / stamp / pop and FD vlan-id', () => {
  const out = generate({ device: DEVICE_392X, right: { role: 'ENNI', vlan: '200' } });
  assert.equal(byId(out, 'C19'), 'fds fd test1 description test1 mode vpls vlan-id 83');
  assert.equal(byId(out, 'C21'), 'fps fp fp1_test1 ingress-l2-transform ingressPush83 vlan-stack 1 push-tpid tpid-8100 push-vid 83');
  assert.equal(byId(out, 'C22'), 'fps fp fp1_test1 egress-l2-transform egressPop vlan-stack 1 pop-type');
  assert.equal(byId(out, 'C25'), 'fps fp fp2_test1 ingress-l2-transform ingressStamp83 vlan-stack 1 stamp-pcp map stamp-vid-value 83');
  assert.equal(byId(out, 'C26'), 'fps fp fp2_test1 egress-l2-transform egressStamp200 vlan-stack 1 stamp-tpid tpid-8100 stamp-pcp map stamp-vid-value 200');
  assert.equal(out.diagram.N12, 's83:c101');
  assert.equal(out.diagram.P3, "FD's SVID : 83");
});

test('392x ENNI with VLAN equal to FD SVLAN is no-op', () => {
  const out = generate({ device: DEVICE_392X, right: { role: 'ENNI', vlan: '83' } });
  assert.match(byId(out, 'C25'), /^# left blank/);
  assert.match(byId(out, 'C26'), /^# left blank/);
});

test('non-392x ENNI pops on ingress and pushes on egress', () => {
  const out = generate({ right: { role: 'ENNI', vlan: '300' } });
  assert.equal(byId(out, 'C25'), 'fps fp fp2_test1 ingress-l2-transform ingressPop vlan-stack 1 pop-type');
  assert.equal(byId(out, 'C26'), 'fps fp fp2_test1 egress-l2-transform egressPush300 vlan-stack 1 push-tpid tpid-8100 push-vid 300');
});

test('user can override the auto L2 operation', () => {
  const out = generate({ left: { ingressOp: 'push-vid' } });
  assert.match(byId(out, 'C21'), /ingressPush83 .* push-vid 83$/);
  assert.equal(out.vars.left.inOpAuto, 'no-op');
});

test('LAG ports use the LAG name for logical port and FP name', () => {
  const out = generate({ left: { port: 'LAG', lagName: 'LAG7' }, right: { port: '1/2' } });
  assert.match(byId(out, 'C20'), /^fps fp fpLAG7_test1 .* logical-port LAG7 /);
  assert.match(byId(out, 'C24'), /^fps fp fp1_2_test1 .* logical-port 1\/2 /);
  assert.equal(out.cfm.fpName, 'fpLAG7_test1');
});

test('EPL untagged/all-tags classifiers and L2CP profile', () => {
  const s = { untagged: true, allTags: true, l2cp: true };
  const out = generate({ left: s, right: s });
  assert.match(byId(out, 'C14'), /CLASSIFIER_4096/);
  assert.match(byId(out, 'C15'), /CLASSIFIER_4097/);
  assert.match(byId(out, 'C16'), /CLASSIFIER_L2cp/);
  assert.match(byId(out, 'C18'), /^# left blank/);
  assert.match(byId(out, 'C19'), / l2cp-profile FWD_ALL$/);
  assert.match(byId(out, 'C20'), /classifier-list CLASSIFIER_4097 CLASSIFIER_4096 CLASSIFIER_L2cp$/);
  assert.equal(out.diagram.G12, 'cXXX');
});

test('extras: meter, fixed CoS map-policy, PFG', () => {
  const out = generate({ left: { meter: 'BP_PROFILE_1', fixedCos: '3', mapPolicy: 'outer-tag', pfg: 'root' }, right: { pfg: 'leaf' } });
  assert.equal(byId(out, 'C23'), 'fps fp fp1_test1 meter-profile BP_PROFILE_1 map-policy outer-tag frame-to-cos-map fixed_24 pfg-group root');
  assert.equal(byId(out, 'C27'), 'fps fp fp2_test1 pfg-group leaf');
  assert.match(byId(out, 'C19'), / pfg-profile default-pfg-profile$/);
  assert.equal(out.fixedCos.left.lines.length, 17);
  assert.equal(out.fixedCos.left.lines[0], 'frame-to-cos-maps frame-to-cos-map fixed_24 non-conforming-cos 24 non-conforming-color green');
});

test('map policy input is honoured', () => {
  const left = { fixedCos: '1', mapPolicy: 'dscp' };
  assert.match(byId(generate({ left }), 'C23'), / map-policy dscp /);
});

test('392x fixed CoS goes on the logical port', () => {
  const out = generate({ device: DEVICE_392X, left: { fixedCos: '5' } });
  assert.equal(byId(out, 'C12'), 'logical-ports logical-port 1 fixed-cos 40 fixed-color green');
  assert.equal(out.fixedCos.left.used, false);
});

test('custom logical-port MTUs are emitted and validated only when enabled', () => {
  const out = generate({ emitMtu: true, left: { mtu: '9500' }, right: { mtu: '9216' } });
  assert.equal(byId(out, 'MTU-L'), 'logical-ports logical-port 1 mtu 9500');
  assert.equal(byId(out, 'MTU-R'), 'logical-ports logical-port 2 mtu 9216');
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  for (const mtu of ['', 'abc', '0', '-1', '9500.5', '9801', '9800\nexit']) {
    for (const side of ['left', 'right']) {
      const invalid = generate({ emitMtu: true, [side]: { mtu } });
      assert.ok(invalid.warnings.some(w => w.level === 'error' && w.field === `${side}.mtu`), `${side}: ${mtu}`);
    }
  }
  const disabled = generate({ emitMtu: false, left: { mtu: 'invalid' } });
  assert.ok(!disabled.warnings.some(w => w.field === 'left.mtu'));
  assert.ok(!configText(disabled).includes(' mtu '));
});

test('right frame-to-cos treats disabled as the generated default', () => {
  const right = { fixedCos: '2', frameToCos: '(disabled)' };
  assert.match(byId(generate({ right }), 'C27'), /frame-to-cos-map fixed_16$/);
});

test('CFM priorities and acceleration follow input settings', () => {
  const cfm = { ccmPriority: '5', dmmPriority: '6', hwAccel: true };
  const fixed = generate({ cfm });
  assert.match(byId(fixed, 'C109'), /ccm-ltm-priority 5 accelerate true$/);
  assert.match(byId(fixed, 'C111'), / priority 6 /);
  assert.match(byId(generate({ device: DEVICE_392X }), 'C109'), /ccm-ltm-priority 3$/);
});

test('3.33ms message-period is generated', () => {
  const cfm = { dmmInterval: '3.33ms' };
  assert.match(byId(generate({ cfm }), 'C111'), /message-period 3\.33 /);
});

test('disabled fixed CoS produces no profile', () => {
  assert.equal(generate().fixedCos.left.used, false);
});

test('T12 is computed from right egress operations', () => {
  assert.equal(generate({ left: { vlan: '5' }, right: { vlan: '5' } }).diagram.T12, 'c5');
  assert.equal(generate({ right: { role: 'ENNI', vlan: '300' } }).diagram.T12, 's300:c101');
});

test('CFM MA name and disabled DMM/SLM', () => {
  assert.equal(generate({ serviceName: 'abcdefg' }).cfm.ma, 'abcdefg_1');
  assert.equal(generate({ cfm: { maName: 'MA9' } }).cfm.ma, 'MA9');
  const out = generate({ cfm: { dmm: false, slm: false, tagged: false } });
  assert.match(byId(out, 'C111'), /^#/);
  assert.match(byId(out, 'C112'), /^#/);
  assert.match(byId(out, 'C113'), /^#/);
  assert.ok(!configText(generate({ cfm: { enabled: false } })).includes('maintenance-domain'));
});

test('ELINE uses vpws and no MAC table', () => {
  const out = generate({ serviceType: 'ELINE' });
  assert.match(byId(out, 'C19'), /mode vpws$/);
  assert.match(out.show[5], /^# No MAC Table/);
  assert.equal(out.diagram.P2, 'FD Type : VPWS');
});

test('nuke removes the right classifier only when VLANs differ', () => {
  assert.equal(generate().nuke.filter(l => l.includes('classifier')).length, 1);
  assert.equal(generate({ right: { role: 'ENNI', vlan: '9' } }).nuke.filter(l => l.includes('classifier')).length, 2);
});

test('nuke removes generated untagged, AllTags and L2CP classifiers rather than unused VLANs', () => {
  const untagged = generate({ left: { untagged: true }, right: { role: 'ENNI', vlan: '83' } });
  assert.ok(untagged.nuke.includes('no classifiers classifier CLASSIFIER_4096'));
  assert.ok(untagged.nuke.includes('no classifiers classifier CLASSIFIER_83'));
  assert.ok(!untagged.nuke.includes('no classifiers classifier CLASSIFIER_101'));
  const allTags = generate({
    left: { allTags: true, l2cp: true },
    right: { allTags: true, l2cp: true },
  });
  assert.deepEqual(allTags.nuke.filter(line => line.startsWith('no classifiers')), [
    'no classifiers classifier CLASSIFIER_4097',
    'no classifiers classifier CLASSIFIER_L2cp',
  ]);
});

test('warnings', () => {
  const lv = (inp, field) => generate(inp).warnings.filter(w => w.field === field).map(w => w.level);
  assert.deepEqual(lv({ left: { role: 'ENNI', untagged: true } }, 'left.role').includes('error'), true);
  assert.deepEqual(lv({ left: { port: 'LAG', lagName: '' } }, 'left.lagName'), ['error']);
  assert.ok(lv({ left: { vlan: '5000' } }, 'left.vlan').includes('error'));
  assert.ok(lv({ right: { vlan: '102' } }, 'right.vlan').includes('error'));
  assert.ok(lv({ left: { pfg: 'leaf' }, right: { pfg: 'leaf' } }, 'left.pfg').includes('warn'));
  assert.ok(lv({ left: { pfg: 'root' } }, 'right.pfg').includes('warn'));
  assert.ok(lv({ serviceName: 'bad name' }, 'serviceName').includes('error'));
  assert.ok(lv({ cfm: { ccmInterval: '10ms' } }, 'cfm.hwAccel').includes('warn'));
});

test('392x blocks unsupported root/leaf PFG and VLAN-FD transform combinations', () => {
  for (const side of ['left', 'right']) {
    for (const pfg of ['root', 'leaf']) {
      assert.ok(generate({ device: DEVICE_392X, [side]: { pfg } }).warnings
        .some(w => w.level === 'error' && w.field === `${side}.pfg`));
    }
    for (const ingressTpid of ['tpid-88a8', 'tpid-9100']) {
      assert.ok(generate({ device: DEVICE_392X, [side]: { ingressOp: 'push-vid', ingressTpid } }).warnings
        .some(w => w.level === 'error' && w.field === `${side}.ingressTpid`));
    }
    assert.ok(generate({ device: DEVICE_392X, [side]: { egressOp: 'push-vid' } }).warnings
      .some(w => w.level === 'error' && w.field === `${side}.egressOp`));
  }
  assert.ok(!generate({ device: DEVICE_392X, left: { ingressTpid: 'tpid-8100' } }).warnings
    .some(w => w.level === 'error'));
  const stamp = generate({ device: DEVICE_392X, left: { ingressOp: 'stamp-vid-value', ingressTpid: 'tpid-88a8',
    egressOp: 'stamp-vid-value', egressTpid: 'tpid-9100' } });
  assert.ok(!stamp.warnings.some(w => w.level === 'error'));
  assert.ok(!generate({ left: { pfg: 'root' }, right: { pfg: 'leaf' } }).warnings.some(w => w.level === 'error'));
});

test('SLM availability dependencies reject long periods only when SLM is enabled', () => {
  for (const slmInterval of ['10s', '1min', '10min']) {
    assert.ok(generate({ cfm: { slmInterval } }).warnings
      .some(w => w.level === 'error' && w.field === 'cfm.slmInterval'));
    for (const cfm of [{ slmInterval, slm: false }, { slmInterval, enabled: false }])
      assert.ok(!generate({ cfm }).warnings.some(w => w.field === 'cfm.slmInterval'));
  }
  for (const slmInterval of ['3.33ms', '10ms', '100ms', '1s'])
    assert.ok(!generate({ cfm: { slmInterval } }).warnings.some(w => w.field === 'cfm.slmInterval'));
});

test('Very advanced availability settings control the SLM alignment guard', () => {
  const warnings = cfm => generate({ cfm }).warnings.filter(w => w.field === 'cfm.slmInterval');
  assert.equal(warnings({ slmInterval: '10s' }).length, 1);
  assert.equal(warnings({ slmInterval: '10s', slmAvailabilityInterval: '17' }).length, 0);
  assert.equal(warnings({ slmInterval: '10s', slmAvailabilityInterval: '17', slmFlrMeasurements: '20' }).length, 1);
  assert.equal(warnings({ slmMessagePeriod: '9000' }).length, 0);
  assert.equal(warnings({ slmMessagePeriod: '9000.01' }).length, 1);
  assert.equal(warnings({ slm: false, slmMessagePeriod: '9000.01' }).length, 0);
});

test('Very advanced OAM generates independent session scheduling and thresholds', () => {
  const out = generate({ cfm: {
    dmmSessionId: '42', dmmRemoteMep: '3', dmmMeasurementInterval: '30', dmmIntervalsStored: '96',
    dmmFdBins: '6', dmmIfdvBins: '4', dmmFdrBins: '5', dmmMaxDelayThreshold: '5000',
    dmmSessionType: 'on-demand', dmmStartType: 'relative', dmmStartTime: '500',
    dmmStopType: 'relative', dmmStopTime: '6000',
    slmSessionId: '43', slmRemoteMep: '5', slmAvailabilityInterval: '30',
    slmConsecutiveIntervals: '20', slmHighFlr: '8', slmForwardThreshold: '100',
  } });
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  assert.match(byId(out, 'C111'), /delay-measurement-config 42 .*remote-mep-id 3/);
  assert.match(byId(out, 'C111'), /measurement-interval 30 number-intervals-stored 96/);
  assert.match(byId(out, 'C111'), /bins-per-fd-interval 6 bins-per-ifdv-interval 4 bins-per-fdr-interval 5/);
  assert.match(byId(out, 'C111'), /start-time-type relative start-time 500 stop-time-type relative stop-time 6000/);
  assert.match(byId(out, 'C111'), /max-frame-delay-two-way-threshold 5000/);
  assert.match(byId(out, 'C112'), /loss-measurement-config 43 .*remote-mep-id 5/);
  assert.match(byId(out, 'C112'), /availability-number-consecutive-intervals 20 availability-number-consecutive-high-flr 8/);
  assert.match(byId(out, 'C112'), /measured-fl-forward-threshold 100/);
  assert.ok(!byId(out, 'C112').includes('start-time 500'));
});

test('Removed MAC targets never emit CLI and legacy overrides require explicit migration', () => {
  for (const [prefix, id] of [['dmm', 'C111'], ['slm', 'C112']]) {
    for (const enabled of [true, false]) {
      const out = generate({ cfm: { enabled, [`${prefix}RemoteMac`]: '00:11:22:33:44:55',
        [`${prefix}RemoteMep`]: '7' } });
      assert.doesNotMatch(byId(out, id), /remote-mac-address/);
      assert.match(byId(out, id), /remote-mep-id 7/);
      assert.equal(out.warnings.some(w => w.field === `cfm.${prefix}RemoteMac` && w.level === 'error'), enabled);
    }
    assert.match(byId(generate({ cfm: { remoteMep: '9' } }), id), /remote-mep-id 9/);
  }
});

test('Very advanced MD, CCM and double-tag edits propagate without changing service binding', () => {
  const out = generate({ cfm: {
    mdId: 'provider', mdLevel: '4', mdWireName: 'provider-md', mdMhf: 'explicit',
    ccmLossNum: '5', cciEnabled: false, fngAlarm: '250', fngReset: '1200',
    tagCount: 'double', tagVlan: '83', tagTpid: 'tpid-88a8', tagPcp: 'pcp-5',
    innerVlan: '101', innerDei: 'enabled', staticRemoteMac: '00:11:22:33:44:55',
  } });
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  assert.match(out.cfm.global.at(-1), /maintenance-domain provider name-type character-string name provider-md md-level 4 mhf-creation explicit/);
  assert.match(byId(out, 'C108'), /ccm-loss-num 5 .*fd-name test1/);
  assert.match(byId(out, 'C110'), /cci-enabled false .*fng-alarm-time 250 fng-reset-time 1200/);
  assert.match(byId(out, 'C113'), /vtags 1 tpid tpid-88a8 vlanid 83 pcp pcp-5/);
  assert.match(byId(out, 'C113'), /vtags 2 tpid tpid-8100 vlanid 101 dei enabled/);
  assert.match(byId(out, 'C113'), /l2-transform\nvtags 1 .*\nvtags 2 .*\napply\nreturn\nconfig$/);
  assert.match(out.cfm.show[2], /md-id provider/);
  assert.match(out.nuke[0], /no maintenance-d provider/);
});

test('Very advanced OAM rejects invalid timing, availability and platform ranges', () => {
  for (const [cfm, field] of [
    [{ dmmStartType: 'relative', dmmStartTime: '5' }, 'cfm.dmmSessionType'],
    [{ dmmSessionType: 'on-demand', dmmStartType: 'relative' }, 'cfm.dmmStartTime'],
    [{ slmHighFlr: '10' }, 'cfm.slmHighFlr'],
    [{ fngReset: '9' }, 'cfm.fngReset'],
    [{ fngAlarm: '3001' }, 'cfm.fngAlarm'],
    [{ dmmFdBins: '11' }, 'cfm.dmmFdBins'],
    [{ dmmRepetition: '6000' }, 'cfm.dmmRepetition'],
    [{ mdId: 'custom' }, 'cfm.mdLevel'],
    [{ slmAccelerate: 'true' }, 'cfm.slmAccelerate'],
  ]) assert.ok(generate({ cfm }).warnings.some(w => w.level === 'error' && w.field === field), field);
  const disabled = generate({ cfm: { enabled: false, dmmStartType: 'relative', dmmStartTime: '', slmHighFlr: '10' } });
  assert.ok(!disabled.warnings.some(w => w.level === 'error'));
});

test('OAM static remotes follow local MEP creation; read-only responders are not CLI inputs', () => {
  const out = generate({ cfm: { staticRemoteMac: '02:00:00:00:00:01' } });
  assert.ok(out.cfm.config.findIndex(l => l.id === 'C109')
    < out.cfm.config.findIndex(l => l.id === 'CFM-STATIC-REMOTE'));
  assert.ok(generate({ cfm: { staticRemoteMac: '02:00:00:00:00:01', hwAccel: true } })
    .warnings.some(w => w.field === 'cfm.staticRemoteMac' && w.level === 'error'));
  for (const key of ['lossResponder', 'slmResponder', 'delayResponder']) {
    const legacy = generate({ cfm: { [key]: 'false' } });
    assert.ok(legacy.warnings.some(w => w.field === `cfm.${key}` && w.level === 'error'));
    assert.doesNotMatch(byId(legacy, 'C109'), /single-ended-responder/);
  }
});

test('OAM sender permissions and binary names enforce the hardware syntax', () => {
  for (const cfm of [
    { mdPermission: 'chassisManage' }, { mdPermission: 'defer' }, { maPermission: 'chassisManage' },
    { maNameType: 'rfc2685-vpn-id', maWireName: '00:11:22:33:44:55:66' },
    { mdNameType: 'mac-address-and-uint', mdWireName: 'too_short' },
  ]) assert.ok(generate({ cfm }).warnings.some(w => w.level === 'error'));
  for (const cfm of [
    { mdPermission: 'chassis-manage', maPermission: 'chassis-manage' },
    { maNameType: 'rfc2685-vpn-id', maWireName: 'ABEiM0RVZg==' },
    { maNameType: 'rfc2685-vpn-id', maWireName: 'abcdefg' },
    { mdNameType: 'mac-address-and-uint', mdWireName: 'ABEiM0RVAAA=' },
  ]) assert.deepEqual(generate({ cfm }).warnings.filter(w => w.level === 'error'), []);
});

test('OAM message periods and SLM indicators must divide their reporting intervals', () => {
  for (const [cfm, field] of [
    [{ dmmMessagePeriod: '333', dmmMeasurementInterval: '5' }, 'cfm.dmmMessagePeriod'],
    [{ slmMessagePeriod: '33.33', slmMeasurementInterval: '3' }, 'cfm.slmMessagePeriod'],
    [{ slmMessagePeriod: '10', slmFlrMeasurements: '10' }, 'cfm.slmFlrMeasurements'],
    [{ slmMessagePeriod: '250', slmFlrMeasurements: '13' }, 'cfm.slmFlrMeasurements'],
    [{ slmMessagePeriod: '2000', slmAccelerate: 'true', slmTestId: '1' }, 'cfm.slmMessagePeriod'],
    [{ slmMessagePeriod: '100', slmFlrMeasurements: '10', slmAccelerate: 'true', slmTestId: '1' }, 'cfm.slmFlrMeasurements'],
  ]) assert.ok(generate({ cfm }).warnings.some(w => w.field === field && w.level === 'error'), field);
  for (const cfm of [
    { dmmMessagePeriod: '300', dmmMeasurementInterval: '5' },
    { slmMessagePeriod: '100', slmFlrMeasurements: '10' },
    { slmMessagePeriod: '25', slmFlrMeasurements: '40' },
    { slmMessagePeriod: '1000', slmAccelerate: 'true', slmTestId: '1' },
    { slmMessagePeriod: '100', slmFlrMeasurements: '100', slmAccelerate: 'true', slmTestId: '1' },
  ]) assert.deepEqual(generate({ cfm }).warnings.filter(w => w.level === 'error'), []);
});

test('Accelerated SLM omits inherited priority and rejected fixed frame-size and test-id overrides', () => {
  const out = generate({ cfm: { slmAccelerate: 'true', slmTestId: '1', slmPriority: '7', ccmPriority: '3' } });
  assert.deepEqual(out.warnings.filter(w => w.level === 'error'), []);
  assert.doesNotMatch(byId(out, 'C112'), /\b(priority|frame-size|test-id) /);
  assert.match(byId(out, 'C112'), /accelerate true/);
  assert.match(byId(generate(), 'C112'), /priority 3/);
});

test('SOAM tag trail models tagged CFM through flow-point transforms', () => {
  const run = (device, cfm, right = {}) => generate({
    device, fdSvlan: 200, left: { role: 'UNI', vlan: 101 }, right: { role: 'ENNI', vlan: 200, ...right },
    cfm: { enabled: true, tagCount: 'single', ...cfm },
  });
  const trail = o => o.soam.steps.map(s => s.stack).join(' > ');
  const cfmWarn = o => o.warnings.filter(w => w.field.startsWith('cfm.')).map(w => w.level);
  // Up MEP: own FP ingress transform, then far FP egress transform.
  assert.equal(trail(run(DEVICE_OTHER, { endpoint: 'Left', direction: 'Up', tagged: true })), 'c101 > c101 > s200:c101');
  assert.equal(trail(run(DEVICE_392X, { endpoint: 'Left', direction: 'Up', tagged: true })), 'c101 > s200:c101 > s200:c101');
  assert.equal(run(DEVICE_392X, { endpoint: 'Left', direction: 'Up', tagged: false }).soam.wire, 'c200');
  // Down MEP: egress push applies to 0/1-tag frames only; stamp/pop never apply.
  assert.equal(run(DEVICE_OTHER, { endpoint: 'Right', direction: 'Down', tagged: true, tagVlan: 101 }).soam.wire, 's200:c101');
  const dbl = run(DEVICE_OTHER, { endpoint: 'Right', direction: 'Down', tagged: true, tagCount: 'double', tagVlan: 200, innerVlan: 101 });
  assert.equal(dbl.soam.wire, 's200:c101');
  assert.deepEqual(cfmWarn(dbl), ['warn']);
  const stamp = run(DEVICE_OTHER, { endpoint: 'Right', direction: 'Down', tagged: true, tagVlan: 101 }, { ingressOp: 'stamp-vid-value', egressOp: 'stamp-vid-value' });
  assert.equal(stamp.soam.wire, 'c101');
  assert.deepEqual(cfmWarn(stamp), ['warn']);
  // 392x failure modes seen in the lab.
  const v4095 = run(DEVICE_392X, { endpoint: 'Right', direction: 'Down', tagged: false });
  assert.equal(v4095.soam.wire, 'c4095');
  assert.ok(v4095.warnings.some(w => w.field === 'cfm.tagged' && /4095/.test(w.msg)));
  const three = run(DEVICE_392X, { endpoint: 'Left', direction: 'Up', tagged: true, tagCount: 'double', tagVlan: 200, innerVlan: 101 });
  assert.equal(three.soam.wire, 's200:s200:c101');
  assert.ok(three.warnings.some(w => w.field === 'cfm.tagCount' && /three VLAN tags/.test(w.msg)));
  assert.equal(run(DEVICE_OTHER, { enabled: false }).soam, null);
});

test('SOAM trail without a MEP l2-transform flags a peer classifier mismatch', () => {
  const run = (cfm, right = {}) => generate({
    device: DEVICE_OTHER, fdSvlan: 200, left: { role: 'UNI', vlan: 101 }, right: { role: 'ENNI', vlan: 200, ...right },
    cfm: { enabled: true, tagCount: 'single', ...cfm },
  });
  const miss = o => o.warnings.some(w => /does not match the peer flow point's VLAN classifier/.test(w.msg));
  const STAMP = { ingressOp: 'stamp-vid-value', egressOp: 'stamp-vid-value' }, NOOP = { ingressOp: 'no-op', egressOp: 'no-op' };
  // Working cases: an egress push gives untagged CFM the classifier VLAN.
  assert.ok(!miss(run({ endpoint: 'Right', direction: 'Down', tagged: false })));
  assert.ok(!miss(run({ endpoint: 'Left', direction: 'Up', tagged: false })));
  assert.ok(!miss(run({ endpoint: 'Right', direction: 'Down', tagged: true }, NOOP)));
  // Failing cases: nothing to stamp or push, so the frames leave untagged.
  for (const o of [run({ endpoint: 'Right', direction: 'Down', tagged: false }, NOOP), run({ endpoint: 'Left', direction: 'Up', tagged: false }, STAMP)]) {
    assert.equal(o.soam.wire, 'untagged');
    assert.ok(miss(o));
  }
  // Verify that measurement request and reply paths are checked in the generated guidance.
  const up = run({ endpoint: 'Left', direction: 'Up', tagged: true }, STAMP);
  assert.equal(up.soam.wire, 'c200');
  assert.ok(up.warnings.some(w => /Verify both request and reply paths for DMR\/SLR/.test(w.msg)));
  assert.ok(!miss(up));

  const xgs = generate({
    device: DEVICE_392X, fdSvlan: 200,
    left: { role: 'UNI', vlan: '101' }, right: { role: 'ENNI', vlan: '83' },
    cfm: { enabled: true, endpoint: 'Left', direction: 'Up', tagged: true },
  });
  assert.ok(xgs.soam.notes.includes('up-stamp-review'));
  assert.ok(!xgs.warnings.some(w => /Verify both request and reply paths/.test(w.msg)),
    'Platform-specific measurement guidance should be scoped to the modeled platform');
});

test('Tagged CFM on an Untagged-only endpoint is a config error', () => {
  const msg = "Disable 'Tagged CFM' if Endpoint is Untagged-only.";
  const errors = input => generate(input).warnings.filter(w => w.level === 'error').map(w => w.msg);
  assert.ok(errors({ left: { untagged: true }, right: { untagged: true }, cfm: { enabled: true, endpoint: 'Left', tagged: true } }).includes(msg));
  assert.ok(!errors({ left: { untagged: true }, right: { untagged: true }, cfm: { enabled: true, endpoint: 'Left', tagged: false } }).includes(msg));
  assert.ok(!errors({ left: { untagged: true, allTags: true }, right: { untagged: true, allTags: true }, cfm: { enabled: true, endpoint: 'Left', tagged: true } }).includes(msg));
});
