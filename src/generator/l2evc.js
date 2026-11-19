/* SAOS10 NID L2 EVC config generator.
 *
 * generate(input) -> { vars, config, show, nuke, cfm, fixedCos, diagram, warnings }
 *
 * The generator corrects spreadsheet formula issues and emits usable SAOS10 commands. */

import { CFM_EXTRA_DEFAULTS, cfmArgs, validateCfmOptions } from './cfm-options.js';

export const DEVICE_392X = '392x';
export const DEVICE_OTHER = '3931, 394x, 398x, 51xx, 81xx';
export const DEVICE_TYPES = [DEVICE_392X, DEVICE_OTHER];
export const ROLES = ['UNI', 'ENNI'];
export const PORTS = [...Array.from({ length: 54 }, (_, i) => String(i + 1)), '1/1', '1/2', '2/1', '2/2', 'LAG'];
export const SERVICE_TYPES = ['ELAN', 'ELINE'];
export const FIXED_COS = ['(disabled)', '0', '1', '2', '3', '4', '5', '6', '7'];
export const PFG = ['(disabled)', 'root', 'leaf'];
export const MAP_POLICIES = ['(none)', 'outer-tag', 'inner-tag', 'mpls-tc', 'dscp-mpls-tc', 'dscp'];
export const VLAN_OPS = ['no-op', 'pop-type', 'push-vid', 'stamp-vid-value'];
export const TPIDS = ['tpid-8100', 'tpid-88a8', 'tpid-9100'];
export const CCM_INTERVALS = ['3.33ms', '10ms', '100ms', '1s', '10s', '1min', '10min'];
export const PRIORITIES = ['0', '1', '2', '3', '4', '5', '6', '7'];
export const LOWEST_FAULT = ['remote-rdi', 'remote-mac-error', 'remote-invalid-ccm', 'invalid-ccm', 'cross-connect-ccm'];
export const MTUS = ['9800', '9700', '9216', '9136', '1522'];

const DEFAULT_SIDE = {
  role: 'UNI', port: '1', vlan: '101', lagName: 'LAG1',
  untagged: false, allTags: false, l2cp: false,
  meter: '', fixedCos: '(disabled)', frameToCos: '', cosToFrame: '', pfg: '(disabled)',
  mapPolicy: '(none)', mtu: '9800',
  ingressOp: '', egressOp: '', ingressTpid: 'tpid-8100', egressTpid: 'tpid-8100',
};

export function defaults() {
  return {
    serviceName: 'test1',
    device: DEVICE_OTHER,
    fdSvlan: '83',
    serviceType: 'ELAN',
    l2cpProfile: 'FWD_ALL',
    left: { ...DEFAULT_SIDE },
    right: { ...DEFAULT_SIDE, port: '2', lagName: 'LAGxxx' },
    cfm: {
      ...CFM_EXTRA_DEFAULTS,
      enabled: true, endpoint: 'Left', localMep: '2', remoteMep: '1', dmm: true, slm: true,
      maName: '', md: 'md3', ccmPriority: '3', dmmPriority: '3', slmPriority: '3', hwAccel: false,
      ccmInterval: '1s', dmmInterval: '1s', slmInterval: '1s', direction: 'Up',
      dmmFrameSize: '64', slmFrameSize: '64', dmmTestId: '4', slmTestId: '4', tagged: true,
      lowestFault: 'remote-mac-error',
    },
    emitMtu: false,
  };
}

/** Deep-merge a partial input over the defaults. */
export function normalize(input = {}) {
  const d = defaults();
  const provided = { ...input };
  delete provided.compat;
  return {
    ...d, ...provided,
    left: { ...d.left, ...(input.left || {}) },
    right: { ...d.right, ...(input.right || {}) },
    cfm: { ...d.cfm, ...(input.cfm || {}) },
  };
}

// Excel string comparison is case-insensitive and number/string agnostic.
const eq = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const blank = v => v === undefined || v === null || String(v).trim() === '';
const cos8 = v => Number(v) * 8;
const disabled = v => blank(v) || eq(v, '(disabled)');

const MSG_PERIOD = { '3.33ms': '3.33', '10ms': '10', '100ms': '100', '1s': '1000', '10s': '10000', '1min': '60000', '10min': '600000' };
function line(id, text, objects = [], explain = '') {
  return { id, text, skip: text.startsWith('#'), objects, explain };
}

function vlanRanges(value) {
  const ranges = [];
  for (const token of String(value).split(',')) {
    const match = /^(\d+)(?:[ \t]*-[ \t]*(\d+))?$/.exec(token.trim());
    if (!match) return [];
    const min = Number(match[1]), max = Number(match[2] ?? match[1]);
    if (min < 1 || max > 4094 || min > max) return [];
    ranges.push({ min, max });
  }
  ranges.sort((a, b) => a.min - b.min);
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.min <= previous.max + 1) previous.max = Math.max(previous.max, range.max);
    else merged.push(range);
  }
  return merged;
}

const rangeLabel = ({ min, max }) => min === max ? String(min) : `${min}-${max}`;
const classifierName = range => `CLASSIFIER_${rangeLabel(range)}`;
const vlanLabel = ranges => ranges.map(rangeLabel).join(', ');
const multiVlan = ranges => ranges.length > 1 || (ranges.length === 1 && ranges[0].min !== ranges[0].max);
const classified = side => !side.allTags && !side.untagged;

/** Rows 75-86: the generated variables for one side. */
function sideVars(inp, side) {
  const s = inp[side];
  const is392 = inp.device === DEVICE_392X;
  const ranges = vlanRanges(s.vlan);
  const egVid = ranges.length ? String(ranges[0].min) : '';
  const matchesFd = !multiVlan(ranges) && eq(egVid, inp.fdSvlan);
  const lp = s.port === 'LAG' ? s.lagName : s.port;                                   // D77 / F77
  const fp = `fp${String(lp).replace(/\//g, '_')}_${inp.serviceName}`;                 // D78 / F78
  const autoIn = is392 ? (s.role === 'UNI' ? 'push-vid' : (matchesFd ? 'no-op' : 'stamp-vid-value'))
    : (s.role === 'UNI' ? 'no-op' : 'pop-type');                                        // D79 / F79
  const autoEg = is392 ? (s.role === 'UNI' ? 'pop-type' : (matchesFd ? 'no-op' : 'stamp-vid-value'))
    : (s.role === 'UNI' ? 'no-op' : 'push-vid');                                        // D83 / F83
  const inOp = s.ingressOp || autoIn;
  const egOp = s.egressOp || autoEg;
  const inVid = String(inp.fdSvlan);                                                   // D80 / F80
  const xName = (dir, op, vid) => op === 'push-vid' ? `${dir}Push${vid}` : op === 'pop-type' ? `${dir}Pop` : op === 'stamp-vid-value' ? `${dir}Stamp${vid}` : '';
  return {
    lp, fp, ranges, classifiers: classifierList(s, ranges),
    inOp, inOpAuto: autoIn, inVid, inTpid: s.ingressTpid, inName: xName('ingress', inOp, inVid),   // D82 / F82
    egOp, egOpAuto: autoEg, egVid, egTpid: s.egressTpid, egName: xName('egress', egOp, egVid),     // D86 / F86
  };
}

