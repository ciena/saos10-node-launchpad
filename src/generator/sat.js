export const PLATFORMS = ['SAOS10', 'SAOS8', 'SAOS6'];
export const TEST_TYPES = ['throughput', 'latency', 'pdv', 'frameloss'];
export const BENCHMARK_TYPES = ['standard', 'rfc2544', 'y1564', 'outage'];
export const EMIX_SEQUENCES = {
  y1564: 'abceg',
  'y1564-v6': 'vbceg',
  'y1564-qinq-v4': 'wbceg',
  'y1564-qinq-v6': 'xbceg',
  simple: 'aaaaaaauuuugg',
  'simple-v6': 'vvvvvvvuuuugg',
  'simple-qinq-v4': 'wwwwwwwuuuugg',
  'simple-qinq-v6': 'xxxxxxxuuuugg',
  firewall: 'g',
  tcp: 'bbbbbbbuuuugg',
  ipv6: 'vvvvvvduuuugg',
  'ipv6-qinq': 'xxxxxxduuuugg',
};
/** @param {string} name */
export const emixPattern = name => Object.entries(EMIX_SEQUENCES).find(([key]) => key === name)?.[1] ?? '';
const LEGACY_TEST_TYPES = ['throughput', 'latency', 'frameloss', 'pdv'];

export const defaults = () => ({
  name: 'evpl-ImOn-v1337',
  vlan: '1337',
  encapType: 'dot1Q',
  sVlan: '101',
  generatorPlatform: 'SAOS10',
  generatorFlowPoint: 'XXXX',
  generatorPort: '6',
  reflectorMac: '02:00:00:00:00:01',
  reflectorPlatform: 'SAOS10',
  reflectorFlowPoint: 'YYYY',
  reflectorPort: '6',
  mode: 'in-service',
  duration: 'Once',
  customDuration: '15',
  bandwidth: '500',
  frameSizes: '64,128,9000',
  outageFrameSize: '64',
  testTypes: [...TEST_TYPES],
  benchmarkType: 'standard',
  resultMode: 'transport',
  thirdParty: false,
  generatorIp: '192.0.2.1',
  reflectorIp: '192.0.2.2',
  maxSearches: '1',
  satMaxSearches: '16',
  maxSamples: '10',
  samplingInterval: '1',
  interval: 'tCompletion',
  framelossStartBandwidth: 'maximum-throughput',
  excessBandwidth: '0',
  pduType: 'ip',
  kpiProfileName: 'CLI_no_loss_saos10',
  macValidation: true,
  pcpValidation: true,
  colorValidation: true,
  vidValidation: true,
  color: 'green',
  tpid: '0x8100',
  dscp: '0',
  priorityCodePoints: ['pcp4'],
  customPayload: 'Ciena SAT payload',
  bwAllocProfile: '',
  emixSequence: 'y1564',
  customFrameMix: 'abceg',
  customEmixSize: '9000',
  generatorHFrameSize: '',
  reflectionLevel: 'l2-to-l4',
  outageBandwidth: '1',
  pcp: '4',
});

const safeToken = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,47}$/.test(s);
const isIpv4 = s => {
  if (typeof s !== 'string') return false;
  const octets = s.split('.');
  return octets.length === 4 && octets.every(x => /^\d{1,3}$/.test(x) && Number(x) <= 255);
};
const validPort = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,31}$/.test(s);
const validMac = s => typeof s === 'string' && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(s);
const validInt = (s, min, max) => /^\d+$/.test(String(s)) && Number(s) >= min && Number(s) <= max;
const legacyMode = (mode, platform) => mode === 'evc-out-of-service' && platform === 'SAOS6' ? 'vid-out-of-service' : mode;

