import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, CircleHelp, Copy, Share2, ShieldCheck } from 'lucide-react';
import * as Ip from '../generator/l3ip.js';
import * as Sat from '../generator/sat.js';
import { CodeBlock as CommandCodeBlock, CreatorCodeBlock as CodeBlock, InputField, OutputTabs, PageHead, Panel, Issues, ResetButton, Segments } from './components';
import { copyText, fieldValue, isRecord, replaceField, shareSettings, startConfigReview, useSharedSettings, useStored, type IpInput, type SatInput } from './state';

interface ToolField<T> {
  key: keyof T & string;
  label: string;
  options?: readonly string[];
  check?: boolean;
  hint?: string | ((state: T) => ReactNode);
  render?: (input: T, onChange: (input: T) => void) => ReactNode;
}
function FormFields<T extends object>({ input, fields, onChange, advanced = false }: {
  input: T; fields: ToolField<T>[]; onChange: (input: T) => void; advanced?: boolean;
}) {
  return <div className="field-grid">{fields.map(field => field.render
    ? <div key={field.key} className="input-field" data-field={field.key}>{field.render(input, onChange)}</div>
    : <InputField key={field.key} id={field.key} label={field.label}
    value={fieldValue(input, field.key)} check={field.check} options={field.options} advanced={advanced}
    onChange={value => onChange(replaceField(input, field.key, value))}
    hint={typeof field.hint === 'function' ? field.hint(input) : field.hint} />)}</div>;
}
const modeOptions = [{ id: 'basic', label: 'Basic' }, { id: 'advanced', label: 'Advanced' }] as const;
const ipBasic: ToolField<IpInput>[] = [
  { key: 'platform', label: 'SAOS platform', options: Ip.PLATFORMS },
  { key: 'name', label: 'Interface name', hint: 'Used for IP-Int name, and part of FD and FP names.' },
  { key: 'address', label: 'IPv4 address', hint: 'Use an address assigned to this local interface.' },
  { key: 'prefix', label: 'Subnet prefix length', hint: 'For loopback config, set to 32.\nSAOS10 broadcast interfaces use up to /30, point-to-point up to /31.' },
  { key: 'port', label: 'Logical port', hint: 'Examples: 8 or 1/1.' },
  { key: 'vlan', label: 'VLAN (0 = untagged)' },
];
const ipAdvanced: ToolField<IpInput>[] = [
  { key: 'role', label: 'Role', options: ['Data', 'Management'], hint: 'Management adds role management on SAOS10.\nData for transit or control traffic.' },
  { key: 'mtu', label: 'MTU (Layer3/IP)', hint: state => <>
    <p>Maximum 9700 on SAOS10; 9216 on SAOS6/8.</p>
    <p>For L2 MTU: '<code>logical-ports logical-port {Ip.isLogicalPort(state.port) ? state.port : '<PORT>'} mtu &lt;MTU&gt;</code>'</p>
  </> },
  { key: 'priority', label: 'Priority (0-7)' },
  { key: 'networkType', label: 'Network type', options: ['broadcast', 'point-to-point'] },
  { key: 'tpid', label: 'TPID', options: ['8100', '88a8', '9100'] },
  { key: 'qinq', label: 'Enable dual-tag / QinQ', check: true },
  { key: 'innerVlan', label: 'QinQ inner VLAN' },
];

const migrateIpSettings = (value: unknown) => isRecord(value) && !('role' in value) ? { ...value, role: 'Data' } : value;