function transformLines(inp, v, sideName) {
  const is392 = inp.device === DEVICE_392X;
  let ing, egr;
  if (v.inOp === 'no-op') ing = `# left blank, b/c no need for ingress-l2-transform for ${v.fp}`;
  else if (v.inOp === 'push-vid') ing = `fps fp ${v.fp} ingress-l2-transform ${v.inName} vlan-stack 1 push-tpid ${v.inTpid} push-vid ${v.inVid}`;
  else if (v.inOp === 'stamp-vid-value') ing = `fps fp ${v.fp} ingress-l2-transform ${v.inName} vlan-stack 1 ${is392 ? '' : `stamp-tpid ${v.inTpid} `}stamp-pcp map stamp-vid-value ${v.inVid}`;
  else ing = `fps fp ${v.fp} ingress-l2-transform ${v.inName} vlan-stack 1 pop-type`;
  if (v.egOp === 'no-op') egr = `# left blank, b/c no need for egress-l2-transform for ${v.fp}`;
  else if (v.egOp === 'push-vid') egr = `fps fp ${v.fp} egress-l2-transform ${v.egName} vlan-stack 1 push-tpid ${v.egTpid} push-vid ${v.egVid}`;
  else if (v.egOp === 'stamp-vid-value') egr = `fps fp ${v.fp} egress-l2-transform ${v.egName} vlan-stack 1 stamp-tpid ${v.egTpid} stamp-pcp map stamp-vid-value ${v.egVid}`;
  else egr = `fps fp ${v.fp} egress-l2-transform ${v.egName} vlan-stack 1 pop-type`;
  return [
    line(sideName === 'left' ? 'C21' : 'C25', ing, [`fp-${sideName}`, `ingress-${sideName}`], 'Ingress L2 transform: applied as frames enter the FD from this flow point.'),
    line(sideName === 'left' ? 'C22' : 'C26', egr, [`fp-${sideName}`, `egress-${sideName}`], 'Egress L2 transform: applied as frames leave the FD toward this port.'),
  ];
}

function extrasLine(inp, s, v, sideName) {
  const is392 = inp.device === DEVICE_392X;
  const meter = blank(s.meter) ? '' : ` meter-profile ${s.meter}`;
  const fixedName = ` frame-to-cos-map fixed_${disabled(s.fixedCos) ? 0 : cos8(s.fixedCos)}`;
  const frameToCos = disabled(s.frameToCos) ? fixedName : ` frame-to-cos-map ${s.frameToCos}`;
  const mp = s.mapPolicy;
  const policy = eq(mp, '(none)') || blank(mp) ? '' : ` map-policy ${mp}`;
  const mapPolicy = (is392 || s.role === 'ENNI' || (disabled(s.fixedCos) && disabled(s.frameToCos))) ? '' : policy + frameToCos;
  const c2f = blank(s.cosToFrame) ? '' : ` cos-to-frame-map ${s.cosToFrame}`;
  const pfg = disabled(s.pfg) ? '' : ` pfg-group ${s.pfg}`;
  const extras = meter + mapPolicy + c2f + pfg;
  return line(sideName === 'left' ? 'C23' : 'C27', extras ? `fps fp ${v.fp}${extras}` : '# left blank, b/c extras not enabled (below)',
    [`fp-${sideName}`, 'qos'], 'Flow-point extras: metering, CoS mapping and private-forwarding group.');
}

function classifierList(s, ranges) {
  return [
    ...(classified(s) ? ranges.map(classifierName) : []),
    ...(s.allTags ? ['CLASSIFIER_4097'] : []),
    ...(s.untagged ? ['CLASSIFIER_4096'] : []),
    ...(s.l2cp ? ['CLASSIFIER_L2cp'] : []),
  ];
}