function legacyGenerator(v, platform) {
  const p = platform.toLowerCase();
  const gen = `Gen-${v.name}`;
  const profile = `prof-${v.name}`;
  const test = `TestGen-${v.name}-${v.vlan}`;
  const pcp = Number(v.vlan) === 0 ? 'untagged' : `pcp ${v.pcp}`;
  const traffic = LEGACY_TEST_TYPES.filter(t => v.testTypes.includes(t)).join(' ');
  const lines = [
    `benchmark generator kpi-profile create name CLI_no_loss_${p}`,
    `benchmark generator kpi-profile set name CLI_no_loss_${p} ${pcp} throughput-min ${platform === 'SAOS8' ? '0.0010' : '0.0001'} frameloss-max ${platform === 'SAOS8' ? '0.0010' : '0.0001'} latency-max 10 pdv-max 2 max-num-outages 0`,
    `benchmark create generator name ${gen} port ${v.generatorPort}`,
    `benchmark generator set name ${gen} mode ${legacyMode(v.mode, platform)}`,
    `benchmark profile create name ${profile}`,
    `benchmark profile configuration set name ${profile} bandwidth ${v.bandwidth}`,
    `benchmark profile configuration set name ${profile} interval completion`,
    `benchmark profile configuration set name ${profile} duration ${v.duration}`,
    `benchmark profile configuration set name ${profile} frame-size-list ${v.frameSizes}`,
    `benchmark profile configuration set name ${profile} max-bw-search ${v.maxSearches}`,
    `benchmark profile configuration set name ${profile} kpi-profile CLI_no_loss_${p}`,
    `benchmark profile traffic set name ${profile}${traffic ? ` ${traffic}` : ''}`,
    `benchmark profile payload set name ${profile} dst-mac ${v.reflectorMac}`,
    `benchmark profile payload set name ${profile} pdu-type ip`,
  ];
  if (v.generatorIp) lines.push(`benchmark profile payload set name ${profile} ip-src-addr ${v.generatorIp}`);
  if (v.reflectorIp) lines.push(`benchmark profile payload set name ${profile} ip-dest-addr ${v.reflectorIp}`);
  if (Number(v.vlan) !== 0) {
    lines.push(`benchmark profile payload set name ${profile} vlan-encap-type dot1q`);
    lines.push(`benchmark profile payload set name ${profile} c-pcp ${v.pcp}`);
  }
  if (platform === 'SAOS6') lines.push(`benchmark profile enable name ${profile}`);
  lines.push(`benchmark test create name ${test} profile ${profile}${Number(v.vlan) === 0 ? '' : ` vtag-stack ${v.vlan}`}${platform === 'SAOS8' ? ` sub-port ${v.generatorFlowPoint}` : ''}`);
  lines.push('benchmark enable');
  lines.push(`benchmark generator enable name ${gen}`, `benchmark test enable name ${test}`, 'config save');
  return lines;
}

function legacyReflector(v, platform) {
  const ref = `Ref-${v.name}`;
  const test = `TestRef-${v.name}-${v.vlan}`;
  const lines = [
    `benchmark create reflector name ${ref} port ${v.reflectorPort}`,
    `benchmark reflector set name ${ref} mode ${legacyMode(v.mode, platform)}${v.thirdParty ? ' vendor-type other mac-validation off' : ''}`,
    `benchmark test create name ${test}${platform === 'SAOS8' ? ` sub-port ${v.reflectorFlowPoint}` : ''}${Number(v.vlan) === 0 ? ' vlan-untagged-data' : ` vtag-stack ${v.vlan}`}`,
    'benchmark enable',
    `benchmark reflector enable name ${ref}`,
    `benchmark test enable name ${test}`,
    'config save',
  ];
  return lines;
}

