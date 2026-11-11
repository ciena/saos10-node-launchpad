/* Workbook field schema for the L2 EVC builder, shared by every React form layout.
 * Labels, hints and "typical" values come from the NID L2 EVCs tab (columns B/C, E/F). */
import * as G from '../generator/l2evc.js';

const yes = { type: 'check' };
const sel = options => ({ type: 'select', options });

// path: dotted key into the generator input. tier: basic | advanced. side: left/right templated with {S}.
export const SERVICE_FIELDS = [
  { path: 'serviceName', label: 'Service Name', type: 'text', tier: 'basic', cell: 'D2', hint: 'Used for FD name and part of FP and CFM names.' },
  { path: 'device', label: 'Device Type', ...sel(G.DEVICE_TYPES), tier: 'basic', cell: 'D3',
    hint: s => s.device === G.DEVICE_392X ? '392x uses an FD SVLAN, and often transforms on UNI.' : undefined },
  { path: 'fdSvlan', label: "FD's SVLAN", type: 'text', tier: 'basic', cell: 'D10', hint: '392x only: the VLAN the FD switches on.', when: s => s.device === G.DEVICE_392X },
  { path: 'serviceType', label: 'Service Type', ...sel(G.SERVICE_TYPES), tier: 'advanced', cell: 'D48', typical: 'ELAN', hint: 'ELAN = VPLS FD (MAC learning).\nELINE = VPWS FD (point-to-point).\nIf unsure, select ELAN.' },
  { path: 'emitMtu', label: 'Include logical-port MTU lines', ...yes, tier: 'advanced', typical: false, hint: 'Max = 9800 Bytes. If <10.9.0, max = 9216.' },
];

export const SIDE_BASIC = [
  { key: 'role', label: 'Endpoint Role', ...sel(G.ROLES), tier: 'basic', hint: 'UNI = customer-facing.\nENNI = network-facing with S-VLAN.' },
  { key: 'port', label: 'Logical Port', ...sel(G.PORTS), tier: 'basic' },
  { key: 'lagName', label: 'LAG Name', type: 'text', tier: 'basic', when: s => s.port === 'LAG', hint: 'Logical port name when Logical Port is LAG.' },
  { key: 'vlan', label: 'VLAN', type: 'text', tier: 'basic' },
  { key: 'allTags', label: 'All Tags', ...yes, tier: 'basic', when: s => s.role !== 'ENNI' },
  { key: 'untagged', label: 'Untagged', ...yes, tier: 'basic', typical: false, hint: 'For an EPL UNI flow point, enable Untagged and All Tags.', when: s => s.role !== 'ENNI' },
];

export const SIDE_ADVANCED = [
  { key: 'l2cp', label: 'Enable L2CP?', ...yes, tier: 'advanced', typical: false, hint: 'Typically only used on EPL UNI endpoints.', when: s => s.role !== 'ENNI' },
  { key: 'meter', label: 'Meter-Profile', type: 'text', tier: 'advanced', typical: '', hint: 'Leave blank to not police. See the BP_PROFILE_1 (and other) samples.', group: 'qos' },
  { key: 'fixedCos', label: 'Fixed CoS', ...sel(G.FIXED_COS), tier: 'advanced', typical: '(disabled)', hint: 'Typical value is 5 when used.', group: 'qos' },
  { key: 'frameToCos', label: 'Frame-to-CoS Map', type: 'text', tier: 'advanced', typical: '', hint: 'Custom map name. Blank uses fixed_<CoSx8>.', group: 'qos' },
  { key: 'cosToFrame', label: 'CoS-to-Frame Map', type: 'text', tier: 'advanced', typical: '', hint: "If blank, 'default-c2f'.", group: 'qos' },
  { key: 'mapPolicy', label: 'MAP Policy', ...sel(G.MAP_POLICIES), tier: 'advanced', typical: '(none)', group: 'qos' },
  { key: 'pfg', label: 'Private Fwd Group (PFG)', ...sel(G.PFG), tier: 'advanced', typical: '(disabled)', hint: 'Root/leaf isolation requires a leaf-and-root profile.', group: 'qos' },
  { key: 'ingressOp', label: 'Ingress L2 operation', ...sel(['', ...G.VLAN_OPS]), tier: 'advanced', typical: '', auto: 'inOpAuto', hint: 'Automatic based on device type and role.', group: 'tags' },
  { key: 'ingressTpid', label: 'Ingress TPID', ...sel(G.TPIDS), tier: 'advanced', typical: 'tpid-8100', group: 'tags' },
  { key: 'egressOp', label: 'Egress L2 operation', ...sel(['', ...G.VLAN_OPS]), tier: 'advanced', typical: '', auto: 'egOpAuto', hint: 'Automatic based on device type and role.', group: 'tags' },
  { key: 'egressTpid', label: 'Egress TPID', ...sel(G.TPIDS), tier: 'advanced', typical: 'tpid-8100', group: 'tags' },
];