/** Diagram cells G1:AA16 (tag stack seen at each stage of the packet walk). */
function diagram(inp, L, R) {
  const { left: l, right: r } = inp;
  const is392 = inp.device === DEVICE_392X;
  const D6 = L.egVid, D9 = R.egVid, D10 = inp.fdSvlan;
  const G12 = l.allTags ? 'cXXX' : l.untagged ? 'Untagged'
    : l.role === 'ENNI' ? (r.role === 'UNI' && !r.untagged ? `s${D6}:c${D9}` : (!r.untagged ? `s${D6}:cXXX` : `c${D6}`)) : `c${D6}`;
  const K12 = l.untagged ? 'Untagged' : l.allTags ? 'AllTags' : vlanLabel(L.ranges);
  let N12;
  if (eq(G12, 'Untagged') && is392) N12 = `c${L.inVid}`;
  else if (eq(G12, 'Untagged')) N12 = 'Untagged';
  else if ((L.inOp === 'pop-type' && r.role === 'ENNI') || (L.inOp === 'pop-type' && l.role === 'UNI')) N12 = 'cXXX';
  else if (L.inOp === 'push-vid') N12 = `s${L.inVid}:${G12}`;
  else if (L.inOp === 'pop-type' && l.role === 'ENNI') N12 = `c${D9}`;
  else if (L.inOp === 'stamp-vid-value') N12 = l.role === 'UNI' ? `c${L.inVid}` : (r.role === 'ENNI' ? `s${L.inVid}:cXXX` : `s${L.inVid}:c${D9}`);
  else N12 = `c${D6}`;
  // The right egress side follows the same transform rule as the left.
  let T12;
  if (r.allTags) T12 = 'cXXX';
  else if (r.untagged) T12 = 'Untagged';
  else if (is392) {
    if (R.egOp === 'pop-type') T12 = `c${D9}`;
    else if (R.egOp === 'push-vid') T12 = eq(N12, 'untagged') ? `c${R.egVid}` : `s${R.egVid}:${N12}`;
    else if (R.egOp === 'stamp-vid-value') T12 = l.role === 'ENNI' ? `s${R.egVid}:cXXX` : `s${R.egVid}:c${D6}`;
    else T12 = N12;
  } else if (R.egOp === 'pop-type') T12 = 'untagged';
  else if (R.egOp === 'push-vid') T12 = eq(N12, 'untagged') ? `c${R.egVid}` : `s${R.egVid}:${N12}`;
  else T12 = N12;
  const Y12 = T12, Y15 = Y12;
  const V15 = r.untagged ? 'Untagged' : r.allTags ? 'AllTags' : vlanLabel(R.ranges);
  let S15;
  if (R.inOp === 'pop-type') S15 = String(Y15).slice(0, 1).toLowerCase() === 'c' ? 'Untagged' : (l.role === 'ENNI' ? 'cXXX' : `c${D6}`);
  else if (R.inOp === 'push-vid') S15 = eq(Y15, 'untagged') ? `c${R.inVid}` : `s${R.inVid}:${Y15}`;
  else if (R.egOp === 'stamp-vid-value') S15 = r.role === 'UNI' ? `c${R.inVid}` : (l.role === 'ENNI' ? `s${R.inVid}:cXXX` : `s${R.inVid}:c${D6}`);
  else if (R.inOp === 'no-op') S15 = Y15;
  else S15 = `s${R.inVid}:c${D6}`;
  let L15;
  if (l.allTags) L15 = 'cXXX';
  else if (l.untagged) L15 = 'Untagged';
  else if (is392) {
    if (L.egOp === 'pop-type') L15 = `c${D6}`;
    else if (L.egOp === 'push-vid') L15 = eq(S15, 'untagged') ? `c${L.egVid}` : `s${L.egVid}:${S15}`;
    else if (L.egOp === 'stamp-vid-value') L15 = r.role === 'ENNI' ? `s${L.egVid}:cXXX` : `s${L.egVid}:c${D9}`;
    else L15 = S15;
  } else if (L.egOp === 'pop-type') L15 = 'untagged';
  else if (L.egOp === 'push-vid') L15 = eq(S15, 'untagged') ? `c${L.egVid}` : `s${L.egVid}:${S15}`;
  else L15 = S15;
  return {
    H1: `'Left' Port (${l.role})`, L1: `'Left' Flow Point (${l.role})`,
    S1: `'Right' Flow Point (${r.role})`, W1: `'Right' Port (${r.role})`,
    P2: `FD Type : ${inp.serviceType === 'ELINE' ? 'VPWS' : 'VPLS'}`,
    P3: is392 ? `FD's SVID : ${D10}` : '',
    G12, K12: String(K12), N12, T12, Y12,
    Y15, V15: String(V15), S15, L15, G15: L15,
    N13: L.inOp === 'no-op' ? 'No Ingress L2 Action' : `Ingress L2 Transform (${L.inName})`,
    P13: `L2 Switching${is392 ? ` with SVLAN : ${D10}` : ''}`,
    S13: R.egOp === 'no-op' ? 'No Egress L2 Action' : `Egress L2 Transform (${R.egName})`,
    K16: L.egOp === 'no-op' ? 'No Egress L2 Action' : `Egress L2 Transform (${L.egName})`,
    S16: R.inOp === 'no-op' ? 'No Ingress L2 Action' : `Ingress L2 Transform (${R.inName})`,
  };
}

/* Models SOAM tag-stack transformations for the packet walk and configuration guidance. */
const stackStr = st => st.length ? st.map(t => `${t.k}${t.v}`).join(':') : 'untagged';
function applyOp(st, op, vid) {
  if (op === 'push-vid') return st.length ? [{ k: 's', v: vid }, ...st] : [{ k: 'c', v: vid }];
  if (op === 'pop-type') return st.slice(1);
  if (op === 'stamp-vid-value' && st.length) return [{ ...st[0], v: vid }, ...st.slice(1)];
  return st;
}
const OP_TEXT = { 'push-vid': 'push', 'pop-type': 'pop', 'stamp-vid-value': 'stamp' };

export function soamTrail(inp, L, R) {
  const c = inp.cfm;
  if (!c.enabled) return null;
  const own = c.endpoint === 'Left' ? L : R, far = c.endpoint === 'Left' ? R : L;
  const vlan = String(c.tagVlan || own.egVid);
  const mep = !c.tagged ? [] : c.tagCount === 'double'
    ? [{ k: 's', v: vlan }, { k: 'c', v: String(c.innerVlan || vlan) }] : [{ k: 'c', v: vlan }];
  const opText = (op, vid) => `${OP_TEXT[op]}${op === 'pop-type' ? '' : ` ${vid}`}`;
  const steps = [{ at: 'mep', stack: stackStr(mep), label: c.tagged ? 'MEP l2-transform' : 'MEP (untagged)' }];
  const notes = [];
  let wire;
  if (c.direction === 'Up') {
    const a = applyOp(mep, own.inOp, own.inVid);
    steps.push({ at: 'own', stack: stackStr(a), label: own.inOp === 'no-op' ? `${own.fp}: no ingress action` : `${own.fp} ingress ${opText(own.inOp, own.inVid)}` });
    wire = applyOp(a, far.egOp, far.egVid);
    steps.push({ at: 'wire', stack: stackStr(wire), label: far.egOp === 'no-op' ? `${far.fp}: no egress action` : `${far.fp} egress ${opText(far.egOp, far.egVid)}` });
  } else if (inp.device === DEVICE_392X && !mep.length) {
    wire = [{ k: 'c', v: '4095' }];
    steps.push({ at: 'wire', stack: 'c4095', label: '392x untagged Down MEP: VLAN 4095' });
    notes.push('vlan4095');
  } else {
    const pushOk = own.egOp === 'push-vid' && mep.length <= 1;
    wire = pushOk ? applyOp(mep, own.egOp, own.egVid) : mep;
    let label = `${own.fp}: no egress action`;
    if (pushOk) label = `${own.fp} egress ${opText(own.egOp, own.egVid)}`;
    else if (own.egOp !== 'no-op') {
      label = `${own.fp} egress ${opText(own.egOp, own.egVid)} not applied`;
      notes.push(own.egOp === 'push-vid' ? 'double-no-push' : 'down-no-stamp-pop');
    }
    steps.push({ at: 'wire', stack: stackStr(wire), label });
  }
  if (wire.length > 2) notes.push('three-tags');
  if (c.direction === 'Up' && far.egOp === 'stamp-vid-value' && mep.length) notes.push('up-stamp-review');
  // The flow point on the wire is the far one for an Up MEP and the MEP's own for a Down MEP.
  const wireKey = (c.direction === 'Up') === (c.endpoint === 'Left') ? 'right' : 'left';
  const ranges = (wireKey === 'right' ? R : L).ranges;
  const wireVid = Number(wire[0]?.v);
  if (classified(inp[wireKey]) && ranges.length && !notes.length &&
      !ranges.some(({ min, max }) => wireVid >= min && wireVid <= max)) notes.push('classifier-miss');
  return { direction: c.direction, mep: stackStr(mep), wire: stackStr(wire), steps, notes };
}