export function IpBuilder() {
  const [inlineComments, setInlineComments] = useStored('l3ip-inline-comments', false, (v): v is boolean => typeof v === 'boolean');
  const [input, setInput] = useSharedSettings('l3ip-state', 'l3ip', Ip.defaults(), migrateIpSettings);
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');
  const out = Ip.generate(input);
  const isLoopback = Number(input.prefix) === 32;
  const updateInput = (next: IpInput) => setInput(next.platform !== input.platform && next.platform !== Ip.PLATFORMS[1]
    ? { ...next, qinq: false } : next);
  const advancedFields = ipAdvanced.filter(field => isLoopback ? field.key === 'role'
    : field.key === 'qinq' ? input.platform === Ip.PLATFORMS[1]
    : field.key === 'innerVlan' ? input.platform === Ip.PLATFORMS[1] && input.qinq : true);
  const text = [`# ${input.platform} - ${input.name}`, ...out.config, '# Verify', ...out.show, '# Remove', ...out.remove].join('\n');
  const targetPlatform = input.platform === 'SAOS10 (392x)' ? 'cn3926' : 'cn5164';
  return <>
    <PageHead eyebrow="CONFIGURE / ROUTED SERVICES" title="IP interface creator"
      description="One interface. Start with the essentials, then refine VLAN encapsulation and routing."
      actions={<><button className="button" onClick={() => void shareSettings('l3ip', input)}><Share2 size={14} />Share settings</button><Segments label="Detail level" options={modeOptions} value={mode} onChange={setMode} /><ResetButton onReset={() => setInput(Ip.defaults())} /></>} />
    <div className="builder-layout"><div className="builder-form">
      <Panel title="Interface essentials" description={isLoopback ? 'A /32 creates a loopback without a logical port, VLAN, forwarding domain or flow point.' : undefined}><FormFields input={input} fields={isLoopback ? ipBasic.filter(field => field.key !== 'port' && field.key !== 'vlan') : ipBasic} onChange={updateInput} /></Panel>
      {mode === 'advanced' && <Panel id="ip-advanced-settings" title={isLoopback ? 'Loopback role' : 'Encapsulation & routing'}><FormFields input={input} fields={advancedFields} onChange={updateInput} advanced /></Panel>}
      <button type="button" className="text-action" aria-expanded={mode === 'advanced'} aria-controls="ip-advanced-settings"
        onClick={() => setMode(mode === 'basic' ? 'advanced' : 'basic')}>{mode === 'basic' ? 'Show' : 'Hide'} Advanced</button>
    </div><div className="builder-results">
      <Issues errors={out.errors} warnings={out.warnings} />
      <OutputTabs filename={`${input.name || 'interface'}-l3ip.txt`} text={text} disabled={out.errors.length > 0}
        actions={input.platform.startsWith('SAOS10') && <button className="button button-small" disabled={out.errors.length > 0}
          onClick={() => startConfigReview(out.config.join('\n'), 'IP interface creator', targetPlatform)}><ShieldCheck size={13} />Validate config</button>}
        inlineComments={{ enabled: inlineComments, onChange: setInlineComments }} tabs={[
        { id: 'config', label: 'Config', content: <CodeBlock title={`${isLoopback ? 'Loopback' : 'Interface'} - ${input.platform}`} lines={out.config} /> },
        { id: 'verify', label: 'Verify', content: <CodeBlock title="Verification commands" lines={out.show} /> },
        { id: 'remove', label: 'Remove', content: <><p className="note">{isLoopback ? 'Check that no services depend on this loopback before removing it.' : 'Check that the interface, VLAN and classifier are not shared before removing these objects.'}</p><CodeBlock title="Removal commands" lines={out.remove} /></> },
      ]} />
    </div></div>
  </>;
}

