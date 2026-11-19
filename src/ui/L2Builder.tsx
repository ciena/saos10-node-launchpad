import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, Share2, ShieldCheck } from 'lucide-react';
import { Model } from '../lib/model.js';
import * as Engine from '../generator/l2evc.js';
import { CFM_EXTRA_FIELDS, CFM_EXTRA_DEFAULTS, cfmOptionActive } from '../generator/cfm-options.js';
import { SERVICE_FIELDS, SIDE_BASIC, SIDE_ADVANCED, CFM_BASIC, CFM_ADVANCED, sideFields } from '../schema/l2-fields.js';
import { CreatorCodeBlock as CodeBlock, Issues, L2Fields, OutputTabs, PageHead, Panel, ResetButton, Segments } from './components';
import { copyText, isRecord, matchesDefaults, notify, readStored, startConfigReview, useStored, writeStored, type Field, type L2Input, type Value } from './state';
import { Diagram, isVisualKind, visuals, type Kind } from './Visualizations';

const addOamDefaults = (value: unknown) => {
  if (!isRecord(value) || !isRecord(value.cfm)) return value;
  const cfm = { ...CFM_EXTRA_DEFAULTS, ...value.cfm };
  const removed = ['lossResponder', 'slmResponder', 'delayResponder'].filter(key => cfm[key]);
  for (const key of ['lossResponder', 'slmResponder', 'delayResponder']) delete cfm[key];
  const removedMacTargets = ['dmmRemoteMac', 'slmRemoteMac'].filter(key => cfm[key]);
  for (const key of ['dmmRemoteMac', 'slmRemoteMac']) delete cfm[key];
  for (const key of ['mdPermission', 'maPermission']) {
    if (cfm[key] === 'chassisManage') cfm[key] = 'chassis-manage';
  }
  if (removed.length) setTimeout(() => notify('Removed unsupported responder overrides from this configuration: SAOS 10 exposes responder state as read-only. Other settings are preserved.'), 0);
  if (removedMacTargets.length) setTimeout(() => notify('Removed unsupported DMM/SLM MAC targets. Sessions now use their Remote MEP ID override, or Remote MEP ID when blank. Verify those IDs before applying; other settings are preserved.'), 0);
  return { ...value, cfm };
};
const veryAdvancedGroups = [
  ['global', 'Global CFM (one-time setup)'], ['md', 'Selected maintenance domain (one-time setup)'],
  ['ma', 'Maintenance association'], ['mep', 'Local MEP'], ['ccm', 'Continuity checking'],
  ['tag', 'CFM frame tags'], ['dmm', 'Delay measurement'], ['slm', 'Synthetic loss measurement'],
] as const;
const veryAdvancedFields = (section: string): Field[] => CFM_EXTRA_FIELDS.filter(f => f.section === section).map(f => ({
  path: `cfm.${f.key}`, label: f.label, type: f.type === 'check' ? 'check' : 'text', options: f.options,
  hint: f.hint, tier: 'advanced', when: input => cfmOptionActive(input.cfm, f),
}));