function soamWarnings(inp, L, R, warn, info) {
  const t = soamTrail(inp, L, R);
  if (!t) return;
  if (t.notes.includes('vlan4095'))
    warn('cfm.tagged', 'This 392x packet-walk model shows VLAN 4095 for an untagged Down MEP. Check the peer classifier and validate the behavior on the target platform.');
  if (t.notes.includes('three-tags'))
    warn('cfm.tagCount', `SOAM frames leave with three VLAN tags (${t.wire}). Review the peer's tag handling and use a supported CFM tag stack.`);
  if (t.notes.includes('down-no-stamp-pop'))
    warn('cfm.direction', `The packet walk does not apply the flow point's egress stamp or pop to this Down MEP, so frames leave as ${t.wire}. Check the peer classifier.`);
  if (t.notes.includes('double-no-push'))
    warn('cfm.tagCount', `The packet walk does not apply the flow point's egress push to this double-tagged Down MEP, so frames leave as ${t.wire}.`);
  if (t.notes.includes('classifier-miss'))
    warn('cfm.tagged', `SOAM frames leave as ${t.wire}, which does not match the peer flow point's VLAN classifier. ${inp.cfm.tagged ? 'Change the CFM tag' : 'Enable Tagged CFM'} or update the peer classifier, then verify receive counters.`);
  if (t.notes.includes('up-stamp-review') && inp.device !== DEVICE_392X)
    warn('cfm.direction', 'Verify both request and reply paths for DMR/SLR on the target platform before relying on measurements.');
  if (!inp.cfm.tagged && t.wire !== 'untagged' && t.direction === 'Up')
    info('cfm.tagged', 'For untagged CFM, review PCP handling for each Y.1731 message type on the target platform.');
}