function HelperCommand({ command }: { command: string }) {
  return <span className="helper-command"><code>{command}</code>{' '}
    <button type="button" className="code-copy" aria-label={`Copy ${command}`} onClick={() => void copyText(command)}>
      <Copy size={14} aria-hidden="true" /> Copy
    </button>
  </span>;
}
function query(lead: ReactNode, command: string, note?: string) {
  return <><p>{lead} <HelperCommand command={command} /></p>{note && <p>{note}</p>}</>;
}
function flowHelp(platform: string, vlan: string) {
  if (platform === 'SAOS10') return query('Find the flow point:', `show run config section fps | grep ${vlan}`, 'If two are listed, use the client-facing flow point.');
  if (platform === 'SAOS8') return query('Find the sub-port:', `conf search string "sub-port add" | grep ${vlan}`, 'If two are listed, use the client-facing sub-port.');
  return null;
}
function portHelp(platform: string, name: string) {
  return query('Find the client port:', platform === 'SAOS10' ? `show run config section fps | grep ${name}`
    : platform === 'SAOS8' ? `conf search string parent-port | grep ${name}` : 'conf search string "ethernet add"');
}
const satTraffic: ToolField<SatInput>[] = [
  { key: 'name', label: 'Test name', hint: 'No requirement to match Service name.' },
  { key: 'vlan', label: 'Client VLAN (0 = untagged)' },
  { key: 'mode', label: 'Test mode', options: ['in-service', 'evc-out-of-service'],
    hint: "NOTE: To avoid disabling shared ports, 'Out-of-Service' mode is only available via CLI." },
  { key: 'duration', label: 'Duration', options: ['Once', '15min', '1hr', 'Indefinite'] },
  { key: 'bandwidth', label: 'Bandwidth (Mbps)' },
  { key: 'frameSizes', label: 'Frame sizes (comma-separated)', hint: 'Up to 9 sizes, each 64-9216 bytes.' },
];
const satGenerator: ToolField<SatInput>[] = [
  { key: 'generatorPlatform', label: 'Generator type', options: Sat.PLATFORMS, hint: s => s.generatorPlatform !== 'SAOS8'
    ? <OffloadHelp platform={s.generatorPlatform} />
    : null },
  { key: 'generatorFlowPoint', label: 'Generator Flow Point Name', hint: s => flowHelp(s.generatorPlatform, s.vlan) },
  { key: 'generatorPort', label: 'Generator Client UNI Logical Port', hint: s => portHelp(s.generatorPlatform, s.generatorFlowPoint) },
  { key: 'reflectorMac', label: "Reflector's Benchmark MAC", hint: s => query(<>Run <strong><u>on the reflector</u></strong>:</>, s.reflectorPlatform === 'SAOS10'
    ? 'show system mac | grep shared' : s.reflectorPlatform === 'SAOS8' ? 'chassis show mac | grep Bench' : 'chassis show mac') },
];
const satReflector: ToolField<SatInput>[] = [
  { key: 'reflectorPlatform', label: 'Reflector type', options: Sat.PLATFORMS },
  { key: 'reflectorFlowPoint', label: 'Reflector Flow Point Name', hint: s => flowHelp(s.reflectorPlatform, s.vlan) },
  { key: 'reflectorPort', label: 'Reflector Client UNI Logical Port', hint: s => portHelp(s.reflectorPlatform, s.reflectorFlowPoint) },
  { key: 'thirdParty', label: 'Generator is non-Ciena', check: true, hint: 'Changes reflector association and MAC validation. In-service testing with a non-Ciena generator is not supported by this profile.' },
];
function satEndpointFields(fields: ToolField<SatInput>[], platform: string) {
  return fields.filter(field => platform !== 'SAOS6' || !field.key.endsWith('FlowPoint'))
    .map(field => platform === 'SAOS8' && field.key.endsWith('FlowPoint')
      ? { ...field, label: field.label.replace('Flow Point', 'Sub-Port') } : field);
}
const satValidationFields: ToolField<SatInput>[] = [
  { key: 'colorValidation', label: 'Color', check: true },
  { key: 'macValidation', label: 'MAC', check: true },
  { key: 'pcpValidation', label: 'PCP', check: true },
  { key: 'vidValidation', label: 'VLAN', check: true },
];

