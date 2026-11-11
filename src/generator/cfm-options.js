// SAOS 10.12: 323-1955-323 Advanced OAM guide; mef-cfm, ciena-cfm and ciena-soam-pm YANG.
const integer = (key, label, command, value, min, max, hint = '') =>
  ({ key, label, command, value, min, max, hint: `${min}-${max}.${hint ? ` ${hint}` : ''}`, type: 'integer', options: undefined });
const select = (key, label, command, value, options, hint = '') =>
  ({ key, label, command, value, options, hint, type: 'select' });
const text = (key, label, command, hint = '', type = 'token') =>
  ({ key, label, command, value: '', hint, type, options: undefined });
const check = (key, label, command, value, hint = '') =>
  ({ key, label, command, value, hint, type: 'check', options: undefined });
const permission = ['none', 'chassis', 'manage', 'chassis-manage', 'defer'];
const mhf = ['none', 'default', 'explicit', 'defer'];
const uint32 = 4294967295;

const session = prefix => {
  const label = prefix.toUpperCase();
  return [
    text(`${prefix}SessionId`, `${label} session ID`, '', 'Blank uses Local MEP ID.', 'session-id'),
    text(`${prefix}RemoteMep`, `${label} remote MEP ID override`, '', 'Blank uses Remote MEP ID.', 'mep-id'),
    select(`${prefix}Operation`, `${label} operation`, 'operation-type', 'create', ['create', 'abort']),
    select(`${prefix}Version`, `${label} version`, 'version', 'Y.1731-2008', ['Y.1731-2008', 'Y.1731-2011']),
    integer(`${prefix}MeasurementInterval`, `${label} measurement interval (minutes)`, 'measurement-interval', '15', 1, 1440),
    integer(`${prefix}IntervalsStored`, `${label} history intervals`, 'number-intervals-stored', '32', 2, 256),
    check(`${prefix}Align`, `${label} align measurement intervals`, 'align-measurement-intervals', prefix === 'slm'),
    integer(`${prefix}AlignOffset`, `${label} alignment offset (minutes)`, 'align-measurement-offset', '0', 0, prefix === 'dmm' ? 525600 : 1440),
    ...(prefix === 'dmm' ? [
      integer('dmmFdBins', 'DMM frame-delay bins', 'bins-per-fd-interval', '3', 2, 10),
      integer('dmmIfdvBins', 'DMM inter-frame delay variation bins', 'bins-per-ifdv-interval', '2', 2, 10),
      integer('dmmFdrBins', 'DMM frame-delay range bins', 'bins-per-fdr-interval', '2', 2, 10),
    ] : [
      integer('slmAvailabilityInterval', 'SLM availability reporting interval (minutes)', 'availability-measurement-interval', '15', 1, 43200),
      integer('slmFlrMeasurements', 'SLM probes per availability indicator', 'availability-number-consecutive-flr-measurements', '10', 10, 1000000),
      integer('slmFlrThreshold', 'SLM availability FLR threshold (0-100000)', 'availability-flr-threshold', '50000', 0, 100000, '50000 represents 50% frame loss.'),
      integer('slmConsecutiveIntervals', 'SLM consecutive availability indicators', 'availability-number-consecutive-intervals', '10', 1, 1000),
      integer('slmHighFlr', 'SLM consecutive high-loss indicators', 'availability-number-consecutive-high-flr', '5', 1, 1000),
    ]),
    select(`${prefix}SessionType`, `${label} session type`, 'session-type', 'proactive', ['proactive', 'on-demand']),
    integer(`${prefix}Repetition`, `${label} repetition period (centiseconds)`, 'repetition-period', '0', 0, 259200000, '0 starts the next interval immediately after the previous interval.'),
    select(`${prefix}StartType`, `${label} start time type`, 'start-time-type', 'immediate', ['immediate', 'relative', 'absolute']),
    text(`${prefix}StartTime`, `${label} start time`, 'start-time', 'Relative: centiseconds. Absolute: ISO date/time with timezone.', 'time'),
    select(`${prefix}StopType`, `${label} stop time type`, 'stop-time-type', 'none', ['none', 'relative', 'absolute']),
    text(`${prefix}StopTime`, `${label} stop time`, 'stop-time', 'Relative: centiseconds. Absolute: ISO date/time with timezone.', 'time'),
    ...(prefix === 'dmm' ? [
      text('dmmMaxDelayThreshold', 'DMM maximum two-way delay threshold (microseconds)', 'max-frame-delay-two-way-threshold', 'Blank leaves the device default unchanged.', 'uint'),
      text('dmmAverageDelayThreshold', 'DMM average two-way delay threshold (microseconds)', 'average-frame-delay-two-way-threshold', '', 'uint'),
      text('dmmMaxIfdvThreshold', 'DMM maximum two-way IFDV threshold (microseconds)', 'max-inter-frame-delay-variation-two-way-threshold', '', 'uint'),
      text('dmmAverageIfdvThreshold', 'DMM average two-way IFDV threshold (microseconds)', 'average-inter-frame-delay-variation-two-way-threshold', '', 'uint'),
    ] : [
      integer('slmForwardThreshold', 'SLM forward frame-loss notification threshold', 'measured-fl-forward-threshold', '0', 0, 2147483647),
      integer('slmBackwardThreshold', 'SLM backward frame-loss notification threshold', 'measured-fl-backward-threshold', '0', 0, 2147483647),
    ]),
    ...(prefix === 'dmm' ? [
      text('dmmDelayProfile', 'DMM frame-delay bin profile', 'delay-bins', 'Optional existing cfm-profile-bins frame-delay profile.'),
      text('dmmIfdvProfile', 'DMM IFDV bin profile', 'ifdv-bins', 'Optional existing inter-frame-delay-variation profile.'),
      text('dmmFdrProfile', 'DMM frame-delay range bin profile', 'fdr-bins', 'Optional existing frame-delay-range profile.'),
      text('dmmAdvertisementProfile', 'DMM performance advertisement profile', 'performance-advertisement-profile', 'Optional existing profile.'),
      text('dmmMessagePeriod', 'DMM message period override (ms)', '', 'Blank uses DMM Interval. 3-3600000 ms, whole milliseconds.', 'dmm-period'),
    ] : [
      select('slmAccelerate', 'SLM hardware acceleration', 'accelerate', '', ['', 'true', 'false'], 'Automatic leaves the current device default unchanged. Hardware fixes frame size at 64 and Test ID at 1, inherits CCM priority, and requires probes x period of at least ten seconds.'),
      text('slmMessagePeriod', 'SLM message period override (ms)', '', 'Blank uses SLM Interval. 3-3600000 ms, up to two decimal places.', 'period'),
    ]),
  ].map(f => ({ ...f, section: prefix }));
};