function warnings(inp, L, R) {
  const { left: l, right: r } = inp;
  const w = [];
  const push = level => (field, msg) => w.push({ level, field, msg });
  const err = push('error'), warn = push('warn'), info = push('info');
  for (const [k, s] of [['left', l], ['right', r]]) {
    const v = k === 'left' ? L : R;
    const Side = k === 'left' ? 'Left' : 'Right';
    if (inp.emitMtu && (!/^\d+$/.test(String(s.mtu).trim()) || Number(s.mtu) < 1 || Number(s.mtu) > 9800))
      err(`${k}.mtu`, `${Side}: logical-port MTU must be a positive whole number no greater than 9800 bytes.`);
    if (s.role === 'ENNI' && (s.untagged || s.allTags)) err(`${k}.role`, `${Side}: an ENNI can NOT be Untagged/AllTags.`);
    if (s.port === 'LAG' && blank(s.lagName)) err(`${k}.lagName`, `${Side}: Logical Port is LAG, so a LAG name is required.`);
    else if (s.port === 'LAG') info(`${k}.lagName`, `${Side}: using LAG '${s.lagName}' as the logical port.`);
    if (classified(s)) {
      if (!v.ranges.length) err(`${k}.vlan`, `${Side}: enter VLAN IDs from 1-4094 as a single ID, ascending range, or comma-separated list.`);
    } else if (s.role === 'UNI') info(`${k}.vlan`, `${Side}: VLAN is unused when Untagged/AllTags is set.`);
    if (['push-vid', 'stamp-vid-value'].includes(v.egOp) && (!v.ranges.length || multiVlan(v.ranges)))
      err(`${k}.vlan`, `${Side}: the egress ${v.egOp} operation requires a single VLAN ID. Enter one VLAN or choose an egress operation that does not set a fixed VLAN ID.`);
    if (inp.device !== DEVICE_392X) info(`${k}.role`, s.role === 'UNI' ? `${Side}: UNI performs no L2 transforms on this device type.` : `${Side}: ENNI pushes/pops the transport outer tag (SVLAN).`);
    if (s.l2cp) info(`${k}.l2cp`, `${Side}: L2CP profile '${inp.l2cpProfile}' must already exist on the node (see the FWD_ALL sample).`);
    if (inp.device === DEVICE_392X) {
      if (!disabled(s.pfg))
        err(`${k}.pfg`, `${Side}: 392x does not support this builder's root/leaf FD PFG profile. Disable PFG; 392x logical-port group policies require separate configuration.`);
      if (v.inOp === 'push-vid' && s.ingressTpid !== 'tpid-8100')
        err(`${k}.ingressTpid`, `${Side}: 392x ingress push supports TPID 0x8100 only. This restriction does not apply to all TPID operations.`);
      if (v.egOp === 'push-vid')
        err(`${k}.egressOp`, `${Side}: 392x cannot use egress PUSH on a flow point whose FD has a VLAN. Use the supported pop/stamp/no-op operation for the service.`);
    }
  }
  if (l.role === 'UNI' && r.role === 'UNI' && (l.untagged !== r.untagged || l.allTags !== r.allTags ||
      (classified(l) && classified(r) && vlanLabel(L.ranges) !== vlanLabel(R.ranges))))
    err('right.vlan', 'For UNI to UNI, VLANs, Untagged and AllTags must match on both sides.');
  if (l.pfg === 'leaf' && r.pfg === 'leaf') warn('left.pfg', 'PFG: at least one flow point should be root.');
  else if (disabled(r.pfg) && !disabled(l.pfg)) warn('right.pfg', "PFG: configure the Right flow point's PFG as well.");
  else if (disabled(l.pfg) && !disabled(r.pfg)) warn('left.pfg', "PFG: configure the Left flow point's PFG as well.");
  if (inp.device !== DEVICE_392X && (!disabled(l.pfg) || !disabled(r.pfg)))
    warn('left.pfg', "PFG requires an existing default-pfg-profile with leaf-and-root forwarding semantics. Verify the shared profile before applying; this builder does not create or modify it.");
  if (inp.device === DEVICE_392X && !/^\d+$/.test(String(inp.fdSvlan).trim())) err('fdSvlan', 'FD SVLAN must be a number (392x).');
  if (!/^[A-Za-z0-9_.-]+$/.test(String(inp.serviceName))) err('serviceName', 'Service name: use letters, digits, "_", "-" or "." only.');
  const c = inp.cfm;
  for (const issue of validateCfmOptions(c)) err(issue.field, issue.msg);
  soamWarnings(inp, L, R, warn, info);
  const slmPeriod = c.slmMessagePeriod || MSG_PERIOD[c.slmInterval];
  const availabilityMs = Number(c.slmAvailabilityInterval) * 60 * 1000;
  if (c.enabled && c.slm && Number(slmPeriod) * Number(c.slmFlrMeasurements) * Number(c.slmConsecutiveIntervals) > availabilityMs)
    err('cfm.slmInterval', `SLM message period exceeds the ${c.slmAvailabilityInterval}-minute availability reporting interval: ${c.slmConsecutiveIntervals} consecutive intervals x ${c.slmFlrMeasurements} FLR measurements x message period must fit within ${availabilityMs / 1000} seconds. Select a faster period or adjust the Very advanced availability settings.`);
  if (c.enabled) {
    const mepSide = c.endpoint === 'Left' ? l : r;
    const mepVars = c.endpoint === 'Left' ? L : R;
    if (c.tagged && mepSide.untagged && !mepSide.allTags) err('cfm.tagged', "Disable 'Tagged CFM' if Endpoint is Untagged-only.");
    if (c.tagged && !c.tagVlan && multiVlan(mepVars.ranges))
      warn('cfm.tagVlan', `Tagged CFM uses the lowest VLAN (${mepVars.egVid}) unless you set an Outer VLAN in Very advanced Service OAM.`);
    for (const key of ['localMep', 'remoteMep'])
      if (!/^\d+$/.test(String(c[key])) || Number(c[key]) < 1 || Number(c[key]) > 8191) err(`cfm.${key}`, 'MEP ID must be a whole number from 1 to 8191.');
    for (const p of ['dmm', 'slm']) {
      if (!c[p]) continue;
      const period = Number(c[`${p}MessagePeriod`] || MSG_PERIOD[c[`${p}Interval`]]);
      const periodHundredths = Math.round(period * 100);
      const interval = Number(c[`${p}MeasurementInterval`]) * 60000 * 100;
      const periodField = `cfm.${p}MessagePeriod`;
      if (periodHundredths > 0 && interval % periodHundredths !== 0)
        err(periodField, `${p.toUpperCase()}: message period must divide evenly into the measurement interval.`);
      if (p === 'slm' && periodHundredths > 0) {
        const delta = periodHundredths * Number(c.slmFlrMeasurements);
        if (delta < 100000)
          err('cfm.slmFlrMeasurements', 'SLM probes x message period must produce an availability indicator of at least one second.');
        if (c.slmAccelerate === 'true' && delta < 1000000)
          err('cfm.slmFlrMeasurements', 'Accelerated SLM probes x message period must produce an availability indicator of at least ten seconds.');
        if (delta > 0 && (interval % delta !== 0 || (availabilityMs * 100) % delta !== 0))
          err('cfm.slmFlrMeasurements', 'SLM measurement and availability reporting intervals must both be integral multiples of probes x message period.');
        if (c.slmAccelerate === 'true' && !Object.values(MSG_PERIOD).some(v => Number(v) === period))
          err('cfm.slmMessagePeriod', 'Accelerated SLM requires a standard period: 3.33, 10, 100, 1000, 10000, 60000 or 600000 ms.');
      }
      if (!CCM_INTERVALS.includes(c[`${p}Interval`])) err(`cfm.${p}Interval`, 'Select a supported message interval.');
      if (!/^\d+$/.test(String(c[`${p}FrameSize`])) || Number(c[`${p}FrameSize`]) < 64 || Number(c[`${p}FrameSize`]) > 2000)
        err(`cfm.${p}FrameSize`, `${p.toUpperCase()} frame size must be 64-2000 bytes.`);
      if (!/^\d+$/.test(String(c[`${p}TestId`])) || Number(c[`${p}TestId`]) > 4294967295)
        err(`cfm.${p}TestId`, `${p.toUpperCase()} Test ID must be 0-4294967295.`);
      if (!PRIORITIES.includes(c[`${p}Priority`])) err(`cfm.${p}Priority`, `${p.toUpperCase()} priority must be 0-7.`);
      if (c[`${p}StopType`] === 'relative' && Number(c[`${p}StopTime`]) > 0) {
        const period = Number(c[`${p}MessagePeriod`] || MSG_PERIOD[c[`${p}Interval`]]);
        if (Number(c[`${p}StopTime`]) * 10 < period) err(`cfm.${p}StopTime`, `${p.toUpperCase()}: relative stop duration must be at least one message period.`);
      }
    }
    const md = c.mdId || c.md;
    if (!/^[A-Za-z0-9_.:-]{1,43}$/.test(md)) err('cfm.mdId', 'MD identifier must be a CLI-safe name of 1-43 characters.');
    if (!/^md[0-7]$/.test(md) && c.mdLevel === '') err('cfm.mdLevel', 'Specify an MD level for a custom MD identifier.');
    if (c.enabled) {
      if (!['Left', 'Right'].includes(c.endpoint)) err('cfm.endpoint', 'Select the Left or Right OAM endpoint.');
      if (!['Up', 'Down'].includes(c.direction)) err('cfm.direction', 'Select Up or Down MEP.');
      if (!CCM_INTERVALS.includes(c.ccmInterval)) err('cfm.ccmInterval', 'Select a supported CCM interval.');
      if (!PRIORITIES.includes(c.ccmPriority)) err('cfm.ccmPriority', 'CCM priority must be 0-7.');
      if (!LOWEST_FAULT.includes(c.lowestFault)) err('cfm.lowestFault', 'Select a supported fault priority.');
      const ma = c.maName || (String(inp.serviceName).length === 7 ? `${inp.serviceName}_1` : inp.serviceName);
      if (!/^[A-Za-z0-9_.:-]{1,45}$/.test(ma)) err('cfm.maName', 'MA identifier must be a CLI-safe name of 1-45 characters.');
      const name = String(c.maWireName || ma);
      const binaryName = (value, bytes) => {
        if (value.length === bytes) return true;
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
        return atob(value).length === bytes;
      };
      if (c.maNameType === 'rfc2685-vpn-id' && !binaryName(name, 7))
        err('cfm.maWireName', 'RFC2685 transmitted MA name must contain 7 characters or base64 encoding of 7 bytes.');
      if (c.mdNameType === 'mac-address-and-uint' && !binaryName(String(c.mdWireName || md), 8))
        err('cfm.mdWireName', 'MAC + integer transmitted MD name must contain 8 characters or base64 encoding of 8 bytes.');
      if (c.maNameType === 'character-string' && (name.length === 7 || name.length > 45))
        err('cfm.maWireName', 'MA character-string name must contain 1-6 or 8-45 characters.');
      if (['primary-vid', 'uint16'].includes(c.maNameType) && (!/^\d+$/.test(name) || Number(name) > 65535 || (c.maNameType === 'primary-vid' && (Number(name) < 1 || Number(name) > 4094))))
        err('cfm.maWireName', 'Provide a numeric transmitted MA name for the selected name format.');
      if (c.tagged && !c.tagVlan) {
        if (!mepVars.egVid)
          err('cfm.tagVlan', 'Provide a CFM outer VLAN from 1-4094 for this endpoint.');
      }
    }
    if (c.slm && c.slmAccelerate === 'true' && (Number(c.slmFrameSize) !== 64 || Number(c.slmTestId) !== 1))
      err('cfm.slmAccelerate', 'Accelerated SLM requires a 64-byte frame and Test ID 1; priority is inherited from CCM.');
    if (c.mepStatistics === 'true' && !c.hwAccel)
      err('cfm.mepStatistics', 'Accelerated MEP statistics collection requires HW-accelerated CFM.');
    if (c.staticRemoteMac && c.hwAccel)
      err('cfm.staticRemoteMac', 'Static remote MEP creation is not allowed with an HW-accelerated local MEP. Disable HW acceleration or clear the static remote MAC.');
  }
  if (c.enabled && ['3.33ms', '10ms'].includes(c.ccmInterval) && !c.hwAccel) warn('cfm.hwAccel', 'CCM intervals below 100ms need HW-accelerated CFM.');
  return w;
}