const satAdvanced: ToolField<SatInput>[] = [
  { key: 'kpiProfileName', label: 'KPI profile name', hint: 'Generated with this test; use a unique name.' },
  { key: 'customDuration', label: 'Custom duration (minutes)' },
  { key: 'interval', label: 'Interval', options: ['tCompletion', 't15min', 't1hr', 't2hr', 't6hr'] },
  { key: 'framelossStartBandwidth', label: 'Frame-loss start bandwidth', options: ['maximum-throughput', 'profile-bandwidth'] },
  { key: 'maxSearches', label: 'Maximum bandwidth searches', hint: 'Limits bandwidth-search iterations.' },
  { key: 'satMaxSearches', label: 'Maximum bandwidth searches (SAOS10)', hint: 'RFC2544 fixes this at 7; Y.1564 defaults to 16.' },
  { key: 'maxSamples', label: 'Maximum samples (2-20)' },
  { key: 'samplingInterval', label: 'Sampling interval (100 ms steps)' },
  { key: 'excessBandwidth', label: 'Excess bandwidth (Mbps)' },
  { key: 'emixSequence', label: 'Ethernet mix profile', options: [
    'y1564', 'y1564-v6', 'y1564-qinq-v4', 'y1564-qinq-v6', 'simple', 'simple-v6',
    'simple-qinq-v4', 'simple-qinq-v6', 'firewall', 'tcp', 'ipv6', 'ipv6-qinq',
    'Custom',
  ] },
  { key: 'customFrameMix', label: 'Frame Size Mix', render: (input, onChange) => <FrameMixField input={input} onChange={onChange} /> },
  { key: 'customEmixSize', label: 'Custom u frame size (bytes)', hint: 'The u character uses this size, subject to the generator h-frame size and platform limits.' },
  { key: 'generatorHFrameSize', label: 'Generator h frame size (bytes)', hint: 'Leave blank to use the port default. Check platform and path MTU limits, including encapsulation.' },
  { key: 'customPayload', label: 'Custom payload', hint: 'Example text is encoded as binary in the generated CLI.' },
  { key: 'resultMode', label: 'Throughput bandwidth calculation mode', options: ['payload', 'transport'],
    hint: 'Payload uses L2 frame length; transport uses L1 frame length.' },
  { key: 'pduType', label: 'PDU type', options: ['ethernet', 'ip', 'udp-echo'] },
  { key: 'tpid', label: 'Tag protocol identifier', options: ['0x8100', '0x88a8', '0x9100'] },
  { key: 'encapType', label: 'VLAN encapsulation type', options: ['untagged', 'dot1Q', 'qinq'] },
  { key: 'sVlan', label: 'S-VLAN (QinQ)' },
  { key: 'pcp', label: 'PCP (0-7)', hint: 'Ignored when client VLAN is 0 (untagged).' },
  { key: 'color', label: 'Color', options: ['green', 'yellow', 'green-yellow', 'green-yellow-red'] },
  { key: 'priorityCodePoints', label: 'Priority code points',
    render: (input, onChange) => <SatPriorityCodePoints input={input} onChange={onChange} /> },
  { key: 'bwAllocProfile', label: 'PCP bandwidth allocation profile', hint: 'Must name a profile already configured on the node.' },
  { key: 'dscp', label: 'IP differentiated service code point (0-63)' },
  { key: 'generatorIp', label: 'Generator node IP', hint: 'Source IP address in the test payload.' },
  { key: 'reflectorIp', label: 'Reflector node IP', hint: 'Destination IP address in the test payload.' },
  { key: 'reflectionLevel', label: 'Reflection level', options: [
    'l2-only', 'l2-to-l3-ipv4-only', 'l2-to-l3-ipv6-only',
    'l2-to-l4-ipv4-only', 'l2-to-l4-ipv6-only', 'l2-to-l4',
  ] },
  { key: 'macValidation', label: 'Frame Validation',
    render: (input, onChange) => <CheckboxDropdown id="sat-frame-validation" label="Frame Validation"
      options={satValidationFields.map(field => ({ key: field.key, id: field.key, label: field.label,
        checked: fieldValue(input, field.key) === true }))}
      onChange={(key, checked) => onChange(replaceField(input, key, checked))} /> },
];

const satOutageRateField: ToolField<SatInput> = {
  key: 'outageBandwidth', label: 'Outage test rate (Mbps)',
};

function FrameMixField({ input, onChange }: { input: SatInput; onChange: (input: SatInput) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    return () => node?.close();
  }, []);
  const custom = input.emixSequence === 'Custom';
  return <>
    <label className="field-label" htmlFor="customFrameMix">Frame Size Mix{' '}
      <button type="button" className="text-action" aria-label="Frame Size Mix help" aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}><CircleHelp size={15} aria-hidden="true" /></button>
    </label>
    <input id="customFrameMix" type="text" readOnly={!custom} spellCheck={false}
      value={custom ? input.customFrameMix : Sat.emixPattern(input.emixSequence)}
      onChange={event => onChange({ ...input, customFrameMix: event.target.value })} />
    <dialog ref={dialog} className="sat-test-help-dialog" aria-labelledby="sat-emix-help-title">
      <h2 id="sat-emix-help-title">Frame Size Mix</h2>
      <p className="mt-4">To edit this field, set "Ethernet mix profile" to "custom".</p>
      <p className="mt-4">Each lowercase letter sends one frame; the sequence repeats throughout the test.</p>
      <p className="mt-4">a = 64, b = 128, c = 256, d = 512, e = 1024, f = 1280, g = 1518 bytes;
        v = 84, w = 68, x = 88 bytes; h = generator h-frame size; u = custom frame size.</p>
      <p className="mt-4">For jumbo frames, include u in a custom mix and set Custom u frame size.
        For example, bbduug with u = 9000 includes two 9000-byte frames per sequence.
        All u characters in a mix use the same size.</p>
      <p className="mt-4">When the mix contains h, set its size in Generator h frame size, or leave
        that field blank to use the port default.</p>
      <p className="mt-4">The u size is limited by h. Check encapsulation and platform limits: some platforms allow
        at most 16 frames per mix, while others allow 32 and at most eight distinct letters. Ensure the path MTU
        accommodates the frame and any added encapsulation.</p>
      <form method="dialog" className="mt-5"><button className="button primary">Close</button></form>
    </dialog>
  </>;
}
const satOutageFrameField: ToolField<SatInput> = {
  key: 'outageFrameSize', label: 'Outage frame size (bytes)',
  hint: 'Enter one frame size.',
};