function satGenerator(v) {
  const name = v.name;
  const vlan = Number(v.vlan);
  const types = new Set(v.testTypes);
  const profile = `prof_${name}`;
  const instance = `sat_${name}`;
  const customEmix = v.benchmarkType === 'y1564' && v.emixSequence === 'Custom';
  const emixName = customEmix ? `emix_${name}` : v.emixSequence;
  const special = v.benchmarkType !== 'standard';
  const encap = vlan === 0 ? 'untagged' : v.encapType;
  const pcpValues = [...v.priorityCodePoints];
  const pcpBits = pcpValues.join(' ');
  const flags = LEGACY_TEST_TYPES
    .filter(t => types.has(t)).map(t => `${t}-test true`).join(' ');
  const addresses = v.generatorIp && v.reflectorIp ? `src-addr ${v.generatorIp} dst-addr ${v.reflectorIp} ` : '';
  const defaultInput = defaults();
  const hasExtendedSettings = special
    || v.duration === 'Custom'
    || encap !== 'dot1Q'
    || v.sVlan !== defaultInput.sVlan
    || v.pduType !== defaultInput.pduType
    || v.kpiProfileName !== defaultInput.kpiProfileName
    || v.macValidation !== defaultInput.macValidation
    || v.pcpValidation !== defaultInput.pcpValidation
    || v.colorValidation !== defaultInput.colorValidation
    || v.vidValidation !== defaultInput.vidValidation
    || v.color !== defaultInput.color
    || v.tpid !== defaultInput.tpid
    || v.dscp !== defaultInput.dscp
    || pcpBits !== defaultInput.priorityCodePoints.join(' ')
    || v.customPayload !== defaultInput.customPayload
    || v.bwAllocProfile !== defaultInput.bwAllocProfile
    || v.emixSequence !== defaultInput.emixSequence
    || v.interval !== defaultInput.interval
    || v.maxSamples !== defaultInput.maxSamples
    || v.samplingInterval !== defaultInput.samplingInterval
    || v.framelossStartBandwidth !== defaultInput.framelossStartBandwidth
    || v.excessBandwidth !== defaultInput.excessBandwidth;
  const duration = special && v.benchmarkType === 'outage'
    ? 'tIndefinite'
    : v.duration === 'Custom' ? 'tCustom' : `t${v.duration}`;
  const bandwidth = v.benchmarkType === 'outage' ? v.outageBandwidth : v.bandwidth;
  const specialFlags = {
    rfc2544: 'rfc2544-suite true',
    y1564: 'y1564-suite true',
    outage: 'outage-test true',
  };
  let profileSettings;
  if (!hasExtendedSettings) {
    profileSettings = `bandwidth ${v.bandwidth} excess-bandwidth ${v.bandwidth} max-searches ${v.maxSearches} kpi-profile-name CLI_no_loss_saos10 duration t${v.duration} dst-mac ${v.reflectorMac}${vlan === 0 ? '' : ` encap-type dot1Q c-pcp pcp${v.pcp} c-vid ${vlan}`} dscp 0 ${addresses}${flags} tput-bw-calculation-mode ${v.resultMode} frmloss-bw-calculation-mode ${v.resultMode} frame-size ${v.frameSizes.split(',').join(' ')}`;
  } else {
    const tagSettings = encap === 'untagged' ? 'encap-type untagged'
      : encap === 'qinq'
        ? `encap-type qinq tpid ${v.tpid} s-vid ${v.sVlan} s-pcp "${pcpBits}" s-color ${v.color} c-vid ${vlan} c-pcp "${pcpBits}" c-color ${v.color}`
        : `encap-type dot1Q tpid ${v.tpid} c-pcp "${pcpBits}" c-color ${v.color} c-vid ${vlan}`;
    const validationSettings = [
      `source-mac-validation ${v.macValidation}`,
      `pcp-validation ${v.pcpValidation}`,
      `color-validation ${v.colorValidation}`,
      `vid-validation ${v.vidValidation}`,
    ].join(' ');
    const optionalSettings = [
      v.bwAllocProfile && `bw-alloc-profile ${v.bwAllocProfile}`,
      v.benchmarkType === 'y1564' && `emix-sequence ${emixName}`,
      v.customPayload && `custom-payload ${encodePayload(v.customPayload)}`,
      v.duration === 'Custom' && v.benchmarkType !== 'outage' && `custom-duration ${v.customDuration}`,
    ].filter(Boolean).join(' ');
    const frameSizes = v.benchmarkType === 'standard' ? `frame-size ${v.frameSizes.split(',').join(' ')}`
      : v.benchmarkType === 'outage' ? `frame-size ${v.outageFrameSize}` : '';
    const searches = v.benchmarkType === 'rfc2544' ? '7'
      : v.benchmarkType === 'standard' ? v.maxSearches : v.satMaxSearches;
    const testFlags = special ? specialFlags[v.benchmarkType] : flags;
    profileSettings = [
      `bandwidth ${bandwidth}`,
      `excess-bandwidth ${v.excessBandwidth}`,
      `max-searches ${searches}`,
      `max-samples ${v.maxSamples}`,
      `sampling-interval ${v.samplingInterval}`,
      `interval ${v.interval}`,
      `kpi-profile-name ${v.kpiProfileName}`,
      `duration ${duration}`,
      `dst-mac ${v.reflectorMac}`,
      tagSettings,
      `pdu-type ${v.pduType}`,
      `dscp ${v.dscp}`,
      addresses.trim(),
      validationSettings,
      testFlags,
      `tput-bw-calculation-mode ${v.resultMode}`,
      `frmloss-bw-calculation-mode ${v.resultMode}`,
      v.framelossStartBandwidth !== 'maximum-throughput' && `frameloss-start-bw ${v.framelossStartBandwidth}`,
      optionalSettings,
      frameSizes,
    ].filter(Boolean).join(' ');
  }
  const kpiTargets = encap === 'untagged' ? ['untagged']
    : pcpValues.map(value => `pcp ${value.slice(3)}`);
  const kpiLines = kpiTargets.map(target =>
    `sat kpi-profile ${v.kpiProfileName} ${target} throughput 1 frameloss 1 latency 10 pdv 2${v.benchmarkType === 'outage' ? ' max-num-outages 0 single-outage-max 1 sum-outages-max 2' : ''}`);
  const instanceTags = encap === 'untagged' ? 'untagged true'
    : encap === 'qinq' ? `s-vid ${v.sVlan} c-vid ${vlan}`
      : `c-vid ${vlan}`;
  return [
    'config',
    'sat sat-global admin-state enabled',
    ...kpiLines,
    ...(customEmix ? [`sat emix-sequence ${emixName} sequence ${v.customFrameMix}${v.customFrameMix.includes('u') ? ` u-frame-size ${v.customEmixSize}` : ''}`] : []),
    `sat test-profile ${profile} ${profileSettings}`,
    `sat entity ${instance} port ${v.generatorPort} role generator mode ${v.mode} admin-state enabled${customEmix && v.customFrameMix.includes('h') && v.generatorHFrameSize !== '' ? ` generator-h-frame-size ${v.generatorHFrameSize}` : ''}`,
    `sat test-instance ${name} flow-point-id ${v.generatorFlowPoint} profile ${profile} ${instanceTags} admin-state enabled`,
    'exit',
  ];
}

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(payload);
  return btoa(String.fromCharCode(...bytes));
}