export const CFM_EXTRA_FIELDS = [
  ...[
    select('globalAdmin', 'Global CFM admin state', 'admin-state', 'enable', ['enable', 'disable'], 'One-time setup only; affects all CFM services.'),
    select('globalMapPolicy', 'Global CFM Frame-to-CoS policy', 'frame-to-cos-map-policy', '', ['', 'default', 'fp-inherit'], 'One-time setup only; platform-dependent. Blank preserves the device default.'),
  ].map(f => ({ ...f, section: 'global' })),
  ...[
    text('mdId', 'MD identifier override', '', 'Blank uses MD Name.'),
    select('mdNameType', 'MD name format', 'name-type', 'character-string', ['none', 'mac-address-and-uint', 'character-string']),
    text('mdWireName', 'MD transmitted name', 'name', 'Blank uses the MD identifier. MAC + integer: 8 characters or base64 encoding of 8 bytes.', 'wire-name'),
    text('mdLevel', 'MD level override (0-7)', 'md-level', 'Blank derives the level from md0-md7.', 'level'),
    select('mdMhf', 'MD MHF creation', 'mhf-creation', 'none', mhf),
    select('mdPermission', 'MD sender ID permission', 'id-permission', 'chassis', permission.filter(v => v !== 'defer')),
  ].map(f => ({ ...f, section: 'md' })),
  ...[
    select('maNameType', 'MA name format', 'name-type', 'character-string', ['primary-vid', 'character-string', 'uint16', 'rfc2685-vpn-id']),
    text('maWireName', 'MA transmitted name', 'name', 'Blank uses the generated/custom MA Name. RFC2685: 7 characters or base64 encoding of 7 bytes; non-printable bytes may not appear in CLI readback.', 'wire-name'),
    integer('ccmLossNum', 'CCM loss count', 'ccm-loss-num', '3', 1, 255),
    select('maMhf', 'MA MHF creation', 'mhf-creation', 'defer', mhf),
    select('maPermission', 'MA sender ID permission', 'id-permission', 'defer', permission),
    text('staticRemoteMac', 'Static remote MEP MAC', '', 'Optional static remote configured for Remote MEP ID.', 'mac'),
    select('staticRemoteAdmin', 'Static remote MEP admin state', '', 'enable', ['enable', 'disable']),
  ].map(f => ({ ...f, section: 'ma' })),
  ...[
    text('mepInterface', 'MEP interface override', 'interface', 'Blank uses the selected endpoint flow point.'),
    check('mepAdmin', 'Local MEP administrative state', 'administrative-state', true),
    select('mepStatistics', 'Accelerated MEP statistics collection', 'statistics-collection', '', ['', 'true', 'false'], 'Platform-dependent; requires hardware acceleration.'),
  ].map(f => ({ ...f, section: 'mep' })),
  ...[
    check('cciEnabled', 'Transmit CCMs', 'cci-enabled', true),
    integer('fngAlarm', 'CCM fault alarm time (centiseconds)', 'fng-alarm-time', '0', 0, 3000),
    integer('fngReset', 'CCM fault reset time (centiseconds)', 'fng-reset-time', '1000', 10, 3000),
  ].map(f => ({ ...f, section: 'ccm' })),
  ...[
    select('tagCount', 'CFM tag format', '', 'single', ['single', 'double']),
    select('tagTpid', 'CFM outer TPID', 'tpid', 'tpid-8100', ['tpid-8100', 'tpid-88a8', 'tpid-9100']),
    text('tagVlan', 'CFM outer VLAN override', 'vlanid', 'Blank uses the selected endpoint VLAN.', 'vlan'),
    select('tagPcp', 'CFM outer PCP', 'pcp', '', ['', ...Array.from({ length: 8 }, (_, i) => `pcp-${i}`)]),
    select('tagDei', 'CFM outer DEI', 'dei', '', ['', 'enabled', 'disabled']),
    select('innerTpid', 'CFM inner TPID', 'tpid', 'tpid-8100', ['tpid-8100', 'tpid-88a8', 'tpid-9100']),
    text('innerVlan', 'CFM inner VLAN override', 'vlanid', 'Blank uses the selected endpoint VLAN.', 'vlan'),
    select('innerPcp', 'CFM inner PCP', 'pcp', '', ['', ...Array.from({ length: 8 }, (_, i) => `pcp-${i}`)]),
    select('innerDei', 'CFM inner DEI', 'dei', '', ['', 'enabled', 'disabled']),
  ].map(f => ({ ...f, section: 'tag' })),
  ...session('dmm'), ...session('slm'),
];