const migrateSatSettings = (value: unknown) => {
  if (!isRecord(value)) return value;
  const migrated: Record<string, unknown> = { ...Sat.defaults(), ...value };
  delete migrated.testConnectivity;
  if (migrated.mode === 'out-of-service') migrated.mode = 'in-service';
  if (!('encapType' in value) && value.vlan === '0') migrated.encapType = 'untagged';
  if (!('priorityCodePoints' in value) && typeof value.pcp === 'string' && /^[0-7]$/.test(value.pcp)) {
    migrated.priorityCodePoints = [`pcp${value.pcp}`];
  }
  return migrated;
};

function CheckboxDropdown<T extends string>({ id, label, options, summary, onChange }: {
  id: string; label: string; options: readonly { key: T; id: string; label: string; checked: boolean }[];
  summary?: string; onChange: (key: T, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return <div className="input-field is-advanced checkbox-dropdown" ref={container}>
    <label id={`${id}-label`} className="field-label" htmlFor={`${id}-select`}>{label}</label>
    <button id={`${id}-select`} ref={trigger} type="button" className="checkbox-dropdown-trigger"
      aria-expanded={open} aria-controls={`${id}-options`}
      onClick={() => setOpen(!open)}>
      <span>{summary ?? (options.filter(option => option.checked).map(option => option.label).join(', ') || 'None selected')}</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id={`${id}-options`} className="checkbox-dropdown-options" role="group" aria-labelledby={`${id}-label`} hidden={!open}>
      {options.map(option => <InputField key={option.key} id={option.id} label={option.label}
        value={option.checked} check onChange={checked => onChange(option.key, checked === true)} />)}
    </div>
  </div>;
}

function SatPriorityCodePoints({ input, onChange }: {
  input: SatInput; onChange: (input: SatInput) => void;
}) {
  const values = Array.from({ length: 8 }, (_, pcp) => `pcp${pcp}`);
  const selected = values.filter(value => input.priorityCodePoints.includes(value));
  return <CheckboxDropdown id="sat-pcp" label="Priority code points"
    options={values.map((value, pcp) => ({ key: value, id: `sat-${value}`, label: `PCP ${pcp}`,
      checked: input.priorityCodePoints.includes(value) }))}
    summary={selected.length ? `PCP ${selected.map(value => value.slice(3)).join(', ')}` : 'Select PCPs'}
    onChange={(value, checked) => onChange({ ...input, priorityCodePoints: checked
      ? [...new Set([...input.priorityCodePoints, value])]
      : input.priorityCodePoints.filter(item => item !== value) })} />;
}

function SatTestTypes({ input, mode, onChange }: {
  input: SatInput; mode: 'basic' | 'advanced'; onChange: (input: SatInput) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    return () => node?.close();
  }, []);
  const specialTypes: { key: 'rfc2544' | 'y1564' | 'outage'; label: string }[] = [
    { key: 'rfc2544', label: 'RFC2544' },
    { key: 'y1564', label: 'Y.1564' },
  ];
  if (mode === 'advanced') specialTypes.push({ key: 'outage', label: 'Outage/Continuous' });
  const selectedSpecial = input.benchmarkType !== 'standard' ? input.benchmarkType : null;
  const toggleStandard = (type: string, checked: boolean) => onChange({
    ...input,
    benchmarkType: 'standard',
    testTypes: checked ? [...new Set([...input.testTypes, type])] : input.testTypes.filter(value => value !== type),
  });
  const toggleSpecial = (type: 'rfc2544' | 'y1564' | 'outage', checked: boolean) => onChange({
    ...input,
    benchmarkType: checked ? type : 'standard',
  });
  return <>
    <fieldset className="mt-5">
      <legend className="field-label flex items-center gap-2">Test types
        <button type="button" className="text-action" aria-label="Test type help" aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}><CircleHelp size={15} aria-hidden="true" /></button>
      </legend>
      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Throughput, latency, PDV and frame loss">
          {selectedSpecial === null ? Sat.TEST_TYPES.map(type => <InputField key={type} id={`sat-test-${type}`} label={type}
            value={input.testTypes.includes(type)} check onChange={checked => toggleStandard(type, checked === true)} />) : null}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="RFC2544, Y.1564 and Outage">
          {specialTypes.filter(({ key }) => selectedSpecial === null || selectedSpecial === key).map(({ key, label }) =>
            <InputField key={key} id={`sat-test-${key}`} label={label} value={selectedSpecial === key} check
              onChange={checked => toggleSpecial(key, checked === true)} />)}
        </div>
      </div>
    </fieldset>
    <dialog ref={dialog} className="sat-test-help-dialog" aria-labelledby="sat-test-help-title">
      <h2 id="sat-test-help-title">SAT test types</h2>
      <ul className="mt-4 list-disc pl-5">
        <li><strong>Throughput:</strong> Finds the maximum traffic rate the service can carry without loss.</li>
        <li><strong>Latency:</strong> Measures the time for test traffic to travel to the reflector and back.</li>
        <li><strong>PDV:</strong> Measures variation in the delay of returned packets.</li>
        <li><strong>Frame loss:</strong> Measures packet loss at selected rates and frame sizes.</li>
        <li><strong>RFC2544:</strong> Runs the fixed RFC2544 throughput, frame-loss and latency sequence.</li>
        <li><strong>Y.1564:</strong> Runs service-activation throughput, frame-loss, latency and PDV tests using an EMIX profile.</li>
        <li><strong>Outage:</strong> Measures interruptions from sequence discontinuities; it runs indefinitely and must be stopped manually.</li>
      </ul>
      <form method="dialog" className="mt-5"><button className="button primary">Close</button></form>
    </dialog>
  </>;
}