export const CFM_BASIC = [
  { path: 'cfm.endpoint', label: 'Apply to which endpoint?', ...sel(['Left', 'Right']), tier: 'basic', when: s => s.cfm.enabled },
  { path: 'cfm.localMep', label: 'Local MEP ID', type: 'text', tier: 'basic', when: s => s.cfm.enabled, hint: "Must match the far end's Remote MEP ID." },
  { path: 'cfm.remoteMep', label: 'Remote MEP ID', type: 'text', tier: 'basic', when: s => s.cfm.enabled, hint: "Must match the far end's Local MEP ID." },
  { path: 'cfm.dmm', label: 'Enable Y.1731 DMM?', ...yes, tier: 'basic', when: s => s.cfm.enabled, hint: 'Measures delay (latency/jitter).' },
  { path: 'cfm.slm', label: 'Enable Y.1731 SLM?', ...yes, tier: 'basic', when: s => s.cfm.enabled, hint: 'Measures loss (outage duration).' },
];

const on = s => s.cfm.enabled;
export const CFM_ADVANCED = [
  { path: 'cfm.maName', label: 'MA Name (custom)', type: 'text', typical: '', hint: 'Blank uses the Service Name (+"_1" if it is 7 characters).' },
  { path: 'cfm.md', label: 'MD Name', ...sel(['md0', 'md1', 'md2', 'md3', 'md4', 'md5', 'md6', 'md7']), typical: 'md3', hint: 'md3 is most common and reusable, but the global MD must exist.' },
  { path: 'cfm.direction', label: 'Up or Down MEP', ...sel(['Up', 'Down']), typical: 'Up', hint: "Typically 'Up' on a UNI and 'Down' on an ENNI." },
  { path: 'cfm.hwAccel', label: 'HW-accelerated?', ...yes, typical: false, hint: 'SW-based has more stats but lower scale. Required below 100 ms.' },
  { path: 'cfm.ccmInterval', label: 'CCM Interval', ...sel(G.CCM_INTERVALS), typical: '1s' },
  { path: 'cfm.ccmPriority', label: 'CCM Priority', ...sel(G.PRIORITIES), typical: '3' },
  { path: 'cfm.lowestFault', label: 'Lowest Fault Priority', ...sel(G.LOWEST_FAULT), typical: 'remote-mac-error' },
  { path: 'cfm.tagged', label: 'Tagged CFM', ...yes, typical: true },
  { path: 'cfm.dmmInterval', label: 'DMM Interval', ...sel(G.CCM_INTERVALS), typical: '1s', when: s => s.cfm.dmm },
  { path: 'cfm.dmmPriority', label: 'DMM Priority', ...sel(G.PRIORITIES), typical: '3', when: s => s.cfm.dmm },
  { path: 'cfm.dmmFrameSize', label: 'DMM Frame Size', type: 'text', typical: '64', when: s => s.cfm.dmm },
  { path: 'cfm.dmmTestId', label: 'DMM Test ID', type: 'text', typical: '4', when: s => s.cfm.dmm },
  { path: 'cfm.slmInterval', label: 'SLM Interval', ...sel(G.CCM_INTERVALS), typical: '1s', when: s => s.cfm.slm },
  { path: 'cfm.slmPriority', label: 'SLM Priority', ...sel(G.PRIORITIES), typical: '3', when: s => s.cfm.slm && s.cfm.slmAccelerate !== 'true' },
  { path: 'cfm.slmFrameSize', label: 'SLM Frame Size', type: 'text', typical: '64', when: s => s.cfm.slm, hint: 'Accelerated SLM fixes this at 64 bytes; no frame-size override is emitted.' },
  { path: 'cfm.slmTestId', label: 'SLM Test ID', type: 'text', typical: '4', when: s => s.cfm.slm, hint: 'Accelerated SLM fixes this at 1; no Test ID override is emitted.' },
].map(f => ({ ...f, tier: 'advanced', when: f.when ? (s => on(s) && f.when(s)) : on }));

export const GROUP_TITLES = { qos: 'QoS & policing', tags: 'VLAN tag operations', port: 'Port' };

export const sideFields = (side, list) => list.map(f => ({ ...f, path: `${side}.${f.key}`, side, when: f.when ? (s => f.when(s[side])) : undefined }));

export const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
export function set(obj, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((o, k) => (o[k] ??= {}), obj)[last] = v;
}