export function useL2Model() {
  const [model] = useState(() => {
    const fallback = Engine.defaults();
    const saved = readStored('l2evc-state', fallback, (v): v is L2Input => matchesDefaults(v, fallback), value => {
      const migrated = addOamDefaults(value);
      const cfm = isRecord(value) ? value.cfm : undefined;
      if (isRecord(cfm)
        && ['dmmRemoteMac', 'slmRemoteMac'].some(key => Object.hasOwn(cfm, key))
        && matchesDefaults(migrated, fallback)) writeStored('l2evc-state', migrated);
      return migrated;
    });
    const param = new URLSearchParams(location.hash.split('?')[1]).get('s');
    if (param) {
      const shared = addOamDefaults(Model.fromParam(param));
      if (matchesDefaults(shared, fallback)) return new Model(shared);
      setTimeout(() => notify('This shared configuration is invalid. Your saved settings are shown instead.'), 0);
    }
    return new Model(saved);
  });
  const [input, setInput] = useState(model.input);
  const [focused, setFocused] = useState<string[]>([]);
  useEffect(() => {
    const off = model.on(() => { setInput(model.input); writeStored('l2evc-state', model.input); });
    const offFocus = model.onFocus(setFocused);
    const param = new URLSearchParams(location.hash.split('?')[1]).get('s');
    if (param && matchesDefaults(addOamDefaults(Model.fromParam(param)), Engine.defaults())) {
      writeStored('l2evc-state', model.input);
      history.replaceState(null, '', '#/l2evc');
      notify('Shared configuration loaded');
    }
    return () => { off(); offFocus(); };
  }, [model]);
  return { model, input, out: model.out, focused };
}
type FormLayout = 'split' | 'wizard' | 'mirror';
const isFormLayout = (v: unknown): v is FormLayout => v === 'split' || v === 'wizard' || v === 'mirror';
const layoutOptions = [{ id: 'split', label: 'Split view' }, { id: 'wizard', label: 'Guided steps' }, { id: 'mirror', label: 'Endpoint mirror' }] as const;