function fixedCosBlock(inp, sideName) {
  const { left: l, right: r } = inp;
  const s = inp[sideName];
  const is392 = inp.device === DEVICE_392X;
  const unused = text => ({ title: 'This section not used', used: false, lines: [text] });
  if (is392 || s.role === 'ENNI') return unused(`# This section not used ${is392 ? "(you selected Device Type '392x' above)." : "(you selected 'ENNI' above)."}`);
  if (!blank(s.frameToCos)) return unused("# This section not used (you entered a custom 'Frame-to-COS Map' below).");
  if (sideName === 'right' && eq(r.fixedCos, l.fixedCos) && l.role === 'UNI') return unused("# This section not used (Right FP's 'Fixed COS' value matches Left FP).");
  if (disabled(s.fixedCos)) return unused('# This section not used (Fixed CoS is disabled).');
  const n = cos8(s.fixedCos), p = `frame-to-cos-maps frame-to-cos-map fixed_${n}`;
  const lines = [`${p} non-conforming-cos ${n} non-conforming-color green`];
  for (let i = 0; i < 8; i++) lines.push(`${p} map-entry pcp${i} pcp ${i} dei disabled cos ${n} color green`);
  for (let i = 0; i < 8; i++) lines.push(`${p} map-entry pcp${i} pcp ${i} dei enabled cos ${n} color yellow`);
  const title = sideName === 'left' ? `Fixed CoS Profile -- Req'ed for${eq(l.fixedCos, r.fixedCos) ? ' both Endpoints' : " 'Left' Endpoint"}` : "Fixed CoS Profile -- Req'ed for 'Right' Endpoint";
  return { title, used: true, lines };
}

