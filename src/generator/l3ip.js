export const PLATFORMS = [
  'SAOS10 (392x)',
  'SAOS10 (3931, 394x, 398x, 51xx, 81xx)',
  'SAOS8 / 6500-S (PKT/eMOTR)',
  'SAOS6',
];

export const defaults = () => ({
  platform: PLATFORMS[1],
  name: 'ip1',
  address: '192.0.2.1',
  prefix: '30',
  port: '8',
  vlan: '1000',
  mtu: '9000',
  priority: '7',
  networkType: 'point-to-point',
  role: 'Data',
  tpid: '8100',
  qinq: false,
  innerVlan: '12',
});

const isName = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(s);
const isIpv4 = s => {
  if (typeof s !== 'string') return false;
  const octets = s.split('.');
  return octets.length === 4 && octets.every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255);
};
const isRange = (v, min, max) => /^\d+$/.test(String(v)) && Number(v) >= min && Number(v) <= max;
const add = (lines, line) => { if (line) lines.push(line); };
export const isLogicalPort = port => typeof port === 'string' && (isName(port) || /^[0-9]+(?:\/[0-9]+)?$/.test(port));

export function generate(input = {}) {
  const v = { ...defaults(), ...input };
  const errors = [];
  const warnings = [];
  const isSaos10 = typeof v.platform === 'string' && v.platform.startsWith('SAOS10');
  const isLoopback = isRange(v.prefix, 32, 32);
  if (!PLATFORMS.includes(v.platform)) errors.push('Select a supported SAOS platform.');
  if (!isName(v.name)) errors.push('Interface name must be 1-32 letters, numbers, dots, underscores or hyphens, and start with a letter or number.');
  if (isSaos10 && isName(v.name) && v.name.length > (isLoopback ? 15 : 11))
    errors.push(isLoopback ? 'SAOS10 loopback names must be 15 characters or fewer.'
      : 'SAOS10 interface names must be 11 characters or fewer so the generated int_<name> stays within the 15-character device limit.');
  if (!isIpv4(v.address)) errors.push('Enter a valid IPv4 address.');
  if (!isRange(v.prefix, 0, 32)) errors.push('Prefix length must be between 0 and 32.');
  if (!['Data', 'Management'].includes(v.role)) errors.push('Select Data or Management for the interface role.');
  if (!isSaos10 && v.role === 'Management') errors.push('Management role selection is supported only for SAOS10. Select Data for SAOS6/8.');
  const result = { input: v, errors, warnings, config: [], show: [], remove: [] };
  if (isLoopback) {
    if (errors.length) return result;
    if (isSaos10) {
      result.config = [
        'config',
        `oc-if:interfaces interface ${v.name} config name ${v.name}${v.role === 'Management' ? ' role cn-if:management' : ''} cn-if:type loopback`,
        `oc-if:interfaces interface ${v.name} ipv4 addresses address ${v.address} config ip ${v.address} prefix-length 32`,
      ];
      result.show = [`show run config | grep ${v.name}`, 'show ip interface brief', `show ip interfaces interface ${v.name}`, 'show ip route'];
      result.remove = ['config', `no oc-if:interfaces interface ${v.name}`, 'exit'];
    } else {
      result.config = [`interface create loopback ${v.name} ip ${v.address}`];
      result.show = [`config search string ${v.name}`, 'interface show', 'ip fib show'];
      result.remove = [`interface delete ip-interface ${v.name}`];
    }
    return result;
  }
  if (!isLogicalPort(v.port)) errors.push('Enter a logical port such as 8 or 1/1.');
  if (!isRange(v.vlan, 0, 4094)) errors.push('VLAN must be 0 (untagged) or between 1 and 4094.');
  if (!isRange(v.mtu, 576, isSaos10 ? 9700 : 9216)) errors.push(`MTU must be between 576 and ${isSaos10 ? 9700 : 9216}.`);
  if (!isRange(v.priority, 0, 7)) errors.push('Priority must be between 0 and 7.');
  if (!['broadcast', 'point-to-point'].includes(v.networkType)) errors.push('Select broadcast or point-to-point network type.');
  if (isSaos10 && isRange(v.prefix, 0, 32)) {
    const prefix = Number(v.prefix);
    if (v.platform === PLATFORMS[1] && prefix < 3)
      warnings.push('Broad IPv4 prefixes can overlap multiple networks. Verify address scope and supported prefix lengths on the target platform.');
    if (prefix === 31 && v.networkType === 'broadcast')
      errors.push('SAOS10 /31 subnets require network type point-to-point. Broadcast interfaces need a prefix of 30 or shorter.');
    else if (prefix <= 30 && isIpv4(v.address)) {
      const address = v.address.split('.').reduce((n, octet) => n * 256 + Number(octet), 0);
      const host = address % (2 ** (32 - prefix));
      if (host === 0 || host === 2 ** (32 - prefix) - 1)
        errors.push('Use a host IPv4 address, not the subnet network or broadcast address.');
    }
  }
  if (!['8100', '88a8', '9100'].includes(v.tpid)) errors.push('Select a supported TPID: 8100, 88a8 or 9100.');
  if (typeof v.qinq !== 'boolean') errors.push('Select whether dual-tag / QinQ is enabled.');
  if (v.qinq && !isRange(v.innerVlan, 1, 4094)) errors.push('QinQ inner VLAN must be between 1 and 4094.');

  const newer = v.platform === PLATFORMS[1];
  if (v.qinq && (!newer || Number(v.vlan) === 0)) errors.push('This builder supports QinQ only on SAOS10 3931/394x/398x/51xx/81xx platforms with a nonzero outer VLAN.');
  if (Number(v.mtu) > 9216 && !isSaos10) warnings.push('MTU exceeds the generation limit for non-SAOS10 platforms.');
  if (errors.length) return result;

  const name = v.name;
  const vlan = Number(v.vlan);
  const inner = Number(v.innerVlan);
  const priority = Number(v.priority);
  const mtu = Number(v.mtu);
  const tpid = v.tpid;
  const prefix = Number(v.prefix);
  const tagged = vlan !== 0;
  const classifier = v.qinq ? `CLASSIFIER_${vlan}:${inner}` : tagged ? `CLASSIFIER_${vlan}` : 'CLASSIFIER_4096';
  const match = v.qinq
    ? `classifiers classifier ${classifier} filter-entry classifier:vtag-stack vtags 2 vlan-id ${inner}`
    : tagged
      ? `classifiers classifier ${classifier} filter-entry classifier:vtag-stack vtags 1 vlan-id ${vlan}`
      : 'classifiers classifier CLASSIFIER_4096 filter-entry classifier:vtag-stack untagged-exclude-priority-tagged true';

  if (v.platform.startsWith('SAOS10')) {
    const intName = `int_${name}`;
    const fd = `fd_${name}`;
    const fp = `fp${v.port}_${name}`;
    result.config.push('config');
    add(result.config, match);
    add(result.config, `fds fd ${fd} mode vpls${v.platform === PLATFORMS[0] && tagged ? ` vlan-id ${vlan}` : ''}`);
    if (v.qinq || (v.platform === PLATFORMS[0] && tagged)) {
      result.config.push(`fds fd ${fd} initiate-l2-transform vlan-stack 1${priority < 7 ? ` push-pcp pcp-${priority}` : ''}${!v.qinq && tpid !== '8100' ? ` push-tpid tpid-${tpid}` : ''} push-vid ${v.qinq ? inner : vlan}`);
    }
    result.config.push(`oc-if:interfaces interface ${intName} config name ${intName}${mtu !== 1500 ? ` mtu ${mtu}` : ''} admin-status true${v.role === 'Management' ? ' role management' : ''}${v.networkType === 'point-to-point' ? ' type point-to-point' : ''} underlay-binding config fd ${fd}`);
    result.config.push(`oc-if:interfaces interface ${intName} ipv4 addresses address ${v.address} config ip ${v.address} prefix-length ${prefix}`);
    result.config.push(`fps fp ${fp} fd-name ${fd} logical-port ${v.port} classifier-list-precedence 7 stats-collection on classifier-list ${classifier}`);
    if (v.platform !== PLATFORMS[0] && tagged) {
      result.config.push(`fps fp ${fp} ingress-l2-transform pop${vlan} vlan-stack 1 pop-type`);
      result.config.push(`fps fp ${fp} egress-l2-transform push${vlan} vlan-stack 1${priority < 7 ? ` push-pcp pcp-${priority}` : ''}${tpid !== '8100' ? ` push-tpid tpid-${tpid}` : ''} push-vid ${vlan}`);
    }
    result.show = [
      `show run config | grep ${name}`,
      'show ip interface brief',
      `show ip interfaces interface ${intName}`,
      `show flow-points flow-point ${fp}`,
      `show ettps ettp ${v.port} statistics`,
      `show mac-fdbs forwarding-domain ${fd}`,
      'show ip route',
    ];
    result.remove = [
      'config',
      `no fps fp ${fp}`,
      `no oc-if:interfaces interface ${intName}`,
      `no fds fd ${fd}`,
      `no classifiers classifier ${classifier}`,
      'exit',
    ];
  } else if (v.platform.startsWith('SAOS8')) {
    const vs = `vs_${name}`;
    const intName = `int_${name}`;
    const cpu = `cpu_${name}`;
    const subport = `subport_${name}`;
    result.config.push(`virtual-switch create vs ${vs}`);
    result.config.push(`interface create ip-interface ${intName} ip ${v.address}/${prefix} vs ${vs}${v.networkType === 'point-to-point' ? ' network-type point-to-point' : ''}${mtu > 1500 ? ` mtu ${mtu}` : ''}`);
    result.config.push(`cpu-interface sub-interface create cpu-subinterface ${cpu}${tagged ? ` cpu-egress-l2-transform push-${tpid}.34.${priority}` : ''}`);
    result.config.push(`virtual-switch interface attach cpu-subinterface ${cpu} vs ${vs}`);
    result.config.push(`sub-port create sub-port ${subport} parent-port ${v.port} classifier-precedence 1001`);
    result.config.push(`sub-port add sub-port ${subport} class-element 1 ${tagged ? `vtag-stack ${vlan}` : 'vlan-untagged-data'}`);
    result.config.push(`virtual-switch interface attach sub-port ${subport} vs ${vs}`);
    result.show = [`config search string ${name}`, ...(tagged ? [`config search string ${vlan}`] : []), 'interface show', `interface show ip-interface ${intName}`, `ip aib show ip-interface ${intName}`, 'ip fib show'];
    result.remove = [`interface delete ip-interface ${intName}`, `virtual-switch interface detach sub-port ${subport}`, `sub-port delete sub-port ${subport}`, `virtual-switch interface detach cpu-subinterface ${cpu}`, `cpu-interface sub-interface delete cpu-subinterface ${cpu}`, `virtual-switch delete ${vs}`];
  } else {
    result.config.push(`vlan create vlan ${vlan}`);
    result.config.push(`interface create ip-interface ${name} ip ${v.address}/${prefix}${mtu > 1500 ? ` mtu ${mtu}` : ''} ip-forwarding on vlan ${vlan}${priority < 7 ? ` priority ${priority}` : ''}${v.networkType === 'point-to-point' ? ' network-type point-to-point' : ''}`);
    result.config.push(`vlan add vlan ${vlan} port ${v.port}`);
    if (tagged && tpid !== '8100') result.config.push(`vlan set vlan ${vlan} egress-tpid ${tpid}`);
    result.show = [`config search string ${name}`, ...(tagged ? [`config search string ${vlan}`] : []), 'interface show', `interface show ip-interface ${name}`, `ip aib show ip-interface ${name}`, 'ip fib show'];
    result.remove = [`interface delete ip-interface ${name}`, `vlan remove vlan ${vlan} port ${v.port}`, `vlan delete vlan ${vlan}`];
  }
  return result;
}