export function L2Builder() {
  const { model, input, out, focused } = useL2Model();
  const [layout, setLayout] = useStored('l2evc-layout', 'split', isFormLayout);
  const [mode, setMode] = useStored('l2evc-mode', 'basic', (v): v is 'basic' | 'advanced' => v === 'basic' || v === 'advanced');
  const [visual, setVisual] = useStored('l2evc-visual', 'walk', isVisualKind,
    value => isVisualKind(value) ? value : 'walk');
  const [step, setStep] = useState(0);
  const [walkExpanded, setWalkExpanded] = useState(false);
  const [veryAdvanced, setVeryAdvanced] = useState(false);
  const [inlineComments, setInlineComments] = useStored('l2evc-inline-comments', false, (v): v is boolean => typeof v === 'boolean');
  useEffect(() => {
    const requested = new URLSearchParams(location.hash.split('?')[1]).get('layout');
    if (isFormLayout(requested)) setLayout(requested);
  }, [setLayout]);
  const advanced = mode === 'advanced';
  const change = (path: string, value: Value) => {
    if ((path === 'left.role' || path === 'right.role') && value === 'ENNI') {
      const side = path === 'left.role' ? 'left' : 'right';
      const endpoint = model.input[side];
      const removed = (['allTags', 'untagged', 'l2cp'] as const).filter(key => endpoint[key])
        .map(key => key === 'allTags' ? 'All Tags' : key === 'untagged' ? 'Untagged' : 'L2CP');
      model.replace({ ...model.input, [side]: { ...endpoint, role: value, allTags: false, untagged: false, l2cp: false } });
      if (removed.length) notify(`${side === 'left' ? 'Left' : 'Right'} endpoint changed to ENNI: disabled UNI-only options (${removed.join(', ')}). S-VLAN matching is now used.`);
    } else model.set(path, value);
  };
  const fields = (items: Field[]) => <L2Fields input={input} fields={items} advanced={advanced} onChange={change} onFocus={objects => model.focus(objects)} />;
  const service = <Panel title="Service">{fields(SERVICE_FIELDS)}</Panel>;
  const endpoint = (side: 'left' | 'right') => <Panel key={side} title={`${side === 'left' ? 'Left' : 'Right'} endpoint`}
    description={side === 'left' ? 'Usually the customer-facing UNI.' : 'Usually the network-facing ENNI or a second UNI.'}>
    {fields(sideFields(side, [...SIDE_BASIC, ...SIDE_ADVANCED]))}</Panel>;
  const oam = <Panel title="Service OAM" description={
    <label className="check-label" htmlFor="l2-cfm-enabled">
      <input id="l2-cfm-enabled" type="checkbox" checked={input.cfm.enabled}
        onChange={event => change('cfm.enabled', event.target.checked)} />
      <span>Enable 802.1ag CFM / Y.1731 delay and loss measurement.</span>
    </label>
  }>
    <L2Fields input={input} fields={[...CFM_BASIC, ...CFM_ADVANCED]} advanced={advanced}
      onChange={change} onFocus={objects => model.focus(objects)} />
    {advanced && <button type="button" className="text-action mt-5" aria-expanded={veryAdvanced} aria-controls="very-advanced-oam"
      onClick={() => setVeryAdvanced(!veryAdvanced)}>{veryAdvanced ? 'Hide' : 'Show'} Very Advanced</button>}
    {advanced && veryAdvanced && <div id="very-advanced-oam" className="mt-5">
      {veryAdvancedGroups.filter(([section]) => veryAdvancedFields(section).some(f => !f.when || f.when(input))).map(([section, title]) =>
        <fieldset key={section} className="mt-5">
          <legend className="field-label mb-3">{title}</legend>
          <L2Fields input={input} fields={veryAdvancedFields(section)} advanced onChange={change}
            onFocus={objects => model.focus(objects)} />
        </fieldset>)}
    </div>}
    <div className="mt-5"><button type="button" className="text-action" aria-expanded={advanced}
      onClick={() => setMode(advanced ? 'basic' : 'advanced')}>{advanced ? 'Hide' : 'Show'} Advanced</button></div>
  </Panel>;
  const errors = out.warnings.filter(w => w.level === 'error').map(w => w.msg);
  const warnings = out.warnings.filter(w => w.level === 'warn').map(w => w.msg);
  const commandLines = [...out.config, ...(input.cfm.enabled ? out.cfm.config : [])].filter(line => !line.skip);
  const fullText = [
    '# Config', Engine.configText(out), '# Verify', ...out.show, ...(input.cfm.enabled ? out.cfm.show : []),
    '# Remove - check shared classifier usage', 'config', ...out.nuke, 'exit',
  ].join('\n');
  const output = <OutputTabs filename={`${input.serviceName || 'service'}-l2evc.txt`} text={fullText} disabled={errors.length > 0}
    actions={<button className="button button-small" disabled={errors.length > 0} onClick={() => startConfigReview(
      Engine.configText(out), 'L2 EVC builder', input.device === Engine.DEVICE_392X ? 'cn3926' : 'cn5164')}>
      <ShieldCheck size={13} />Validate config
    </button>}
    inlineComments={{ enabled: inlineComments, onChange: setInlineComments }} tabs={[
    { id: 'config', label: 'Config', content: <>
      <CodeBlock title="Service configuration" lines={errors.length ? [] : ['config', ...commandLines, 'exit']} highlighted={focused} onFocus={objects => model.focus(objects)} />
      {(['left', 'right'] as const).filter(side => out.fixedCos[side].used).map(side => <CodeBlock key={side} title={`Fixed CoS profile - ${side}`} lines={out.fixedCos[side].lines} />)}
    </> },
    { id: 'show', label: 'Verify', content: <CodeBlock title="Service & CFM verification" lines={[...out.show, ...(input.cfm.enabled ? out.cfm.show : [])]} /> },
    { id: 'nuke', label: 'Remove', content: <><p className="note">Shared classifiers may be used by other services. Check before removing.</p><CodeBlock title="Service removal" lines={errors.length ? [] : ['config', ...out.nuke, 'exit']} /></> },
    { id: 'global', label: 'One-time setup', content: <>
      <CodeBlock title="Global CFM" lines={out.cfm.global} />
      <CodeBlock title="Template classifiers" lines={Engine.SAMPLE_ONE_TIME.classifiers} />
      {(input.left.l2cp || input.right.l2cp) && <CodeBlock title="L2CP forwarding" lines={Engine.SAMPLE_ONE_TIME.l2cp} />}
      <CodeBlock title="Sample meter profiles" lines={Engine.SAMPLE_ONE_TIME.meters} />
    </> },
  ]} />;
  const selectedVisual = visuals.find(option => option.id === visual)!;
  const diagramId = visual === 'walk' ? 'packet-walk-diagram' : `${visual}-diagram`;
  const packetWalk = <Panel id={visual === 'walk' ? 'live-packet-walk' : 'live-visualization'}
    title={visual === 'walk' ? 'Live packet walk' : selectedVisual.title}
    description={selectedVisual.description}
    actions={<div className="flex flex-wrap justify-end gap-2">
        <button className="button" aria-expanded={walkExpanded} aria-controls={diagramId}
          onClick={() => setWalkExpanded(!walkExpanded)}>
          {walkExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{walkExpanded ? 'Collapse' : 'Expand'}
        </button>
    </div>}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <Segments label="Visualization" value={visual} options={visuals.map(option => ({ id: option.id, label: option.title }))}
        onChange={(value: Kind) => { setVisual(value); setWalkExpanded(false); model.select([]); }} />
    </div>
    {visual !== 'map' && [out.diagram.K12, out.diagram.V15].some(label => /[,-]/.test(label)) &&
      <p className="entry-note">The packet walk uses the lowest VLAN in each set as an example. Classifier labels describe the full match.</p>}
    <div id={diagramId}>
      <Diagram model={model} kind={visual} />
    </div>
  </Panel>;
  const result = <div className="builder-results">{!walkExpanded && packetWalk}<Issues errors={errors} warnings={warnings} />{output}</div>;
  const steps = ['Service', 'Left endpoint', 'Right endpoint', 'Service OAM', 'Review & copy'];
  return <>
    <PageHead eyebrow="CONFIGURE / ETHERNET SERVICES" title="Single-node service creator."
      description="Configure the endpoints and follow the frame through classifiers, transforms and the forwarding domain."
      actions={<>
        <Segments label="Form layout" value={layout} options={layoutOptions} onChange={setLayout} />
        <button className="button" onClick={() => void copyText(`${location.href.split('#')[0]}#/l2evc?s=${model.shareParam()}`)}><Share2 size={14} />Share settings</button>
        <Segments label="Detail level" options={[{ id: 'basic', label: 'Basic' }, { id: 'advanced', label: 'Advanced' }]} value={mode} onChange={setMode} />
        <ResetButton onReset={() => model.reset()} />
      </>} />
    {layout === 'wizard' && <nav className="wizard-steps" aria-label="Configuration steps">{steps.map((title, index) =>
      <button key={title} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{title}</button>)}</nav>}
    {walkExpanded && <div className="expanded-packet-walk mb-5">{packetWalk}</div>}
    {layout === 'mirror' ? <div className="mirror-layout">{service}<div className="mirror-endpoints">{endpoint('left')}{endpoint('right')}</div>{oam}{result}</div>
      : <div className="builder-layout"><div className="builder-form">
        {(layout !== 'wizard' || step === 0) && service}
        {(layout !== 'wizard' || step === 1) && endpoint('left')}
        {(layout !== 'wizard' || step === 2) && endpoint('right')}
        {(layout !== 'wizard' || step === 3) && oam}
        {layout === 'wizard' && step === 4 && <Panel title="Review & copy"><p className="entry-note">Save a text copy or share the input settings.</p><Issues errors={errors} warnings={warnings} /></Panel>}
        {!advanced && <p className="note">Basic mode keeps essential fields visible. Advanced mode adds QoS, tag operations, TPIDs and detailed CFM timers.</p>}
        {layout === 'wizard' && <div className="flex justify-between gap-3">
          <button className="button" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft size={14} />Back</button>
          <button className="button primary" disabled={step === 4} onClick={() => setStep(step + 1)}>Next<ArrowRight size={14} /></button>
        </div>}
      </div>{result}</div>}
  </>;
}