function satReflector(v) {
  const name = v.name;
  return [
    'config',
    'sat sat-global admin-state enabled',
    `sat entity sat_${name} port ${v.reflectorPort} role reflector reflection-level ${v.reflectionLevel} assoc-gen-vendor-type ${v.thirdParty ? 'other' : 'ciena'} reflector-mac-validation ${v.thirdParty || !v.macValidation ? 'false' : 'true'} mode ${v.mode} admin-state enabled`,
    `sat test-instance ${name} flow-point-id ${v.reflectorFlowPoint} admin-state enabled`,
    'exit',
  ];
}

function generatorRemoval(v, platform) {
  if (platform === 'SAOS10') return [
    'config', 'sat sat-global admin-state disabled',
    `sat test-instance ${v.name} admin-state disabled`,
    `no sat test-instance ${v.name}`,
    `sat entity sat_${v.name} admin-state disabled`,
    `no sat entity sat_${v.name}`,
    `no sat test-profile prof_${v.name}`,
    ...(v.benchmarkType === 'y1564' && v.emixSequence === 'Custom' ? [`no sat emix-sequence emix_${v.name}`] : []),
    `no sat kpi-profile "${v.kpiProfileName}"`, 'exit',
  ];
  const p = platform.toLowerCase();
  const gen = `Gen-${v.name}`;
  const profile = `prof-${v.name}`;
  const test = `TestGen-${v.name}-${v.vlan}`;
  return [
    'benchmark disable',
    `benchmark test disable name ${test}`,
    `benchmark generator disable name ${gen}`,
    ...(platform === 'SAOS8' ? [] : [`benchmark profile disable name ${profile}`]),
    `benchmark test delete name ${test}`,
    ...(platform === 'SAOS8'
      ? [`benchmark generator delete name ${gen} all-test-instances`, `benchmark delete name ${gen}`, `benchmark profile delete name ${profile}`]
      : [`benchmark profile delete name ${profile}`, `benchmark generator delete name ${gen} all-test-instances`, `benchmark delete name ${gen}`]),
    `benchmark generator kpi-profile delete name CLI_no_loss_${p}`,
    'config save',
    'config search string bench',
  ];
}