function cfmBlock(inp, L, R) {
  const c = inp.cfm;
  const is392 = inp.device === DEVICE_392X;
  const svc = inp.serviceName;
  const ma = blank(c.maName) ? (String(svc).length === 7 ? `${svc}_1` : svc) : c.maName;          // D129
  const md = c.mdId || c.md;
  const mep = `maintenance-domain ${md} maintenance-association ${ma} maintenance-association-end-point ${c.localMep}`;
  const V = c.endpoint === 'Left' ? L : R;
  const fpName = c.mepInterface || V.fp;
  const period = MSG_PERIOD;
  const ccmPri = c.ccmPriority;
  const dmmPri = c.dmmPriority;
  const accel = is392 ? '' : ` accelerate ${c.hwAccel ? 'true' : 'false'}`;
  const global = [`cfm-global-config ${cfmArgs(c, 'global')}`,
    ...Array.from({ length: 8 }, (_, i) => `maintenance-domain md${i} name-type character-string name md${i} md-level ${i} mhf-creation none id-permission chassis`)];
  const mdLevel = c.mdLevel || (/^md[0-7]$/.test(md) ? md.slice(-1) : '');
  const mdConfig = `maintenance-domain ${md} name-type ${c.mdNameType}${c.mdNameType === 'none' ? '' : ` name ${c.mdWireName || md}`} md-level ${mdLevel} mhf-creation ${c.mdMhf} id-permission ${c.mdPermission}`;
  if (/^md[0-7]$/.test(md)) global[Number(md.slice(-1)) + 1] = mdConfig;
  else global.push(mdConfig);
  const target = p => `remote-mep-id ${c[`${p}RemoteMep`] || c.remoteMep}`;
  const session = p => cfmArgs(c, p, [`${p}Operation`, `${p}Version`]);
  const vlan = c.tagVlan || V.egVid;
  const outer = `tpid ${c.tagTpid} vlanid ${vlan}${c.tagPcp ? ` pcp ${c.tagPcp}` : ''}${c.tagDei ? ` dei ${c.tagDei}` : ''}`;
  // Both vtags must exist in the same edit: the YANG list requires exactly two.
  const tagLines = !c.tagged ? ['# unused when enable Tagged CFM (below) disabled']
    : c.tagCount === 'single' ? [`${mep} l2-transform ${outer}`] : [[
      `${mep} l2-transform`,
      `vtags 1 ${outer}`,
      `vtags 2 tpid ${c.innerTpid} vlanid ${c.innerVlan || vlan}${c.innerPcp ? ` pcp ${c.innerPcp}` : ''}${c.innerDei ? ` dei ${c.innerDei}` : ''}`,
      'apply', 'return', 'config',
    ].join('\n')];
  const maPrefix = `maintenance-domain ${md} maintenance-association ${ma}`;
  const config = [
    line('C108', `${maPrefix} name-type ${c.maNameType} name ${c.maWireName || ma} ccm-interval ${c.ccmInterval} ccm-loss-num ${c.ccmLossNum} component-list 1 mhf-creation ${c.maMhf} id-permission ${c.maPermission} fd-name ${svc}`, ['cfm', 'fd'], 'Maintenance association bound to the FD.'),
    line('C109', `${mep} interface ${fpName} direction ${c.direction === 'Up' ? 'up' : 'down'} administrative-state ${c.mepAdmin} ccm-ltm-priority ${ccmPri}${accel}${cfmArgs(c, 'mep', ['mepInterface', 'mepAdmin']) ? ` ${cfmArgs(c, 'mep', ['mepInterface', 'mepAdmin'])}` : ''}`, ['cfm', `fp-${c.endpoint.toLowerCase()}`], 'Local MEP on the selected flow point.'),
    ...(c.staticRemoteMac ? [line('CFM-STATIC-REMOTE', `${maPrefix} remote-mep-config ${c.remoteMep} mac-address ${c.staticRemoteMac} admin-state ${c.staticRemoteAdmin}`, ['cfm'])] : []),
    line('C110', `${mep} continuity-check cci-enabled ${c.cciEnabled} lowest-fault-priority-defect ${c.lowestFault} fng-alarm-time ${c.fngAlarm} fng-reset-time ${c.fngReset}`, ['cfm'], 'Continuity check messages (CCM).'),
    line('C111', !c.dmm ? '# enabled DMM (above) for DMM config'
      : `${mep} delay-measurements delay-measurement-config ${c.dmmSessionId || c.localMep} operation-type ${c.dmmOperation} ${target('dmm')} version ${c.dmmVersion} message-period ${c.dmmMessagePeriod || period[c.dmmInterval] || ''} priority ${dmmPri} frame-size ${c.dmmFrameSize} ${session('dmm')} test-id ${c.dmmTestId}`, ['cfm'], 'Y.1731 delay measurement (latency/jitter).'),
    line('C112', !c.slm ? '# enabled SLM (above) for SLM config'
      : `${mep} loss-measurements loss-measurement-config ${c.slmSessionId || c.localMep} operation-type ${c.slmOperation} ${target('slm')} measurement-type slm version ${c.slmVersion} message-period ${c.slmMessagePeriod || period[c.slmInterval] || ''}${c.slmAccelerate === 'true' ? '' : ` priority ${c.slmPriority} frame-size ${c.slmFrameSize}`} ${session('slm')}${c.slmAccelerate === 'true' ? '' : ` test-id ${c.slmTestId}`}`, ['cfm'], 'Y.1731 synthetic loss measurement.'),
    ...tagLines.map((text, i) => line(i === 0 ? 'C113' : 'CFM-INNER-TAG', text, ['cfm'], 'Tag the CFM frames with the endpoint VLAN.')),
  ];
  const q = `md-id ${md} ma-id ${ma} local-mep-id ${c.localMep}`;
  const show = ['show cfm meps', 'show cfm remote-meps', `show cfm meps ${q}`, `show cfm delay-measurements ${q}`,
    `show cfm delay-measurements ${q} fdr-stats ifdv-stats meas-stats`, `show cfm synthetic-loss-measurement ${q}`,
    `show cfm synthetic-loss-measurement ${q} fl-stats meas-stats avail-stats`];
  return { ma, fpName, global, config, show, nuke: [`no maintenance-d ${md} maintenance-a ${ma}`] };
}