function OffloadHelp({ platform }: { platform: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    return () => node?.close();
  }, []);
  return <>
    <button type="button" className="text-action" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>3924/3926 Details</button>
    <dialog ref={dialog} className="offload-dialog" aria-labelledby="offload-title">
      <h2 id="offload-title">{platform} offload port preparation</h2>
      <p className="entry-note mt-4">Use port 4 for 3926 and port 7 for 3928. The offload port for 3924 is not specified. Verify the correct offload port for your model and replace {platform === 'SAOS6' ? '<#>' : 'X'} below.</p>
      {platform === 'SAOS6' ? <p className="mt-4"><HelperCommand command="chassis system-rsvd-port add port <#> feature oam-services" /></p> : <>
      <p className="note mt-4">Changing offload-activate affects all system port traffic for up to two minutes. Plan for the interruption before applying.</p>
      <ol className="list-decimal pl-5 space-y-3 mt-4">
        <li>Find flow points on the offload port with <HelperCommand command="show flow-points" />, then remove the attached flow points with <HelperCommand command="no fps fp <NAME>" />.</li>
        <li><HelperCommand command="no logical-ports logical-port X binding" /></li>
        <li><HelperCommand command="oc-if:interfaces interface X config offload-activate true" /></li>
      </ol>
      </>}
      <form method="dialog" className="mt-5"><button className="button primary">Close</button></form>
    </dialog>
  </>;
}