function reflectorRemoval(v, platform) {
  if (platform === 'SAOS10') return [
    'config', 'sat sat-global admin-state disabled',
    `sat test-instance ${v.name} admin-state disabled`,
    `no sat test-instance ${v.name}`,
    `sat entity sat_${v.name} admin-state disabled`,
    `no sat entity sat_${v.name}`, 'exit',
  ];
  const ref = `Ref-${v.name}`;
  const test = `TestRef-${v.name}-${v.vlan}`;
  return [
    'benchmark disable',
    `benchmark test disable name ${test}`,
    `benchmark reflector disable name ${ref}`,
    `benchmark test delete name ${test}`,
    `benchmark reflector delete name ${ref} all-test-instances`,
    `benchmark delete name ${ref}`,
    'config save',
    'config search string bench',
  ];
}

export function generate(input = {}) {
  const v = { ...defaults(), ...input };
  const errors = [];
  const warnings = [];
  if (!safeToken(v.name)) errors.push('Test name must be 1-48 letters, numbers, dots, underscores or hyphens, and start with a letter or number.');
  if (v.generatorPlatform === 'SAOS10' && typeof v.name === 'string' && v.name.length > 40) {
    errors.push('SAOS10 test names must be 40 characters or fewer so the generated profile and entity names stay within the platform limit.');
  }
  if (!validInt(v.vlan, 0, 4094)) errors.push('Client VLAN must be 0 (untagged) or between 1 and 4094.');
  if (!PLATFORMS.includes(v.generatorPlatform)) errors.push('Select a supported generator platform.');
  if (!PLATFORMS.includes(v.reflectorPlatform)) errors.push('Select a supported reflector platform.');
  if (!validPort(v.generatorPort) || !validPort(v.reflectorPort)) errors.push('Enter a valid logical port for each node.');
  if (v.generatorPlatform === 'SAOS10' && !safeToken(v.generatorFlowPoint)) errors.push('Generator flow-point name contains unsupported characters.');
  if (v.reflectorPlatform === 'SAOS10' && !safeToken(v.reflectorFlowPoint)) errors.push('Reflector flow-point name contains unsupported characters.');
  if (v.generatorPlatform === 'SAOS8' && !safeToken(v.generatorFlowPoint)) errors.push('Generator sub-port name contains unsupported characters.');
  if (v.reflectorPlatform === 'SAOS8' && !safeToken(v.reflectorFlowPoint)) errors.push('Reflector sub-port name contains unsupported characters.');
  if (!validMac(v.reflectorMac)) errors.push('Enter a MAC address in xx:xx:xx:xx:xx:xx format.');
  if (typeof v.thirdParty !== 'boolean') errors.push('Select whether the generator is non-Ciena.');
  if (!['in-service', 'out-of-service', 'evc-out-of-service'].includes(v.mode)) errors.push('Select a supported SAT test mode.');
  if (v.mode === 'out-of-service' && (v.generatorPlatform !== 'SAOS10' || v.reflectorPlatform !== 'SAOS10')) {
    errors.push('Port out-of-service mode is supported only when both endpoints use SAOS10.');
  }
  const supportedDurations = v.generatorPlatform === 'SAOS10'
    ? ['Once', '15min', '1hr', '6hr', '24hr', 'Indefinite', 'Custom']
    : ['Once', '15min', '1hr', 'Indefinite'];
  if (!supportedDurations.includes(v.duration)) errors.push('Select a supported test duration for the generator platform.');
  if (v.duration === 'Custom' && !validInt(v.customDuration, 15, 65535)) errors.push('Custom duration must be between 15 and 65535 minutes.');
  if (!validInt(v.bandwidth, 1, 100000)) errors.push('Bandwidth must be an integer between 1 and 100000 Mbps.');
  const sizes = String(v.frameSizes).split(',').map(s => s.trim());
  const maxFrameSize = v.generatorPlatform === 'SAOS10' ? 16000 : 9216;
  if (v.benchmarkType === 'standard' && (!sizes.length || sizes.length > 10 || sizes.some(s => !validInt(s, 64, maxFrameSize)))) {
    errors.push(`Enter 1-10 comma-separated frame sizes between 64 and ${maxFrameSize} bytes.`);
  }
  if (v.benchmarkType === 'outage' && !validInt(v.outageFrameSize, 64, maxFrameSize)) {
    errors.push(`Enter one outage frame size between 64 and ${maxFrameSize} bytes.`);
  }
  if (!BENCHMARK_TYPES.includes(v.benchmarkType)) errors.push('Select a supported SAT test type.');
  if (!Array.isArray(v.testTypes) || v.testTypes.some(t => !TEST_TYPES.includes(t))
    || (v.benchmarkType === 'standard' && !v.testTypes.length)) errors.push('Select at least one supported test type.');
  if (v.benchmarkType !== 'standard' && v.generatorPlatform !== 'SAOS10') {
    errors.push('RFC2544, Y.1564 and Outage suites require an SAOS10 generator; SAOS6/8 generators cannot run these suites.');
  }
  if (v.generatorPlatform === 'SAOS10' && !['untagged', 'dot1Q', 'qinq'].includes(v.encapType)) errors.push('Select a supported VLAN encapsulation type.');
  if (v.encapType === 'untagged' && v.vlan !== '0') errors.push('Set the VLAN to 0 when VLAN encapsulation is untagged.');
  if (v.encapType === 'qinq' && (!validInt(v.sVlan, 1, 4094) || !validInt(v.vlan, 1, 4094))) {
    errors.push('QinQ requires an S-VLAN and C-VLAN from 1 to 4094.');
  }
  if (!['payload', 'transport'].includes(v.resultMode)) errors.push('Select payload or transport results.');
  if (!validInt(v.maxSearches, 1, v.generatorPlatform === 'SAOS10' ? 16 : 100)) errors.push(`Maximum searches must be an integer between 1 and ${v.generatorPlatform === 'SAOS10' ? 16 : 100}.`);
  if (!validInt(v.satMaxSearches, 1, 16)) errors.push('SAOS10 maximum searches must be an integer between 1 and 16.');
  if (!validInt(v.maxSamples, 2, 20)) errors.push('Maximum samples must be an integer between 2 and 20.');
  if (!validInt(v.samplingInterval, 1, 600)) errors.push('Sampling interval must be an integer between 1 and 600 (100 ms steps).');
  if (!['tCompletion', 't15min', 't1hr', 't2hr', 't6hr'].includes(v.interval)) errors.push('Select a supported test interval.');
  if (!['maximum-throughput', 'profile-bandwidth'].includes(v.framelossStartBandwidth)) errors.push('Select a supported frame-loss starting bandwidth.');
  if (!validInt(v.excessBandwidth, 0, 100000)) errors.push('Excess bandwidth must be an integer between 0 and 100000 Mbps.');
  if (!['ethernet', 'ip', 'udp-echo'].includes(v.pduType)) errors.push('Select a supported PDU type.');
  if (!safeToken(v.kpiProfileName) || v.kpiProfileName.length > 45) errors.push('KPI profile name must be 1-45 letters, numbers, dots, underscores or hyphens.');
  if (typeof v.macValidation !== 'boolean' || typeof v.pcpValidation !== 'boolean'
    || typeof v.colorValidation !== 'boolean' || typeof v.vidValidation !== 'boolean') errors.push('SAT validation options must be enabled or disabled.');
  if (!['green', 'yellow', 'green-yellow', 'green-yellow-red'].includes(v.color)) errors.push('Select a supported test traffic color.');
  if (!['0x8100', '0x88a8', '0x9100'].includes(v.tpid)) errors.push('Select a supported tag protocol identifier.');
  if (!validInt(v.dscp, 0, 63)) errors.push('IP differentiated service code point must be between 0 and 63.');
  if (!Array.isArray(v.priorityCodePoints) || v.priorityCodePoints.some(p => typeof p !== 'string' || !/^pcp[0-7]$/.test(p))
    || new Set(v.priorityCodePoints).size !== v.priorityCodePoints.length) errors.push('Select one or more unique priority code points from PCP 0 to PCP 7.');
  if (Array.isArray(v.priorityCodePoints) && v.generatorPlatform === 'SAOS10'
    && v.encapType !== 'untagged' && !v.priorityCodePoints.length) {
    errors.push('Select at least one priority code point for tagged SAT tests.');
  }
  if (v.benchmarkType === 'rfc2544' && Array.isArray(v.priorityCodePoints) && v.priorityCodePoints.length > 1) {
    errors.push('RFC2544 supports one priority code point per test.');
  }
  if (typeof v.customPayload !== 'string' || new TextEncoder().encode(v.customPayload).length > 256) errors.push('Custom payload must be text no longer than 256 UTF-8 bytes.');
  if (v.bwAllocProfile !== '' && !safeToken(v.bwAllocProfile)) errors.push('PCP bandwidth allocation profile name contains unsupported characters.');
  if (v.benchmarkType === 'y1564' && !safeToken(v.emixSequence)) errors.push('Y.1564 requires a valid configured Ethernet mix profile name.');
  if (v.benchmarkType === 'y1564' && v.emixSequence === 'Custom') {
    if (typeof v.customFrameMix !== 'string' || !/^[abcdefghvwxu]{1,32}$/.test(v.customFrameMix)) {
      errors.push('Frame Size Mix must contain 1-32 lowercase EMIX letters: a-h, v, w, x or u.');
    } else {
      if (v.customFrameMix.length > 16) warnings.push('Sequences longer than 16 frames require a platform supporting 32-frame EMIX sequences.');
      if (new Set(v.customFrameMix).size > 8) warnings.push('Some platforms support at most eight distinct EMIX characters.');
      if (v.encapType === 'qinq' && v.customFrameMix.includes('a')) errors.push('The 64-byte a frame is not supported with QinQ.');
      if (v.customFrameMix.includes('u') && !validInt(v.customEmixSize, 64, 9216)) errors.push('Custom u frame size must be an integer from 64 to 9216 bytes; verify platform and encapsulation limits.');
      if (v.customFrameMix.includes('u') && v.encapType === 'qinq' && Number(v.customEmixSize) < 68) errors.push('QinQ requires a custom u frame size of at least 68 bytes.');
      if (v.customFrameMix.includes('h') && v.generatorHFrameSize !== '') {
        if (!validInt(v.generatorHFrameSize, 64, 9800)) {
          errors.push('Generator h frame size must be an integer from 64 to 9800 bytes; verify platform and encapsulation limits.');
        } else if (v.customFrameMix.includes('u') && validInt(v.customEmixSize, 64, 9216)
          && Number(v.customEmixSize) > Number(v.generatorHFrameSize)) {
          warnings.push('The custom u frame size exceeds h and will be limited to h.');
        }
      }
    }
  }
  if (!['l2-only', 'l2-to-l3-ipv4-only', 'l2-to-l3-ipv6-only', 'l2-to-l4-ipv4-only', 'l2-to-l4-ipv6-only', 'l2-to-l4'].includes(v.reflectionLevel)) {
    errors.push('Select a supported reflector reflection level.');
  }
  if (v.generatorPlatform === 'SAOS10' && v.benchmarkType !== 'standard' && !validInt(v.outageBandwidth, 1, 100000)) {
    errors.push('Outage test rate must be an integer between 1 and 100000 Mbps.');
  }
  if (v.generatorPlatform !== 'SAOS10' && !validInt(v.pcp, 0, 7)) errors.push('PCP must be between 0 and 7.');
  if (typeof v.generatorIp !== 'string' || (v.generatorIp && !isIpv4(v.generatorIp))) errors.push('Generator node IP must be a valid IPv4 address or blank.');
  if (typeof v.reflectorIp !== 'string' || (v.reflectorIp && !isIpv4(v.reflectorIp))) errors.push('Reflector node IP must be a valid IPv4 address or blank.');
  if (v.generatorPlatform !== 'SAOS10' && v.encapType === 'qinq') errors.push('QinQ encapsulation is supported by this SAT builder only with an SAOS10 generator.');
  if (v.color !== 'green' && Number(v.excessBandwidth) < 1) errors.push('Yellow or red traffic requires excess bandwidth greater than 0 Mbps.');
  if (v.mode === 'evc-out-of-service') warnings.push('EVC out-of-service mode affects the service/port. Verify impact and maintenance approval before applying.');
  if (v.mode === 'out-of-service') warnings.push('Port out-of-service mode drops all customer traffic on the port under test while SAT is active.');
  if (v.thirdParty && v.mode === 'in-service') warnings.push('In-service testing with a third-party generator is not supported by this profile.');
  if (v.benchmarkType === 'outage') {
    warnings.push('Outage testing runs indefinitely. Manually run the generated sat stop command before collecting statistics.');
    warnings.push('Outage is supported only on 3922, 3924, 3926, 3928, 3931, 3948, 3949, 5144, 5162, 5170, and 5171.');
  }
  /** @type {{ input: typeof v; errors: string[]; warnings: string[]; generatorConfig: string[]; reflectorConfig: string[]; generatorOps: string[]; reflectorOps: string[]; generatorRemove: string[]; reflectorRemove: string[] }} */
  const result = {
    input: v, errors, warnings,
    generatorConfig: [],
    reflectorConfig: [],
    generatorOps: [],
    reflectorOps: [],
    generatorRemove: [],
    reflectorRemove: [],
  };
  if (errors.length) return result;
  v.frameSizes = sizes.join(',');

  result.generatorConfig = v.generatorPlatform === 'SAOS10' ? satGenerator(v) : legacyGenerator(v, v.generatorPlatform);
  result.reflectorConfig = v.reflectorPlatform === 'SAOS10' ? satReflector(v) : legacyReflector(v, v.reflectorPlatform);
  const testGen = `TestGen-${v.name}-${v.vlan}`;
  if (v.generatorPlatform === 'SAOS10') {
    result.generatorOps = [
      `sat ping test-instances test-instance ${v.name}`,
      `sat start test-instances test-instance ${v.name}`,
      `show sat test-instances test-instance ${v.name} status`,
      ...(v.benchmarkType === 'outage' ? [] : [`show sat test-instances test-instance ${v.name} statistics`]),
      `sat stop test-instances test-instance ${v.name}`,
      ...(v.benchmarkType === 'outage' ? [
        '# Statistics are only shown after the test has stopped.',
        `show sat test-instances test-instance ${v.name} statistics`,
      ] : []),
      `clear sat test-instances test-instance ${v.name} statistics`,
      'clear flow-points statistics',
      'clear ettps statistics',
      `show flow-points flow-point ${v.generatorFlowPoint} statistics`,
      `show ettps ettp ${v.generatorPort} statistics`,
    ];
    result.reflectorOps = [`show sat test-instances test-instance ${v.name} statistics`];
  } else {
    result.generatorOps = [
      `benchmark test trigger name ${testGen} connectivity-test`,
      `benchmark test start name ${testGen}`,
      `benchmark test show name ${testGen} status`,
      `benchmark test show name ${testGen} statistics`,
      `benchmark test stop name ${testGen}`,
      `benchmark test clear name ${testGen} statistics`,
      'show flow-point statistics',
      `show flow-points flow-point ${v.generatorFlowPoint} statistics`,
      `show ettps ettp ${v.generatorPort} statistics`,
    ];
    result.reflectorOps = [`benchmark reflector show name Ref-${v.name} statistics`];
  }
  result.generatorRemove = generatorRemoval(v, v.generatorPlatform);
  result.reflectorRemove = reflectorRemoval(v, v.reflectorPlatform);
  return result;
}