export function generate(raw = {}) {
  const inp = normalize(raw);
  const { left: l, right: r } = inp;
  const is392 = inp.device === DEVICE_392X;
  const L = sideVars(inp, 'left');
  const R = sideVars(inp, 'right');
  const fd = inp.serviceName;                                                           // E75
  const config = [];
  const fixedCosLine = (id, s, v, Side) => line(id,
    disabled(s.fixedCos) ? `# left blank, b/c '${Side}' Fixed CoS disabled`
      : is392 ? `logical-ports logical-port ${v.lp} fixed-cos ${cos8(s.fixedCos)} fixed-color green` : '# left blank, b/c non-392x device selected',
    [`port-${Side.toLowerCase()}`, 'qos'], '392x applies Fixed CoS on the logical port.');
  config.push(fixedCosLine('C12', l, L, 'Left'), fixedCosLine('C13', r, R, 'Right'));
  if (inp.emitMtu) {
    config.push(line('MTU-L', `logical-ports logical-port ${L.lp} mtu ${l.mtu}`, ['port-left'], 'Logical port MTU.'));
    if (L.lp !== R.lp) config.push(line('MTU-R', `logical-ports logical-port ${R.lp} mtu ${r.mtu}`, ['port-right'], 'Logical port MTU.'));
  }
  config.push(line('C14', (!l.untagged && !r.untagged) ? '# left blank, b/c Untagged not enabled (below)'
    : 'classifiers classifier CLASSIFIER_4096 filter-entry classifier:vtag-stack untagged-exclude-priority-tagged true', ['classifier'], 'Classifier matching untagged frames.'));
  config.push(line('C15', (!l.allTags && !r.allTags) ? '# left blank, b/c AllTags not enabled (below)'
    : 'classifiers classifier CLASSIFIER_4097 filter-entry classifier:vtag-stack any vtags 1', ['classifier'], 'Classifier matching any tagged frame.'));
  config.push(line('C16', (l.l2cp || r.l2cp) ? 'classifiers classifier CLASSIFIER_L2cp filter-entry classifier:vtag-stack l2cp-exclude-priority-tagged false'
    : '# left blank, b/c L2CP not enabled (below)', ['classifier'], 'Classifier matching Layer 2 control protocols.'));
  const vlanClassifiers = (id, side, ranges, shared = []) => ranges.length ? ranges.map((range, i) => line(
    i === 0 ? id : `${id}-${i + 1}`,
    `classifiers classifier ${classifierName(range)} filter-entry classifier:vtag-stack vtags 1 vlan-id ${range.min}`
      + (range.max === range.min ? '' : ` vlan-id-max ${range.max}`),
    ['classifier', `classifier-${side}`, ...(shared.includes(classifierName(range)) ? ['classifier-left'] : [])],
    `${side === 'left' ? 'Left' : 'Right'} VLAN classifier.`,
  )) : [line(id, '# left blank, b/c no additional VLAN classifiers are needed')];
  config.push(...vlanClassifiers('C17', 'left', classified(l)
    ? L.ranges.filter(range => !R.classifiers.includes(classifierName(range))) : []));
  config.push(...vlanClassifiers('C18', 'right', classified(r) ? R.ranges : [], L.classifiers));
  config.push(line('C19', `fds fd ${fd} description ${inp.serviceName} mode ${inp.serviceType === 'ELAN' ? 'vpls' : 'vpws'}`
    + ((l.l2cp || r.l2cp) ? ` l2cp-profile ${inp.l2cpProfile}` : '')
    + (is392 ? ` vlan-id ${inp.fdSvlan}` : '')
    + ((disabled(l.pfg) && disabled(r.pfg)) ? '' : ' pfg-profile default-pfg-profile'), ['fd'], 'Forwarding domain: the virtual switch (VPLS) or point-to-point (VPWS) instance.'));
  config.push(line('C20', `fps fp ${L.fp} fd-name ${fd} logical-port ${L.lp} classifier-list-precedence 100 stats-collection on classifier-list ${L.classifiers.join(' ')}`,
    ['fp-left', 'classifier-left', 'port-left', 'fd'], 'Left flow point: binds the logical port + classifier to the FD.'));
  config.push(...transformLines(inp, L, 'left'));
  config.push(extrasLine(inp, l, L, 'left'));
  config.push(line('C24', `fps fp ${R.fp} fd-name ${fd} logical-port ${R.lp} classifier-list-precedence 100 stats-collection on classifier-list ${R.classifiers.join(' ')}`,
    ['fp-right', 'classifier-right', 'port-right', 'fd'], 'Right flow point: binds the logical port + classifier to the FD.'));
  config.push(...transformLines(inp, R, 'right'));
  config.push(extrasLine(inp, r, R, 'right'));
  if (!is392) config.push(line('C28', "# ?? If CLI ERRORS on 'frame-to-cos-map' cfg, you might need to cfg the 'fixed_XX' profile, globally. See the Fixed CoS profiles section.", ['qos']));

  const fpL = L.fp, fpR = R.fp;
  const ettp = (s, v) => s.port === 'LAG' ? `show logical-ports logical-port ${v.lp}` : `show ettps ettp ${s.port} statistics`;
  const show = [
    `show run config | grep ${inp.serviceName}`,
    `show flow-points flow-point ${fpL}`,
    `show flow-points flow-point ${fpR}`,
    ettp(l, L), ettp(r, R),
    inp.serviceType === 'ELAN' ? `show mac-fdbs forwarding-domain ${inp.serviceName}` : '# No MAC Table to view (not supported on ELINE/VPWS service)',
  ];
  const cfm = cfmBlock(inp, L, R);
  const nuke = [
    ...(inp.cfm.enabled ? cfm.nuke : []),
    `no fps fp ${R.fp}`, `no fps fp ${L.fp}`, `no fds fd ${fd}`,
    ...config.filter(entry => !entry.skip && entry.text.startsWith('classifiers classifier '))
      .map(entry => `no classifiers classifier ${entry.text.split(' ')[2]}`),
  ];
  return {
    input: inp,
    vars: { fd, left: L, right: R },
    config, show, nuke, cfm,
    fixedCos: { left: fixedCosBlock(inp, 'left'), right: fixedCosBlock(inp, 'right') },
    diagram: diagram(inp, L, R),
    soam: soamTrail(inp, L, R),
    warnings: warnings(inp, L, R),
  };
}

/** Plain-text config for copy/paste: active lines only (or with skipped lines as comments). */
export function configText(out, { includeSkipped = false, includeCfm = true, wrap = true } = {}) {
  const lines = out.config.filter(l => includeSkipped || !l.skip).map(l => l.text);
  if (includeCfm && out.input.cfm.enabled) lines.push(...out.cfm.config.filter(l => includeSkipped || !l.skip).map(l => l.text));
  return wrap ? ['config', ...lines, 'exit'].join('\n') : lines.join('\n');
}

export const SAMPLE_ONE_TIME = {
  classifiers: [
    'classifiers classifier "CLASSIFIER_4096" filter-entry "classifier:vtag-stack" untagged-exclude-priority-tagged false',
    'classifiers classifier "CLASSIFIER_4097" filter-entry "classifier:vtag-stack" logical-not false vtags "1"',
    'classifiers classifier "CLASSIFIER_L2cp" filter-entry "classifier:vtag-stack" l2cp-exclude-priority-tagged false',
  ],
  l2cp: ['l2cp-profiles l2cp-profile FWD_ALL untagged-cos-policy fixed fixed-cos 40',
    ...['xstp', 'bridge-rsvd-0b0f', 'bridge-rsvd-0c0d', 'garp-block', 'ptp', 'gmrp', 'gvrp', 'all-bridges-block', 'cisco-cdp', 'cisco-dtp',
      'cisco-pagp', 'cisco-udld', 'cisco-vtp', 'cisco-stp-uplink-fast', 'cisco-vlan-bridge', 'port-auth', 'e-lmi', 'lldp', 'ptp-peer-delay',
      'bridge-block', 'is-is', 'lacp', 'lamp', 'link-oam', 'esmc']
      .map(p => `l2cp-profiles l2cp-profile FWD_ALL protocol-disposition ${p} untagged-disposition forward`)],
  meters: [
    'meter-profiles meter-profile BP_PROFILE_1 cir 100000 eir 900000 cbs 128 ebs 1280',
    'meter-profiles meter-profile BP_PROFILE_2 cir 200000 eir 1800000 cbs 250 ebs 2500',
    'meter-profiles meter-profile BP_PROFILE_3 cir 300000 eir 2700000 cbs 375 ebs 4000',
    'meter-profiles meter-profile BP_PROFILE_5 cir 500000 eir 4500000 cbs 625 ebs 4000',
    'meter-profiles meter-profile BP_PROFILE_10 cir 1000000 eir 9000000 cbs 1280 ebs 4000',
    'meter-profiles meter-profile BP_PROFILE_9.9 cir 9900000 cbs 4000',
  ],
};