export const CFM_EXTRA_DEFAULTS = Object.fromEntries(CFM_EXTRA_FIELDS.map(f => [f.key, f.value]));
export const cfmOptionActive = (c, field) => {
  if (field.section === 'global' || field.section === 'md') return true;
  if (!c.enabled) return false;
  if (field.section === 'dmm' || field.section === 'slm') {
    const p = field.section;
    if (!c[p]) return false;
    if (field.key === `${p}StartTime`) return c[`${p}StartType`] !== 'immediate';
    if (field.key === `${p}StopTime`) return c[`${p}StopType`] !== 'none';
  }
  if (field.section === 'tag') return c.tagged && (!field.key.startsWith('inner') || c.tagCount === 'double');
  return true;
};

export function cfmArgs(c, section, excluded = []) {
  return CFM_EXTRA_FIELDS.filter(f => f.section === section && f.command && !excluded.includes(f.key)
    && (f.command !== 'start-time' || c[`${section}StartType`] !== 'immediate')
    && (f.command !== 'stop-time' || c[`${section}StopType`] !== 'none')
    && c[f.key] !== '').map(f => `${f.command} ${c[f.key]}`).join(' ');
}

export function validateCfmOptions(c) {
  const errors = [];
  const error = (key, message) => errors.push({ field: `cfm.${key}`, msg: message });
  for (const f of CFM_EXTRA_FIELDS) {
    if (!cfmOptionActive(c, f)) continue;
    const value = c[f.key];
    const str = String(value);
    if (f.type === 'check' && typeof value !== 'boolean') error(f.key, `${f.label}: select enabled or disabled.`);
    else if (f.options && !f.options.includes(str)) error(f.key, `${f.label}: select a supported value.`);
    else if (f.type === 'integer' && (!/^\d+$/.test(str) || Number(value) < f.min || Number(value) > f.max))
      error(f.key, `${f.label}: enter a whole number from ${f.min} to ${f.max}.`);
    else if (f.type === 'time') {
      const type = c[f.key.replace(/Time$/, 'Type')];
      if (type === 'relative' ? !/^\d+$/.test(str) || Number(value) > uint32
        : !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(str) || Number.isNaN(Date.parse(str)))
        error(f.key, `${f.label}: enter centiseconds for relative time, or an ISO date/time with timezone for absolute time.`);
    } else if (str !== '') {
      if (f.type === 'mac' && !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(str)) error(f.key, `${f.label}: enter xx:xx:xx:xx:xx:xx.`);
      if (['uint', 'session-id', 'level', 'vlan', 'mep-id'].includes(f.type)) {
        const min = ['vlan', 'session-id', 'mep-id'].includes(f.type) ? 1 : 0;
        const max = f.type === 'vlan' ? 4094 : f.type === 'level' ? 7 : f.type === 'mep-id' ? 8191 : uint32;
        if (!/^\d+$/.test(str) || Number(value) < min || Number(value) > max) error(f.key, `${f.label}: enter ${min}-${max}.`);
      }
      if (f.type === 'token' && !/^[A-Za-z0-9_.:-]+$/.test(str)) error(f.key, `${f.label}: use a single CLI-safe name without whitespace.`);
      if (f.type === 'wire-name' && !/^[A-Za-z0-9_.:+=/-]+$/.test(str)) error(f.key, `${f.label}: use a single CLI-safe name without whitespace.`);
      if (f.type === 'period' && (!/^\d+(?:\.\d{1,2})?$/.test(str) || Number(value) < 3 || Number(value) > 3600000))
        error(f.key, `${f.label}: enter 3-3600000 ms, up to two decimal places.`);
      if (f.type === 'dmm-period' && (!/^\d+$/.test(str) || Number(value) < 3 || Number(value) > 3600000))
        error(f.key, `${f.label}: enter 3-3600000 whole milliseconds.`);
    }
    for (const key of ['lossResponder', 'slmResponder', 'delayResponder']) {
      if (c.enabled && c[key]) error(key, 'Responder state is read-only on SAOS 10; remove this unsupported override.');
    }
  }
  for (const p of ['dmm', 'slm']) {
    if (c.enabled && c[`${p}RemoteMac`])
      error(`${p}RemoteMac`, `${p.toUpperCase()}: MAC targeting is no longer configurable. Remove the MAC target and use Remote MEP ID.`);
    if (!c.enabled || !c[p]) continue;
    if (c[`${p}SessionType`] === 'proactive' && (c[`${p}StartType`] !== 'immediate' || c[`${p}StopType`] !== 'none'))
      error(`${p}SessionType`, `${p.toUpperCase()}: scheduled start/stop times require an on-demand session.`);
    if (c[`${p}StartType`] === 'absolute' && c[`${p}StopType`] === 'absolute'
      && Date.parse(c[`${p}StopTime`]) < Date.parse(c[`${p}StartTime`]))
      error(`${p}StopTime`, `${p.toUpperCase()}: stop time must not precede start time.`);
    if (Number(c[`${p}Repetition`]) > 0 && Number(c[`${p}Repetition`]) < Number(c[`${p}MeasurementInterval`]) * 6000)
      error(`${p}Repetition`, `${p.toUpperCase()}: repetition period must be zero or at least the measurement interval.`);
  }
  if (c.enabled && c.slm && Number(c.slmHighFlr) >= Number(c.slmConsecutiveIntervals))
    error('slmHighFlr', 'SLM consecutive high-loss indicators must be fewer than consecutive availability indicators.');
  return errors;
}