export function SatBuilder() {
  const [input, setInput] = useSharedSettings('sat-state', 'sat', Sat.defaults(), migrateSatSettings);
  const [mode, setMode] = useState<'basic' | 'advanced'>(() => input.benchmarkType === 'outage' ? 'advanced' : 'basic');
  const out = Sat.generate(input);
  const updateInput = (next: SatInput) => {
    let updated = next;
    if (next.encapType !== input.encapType) {
      if (next.encapType === 'untagged') updated = { ...next, vlan: '0' };
      else if (input.encapType === 'untagged' && next.vlan === '0') updated = { ...next, vlan: '1337' };
    } else if (next.vlan === '0' && input.vlan !== '0') updated = { ...next, encapType: 'untagged' };
    else if (next.vlan !== '0' && input.vlan === '0' && next.encapType === 'untagged') updated = { ...next, encapType: 'dot1Q' };
    setInput(updated);
  };
  const setDetailLevel = (next: 'basic' | 'advanced') => {
    if (next === 'basic' && input.benchmarkType === 'outage') setInput({ ...input, benchmarkType: 'standard' });
    setMode(next);
  };
  const trafficFields = satTraffic.filter(field => {
    if (input.benchmarkType === 'outage' && ['duration', 'bandwidth', 'frameSizes'].includes(field.key)) return false;
    return field.key !== 'frameSizes' || input.benchmarkType === 'standard';
  }).map(field => {
    if (field.key === 'vlan') return { ...field, label: input.encapType === 'qinq' ? 'C-VLAN (inner)' : 'Client VLAN (0 = untagged)' };
    if (field.key === 'duration') return { ...field, options: input.generatorPlatform === 'SAOS10'
      ? ['Once', '15min', '1hr', '6hr', '24hr', 'Indefinite', 'Custom'] : ['Once', '15min', '1hr', 'Indefinite'] };
    if (field.key === 'frameSizes') return { ...field, hint: () => <>
      <p>{input.generatorPlatform === 'SAOS10' ? 'Up to 10 sizes, each 64-16000 bytes.' : 'Up to 9 sizes, each 64-9216 bytes.'}</p>
      <button type="button" className="text-action" onClick={() => updateInput({ ...input, frameSizes: '64, 128, 256, 512, 1024, 1280, 1518, 2048, 9000' })}>Insert Common Sizes</button>
    </> };
    return field;
  });
  const outageFields = input.benchmarkType === 'outage' ? [satOutageRateField, satOutageFrameField] : [];
  const advancedFields = satAdvanced.filter(field => {
    if (input.generatorPlatform !== 'SAOS10') return ['generatorIp', 'reflectorIp', 'maxSearches', 'pcp'].includes(field.key);
    if (field.key === 'pcp') return false;
    if (field.key === 'maxSearches') return input.benchmarkType === 'standard';
    if (field.key === 'sVlan') return input.encapType === 'qinq';
    if (field.key === 'priorityCodePoints') return input.encapType !== 'untagged';
    if (field.key === 'satMaxSearches' || field.key === 'emixSequence' || field.key === 'customFrameMix') return input.benchmarkType === 'y1564';
    if (field.key === 'customEmixSize') return input.benchmarkType === 'y1564'
      && input.emixSequence === 'Custom' && input.customFrameMix.includes('u');
    if (field.key === 'generatorHFrameSize') return input.benchmarkType === 'y1564'
      && input.emixSequence === 'Custom' && input.customFrameMix.includes('h');
    if (field.key === 'maxSamples' || field.key === 'samplingInterval' || field.key === 'excessBandwidth') return input.benchmarkType !== 'outage';
    if (field.key === 'customDuration') return input.duration === 'Custom' && input.benchmarkType !== 'outage';
    if (field.key === 'reflectionLevel') return input.reflectorPlatform === 'SAOS10';
    if (field.key === 'framelossStartBandwidth') return input.benchmarkType === 'standard' || input.benchmarkType === 'y1564';
    return true;
  });
  const activationCount = input.generatorPlatform === 'SAOS10'
    ? (input.benchmarkType === 'outage' ? 3 : 4) : 4;
  const generatorOpsText = out.generatorOps.flatMap(command =>
    input.benchmarkType === 'outage' && command.startsWith('sat stop')
      ? ['# MANUAL: Stop the test before collecting statistics; Outage never stops automatically.', command]
      : [command]);
  const text = [
    `# Configure Generator - ${input.generatorPlatform}`, ...out.generatorConfig,
    `# Configure Reflector - ${input.reflectorPlatform}`, ...out.reflectorConfig,
    `# Activate Generator - ${input.generatorPlatform}`, ...out.generatorOps.slice(0, activationCount),
    `# Validate Generator - ${input.generatorPlatform}`, ...generatorOpsText.slice(activationCount),
    `# Validate Reflector - ${input.reflectorPlatform}`, ...out.reflectorOps,
    `# Remove Generator - ${input.generatorPlatform}`, ...out.generatorRemove,
    `# Remove Reflector - ${input.reflectorPlatform}`, ...out.reflectorRemove,
  ].join('\n');
  const blocks = (action: string, generator: string[], reflector: string[], individualCopy = false) => <>
    <CodeBlock title={`${action} Generator - ${input.generatorPlatform}`} lines={generator} individualCopy={individualCopy} />
    <CodeBlock title={`${action} Reflector - ${input.reflectorPlatform}`} lines={reflector} individualCopy={individualCopy} />
  </>;
  const review = (endpoint: 'generator' | 'reflector') => {
    const isGenerator = endpoint === 'generator';
    const platform = isGenerator ? input.generatorPlatform : input.reflectorPlatform;
    if (platform !== 'SAOS10') return null;
    const config = isGenerator ? out.generatorConfig : out.reflectorConfig;
    return <button className="button button-small" type="button" disabled={out.errors.length > 0}
      aria-label={`Validate ${endpoint} config`}
      onClick={() => startConfigReview(['config', ...config, 'exit'].join('\n'), `SAT ${endpoint}`, 'cn5164')}><ShieldCheck size={13} />Validate config ({endpoint})</button>;
  };
  return <>
    <PageHead eyebrow="VALIDATE / SERVICE ACTIVATION" title="SAT benchmark creator"
      actions={<><button className="button" onClick={() => void shareSettings('sat', input)}><Share2 size={14} />Share settings</button><Segments label="Detail level" options={modeOptions} value={mode} onChange={setDetailLevel} /><ResetButton onReset={() => setInput(Sat.defaults())} /></>} />
    <div className="builder-layout sat-layout sat-layout-side-by-side"><div className="builder-form">
      <Panel title="Traffic & test profile" className="sat-traffic">
        <FormFields input={input} fields={[...trafficFields, ...outageFields]} onChange={updateInput} />
        <SatTestTypes input={input} mode={mode} onChange={setInput} />
        {input.benchmarkType === 'outage' && <div className="issue-error mt-5" role="alert">
          <strong>Outage does not stop automatically.</strong>
          <p>Supported only on 3922, 3924, 3926, 3928, 3931, 3948, 3949, 5144, 5162, 5170, and 5171.</p>
          <p>Manually run <code>sat stop test-instances test-instance {input.name}</code> before collecting statistics.</p>
        </div>}
      </Panel>
      <Panel title="Generator" description="The node that originates test traffic." className="sat-generator">
        <FormFields input={input} fields={satEndpointFields(satGenerator, input.generatorPlatform)} onChange={setInput} />
      </Panel>
      <Panel title="Reflector" description="The node that reflects traffic back to the generator." className="sat-reflector">
        <FormFields input={input} fields={satEndpointFields(satReflector, input.reflectorPlatform)} onChange={setInput} />
      </Panel>
      {mode === 'advanced' && <Panel id="sat-advanced-settings" title="Advanced test options" className="sat-advanced">
        <FormFields input={input} fields={advancedFields} onChange={updateInput} advanced />
      </Panel>}
      <button type="button" className="text-action" aria-expanded={mode === 'advanced'} aria-controls="sat-advanced-settings"
        onClick={() => setDetailLevel(mode === 'basic' ? 'advanced' : 'basic')}>{mode === 'basic' ? 'Show' : 'Hide'} Advanced</button>
    </div><div className="builder-results">
      <Issues errors={out.errors} warnings={out.warnings} />
      <OutputTabs filename={`${input.name || 'sat'}-benchmark.txt`} text={text} disabled={out.errors.length > 0}
        actions={<>{review('generator')}{review('reflector')}</>} tabs={[
        { id: 'config', label: 'Config', content: <>
          <CodeBlock title={`Configure Generator - ${input.generatorPlatform}`} lines={out.generatorConfig} />
          <CodeBlock title={`Configure Reflector - ${input.reflectorPlatform}`} lines={out.reflectorConfig} />
        </> },
        { id: 'ops', label: 'Run & verify', content: <>
          <CodeBlock title={`Activate Generator - ${input.generatorPlatform}`} lines={out.generatorOps.slice(0, activationCount)} individualCopy />
          {input.benchmarkType === 'outage' ? <>
            <CodeBlock title="Stop Outage manually before collecting statistics" lines={out.generatorOps.slice(activationCount, activationCount + 1)} individualCopy />
            <CommandCodeBlock title={`Post-test verification Generator - ${input.generatorPlatform}`} lines={out.generatorOps.slice(activationCount + 1)} individualCopy />
            <CodeBlock title={`Post-test verification Reflector - ${input.reflectorPlatform}`} lines={out.reflectorOps} individualCopy />
          </> : blocks('Validate', out.generatorOps.slice(activationCount), out.reflectorOps, true)}
        </> },
        { id: 'remove', label: 'Remove', content: <><p className="note">Capture statistics first. Removal disables global SAT/benchmark operation and removes a reusable KPI profile. Check other tests and profile users before applying.</p>{blocks('Remove', out.generatorRemove, out.reflectorRemove)}</> },
      ]} />
    </div></div>
  </>;
}
