import { Component, createContext, useContext, useId, useState, type ComponentProps, type ReactNode, type ErrorInfo } from 'react';
import { withInlineComments } from '../lib/config-comments.js';
import { DEVICE_392X } from '../generator/l2evc.js';
import { ArrowLeft, Check, ChevronDown, CircleHelp, Copy, Download, RotateCcw } from 'lucide-react';
import type { Field, L2Input, Value } from './state';
import { copyText, downloadFile, fieldValue } from './state';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI rendering failed', error, info.componentStack); }
  render() {
    return this.state.error ? <div className="max-w-xl mx-auto p-8" role="alert">
      <h1>Something interrupted the workspace.</h1><p className="my-5">{this.state.error}</p>
      <p className="entry-note mb-5">Your saved configuration has not been cleared. Reload to restore the workspace.</p>
      <button className="button primary" onClick={() => location.reload()}>Reload workspace</button>
    </div> : this.props.children;
  }
}

export function PageHead({ eyebrow, title, description, actions }: {
  eyebrow: string; title: string; description?: string; actions?: ReactNode;
}) {
  return <header className="page-heading">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="lead">{description}</p>}</div>
    {actions && <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">{actions}</div>}
  </header>;
}

export function Panel({ title, description, children, className = '', id, actions }: {
  title?: string; description?: ReactNode; children: ReactNode; className?: string; id?: string; actions?: ReactNode;
}) {
  return <section id={id} className={`panel ${className}`}>
    {(title || description) && <div className={`panel-heading${actions ? ' panel-heading-actions' : ''}`}>
      <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}
    </div>}
    {children}
  </section>;
}

export function Segments<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly { id: T; label: string }[]; value: T; onChange: (value: T) => void;
}) {
  return <div className="segments" role="group" aria-label={label}>{options.map(option =>
    <button type="button" key={option.id} data-mode={option.id} aria-pressed={value === option.id}
      onClick={() => onChange(option.id)}>{option.label}</button>)}</div>;
}

export function InputField({ label, value, onChange, hint, options, check = false, advanced = false, id: givenId }: {
  label: ReactNode; value: Value; onChange: (value: Value) => void; hint?: ReactNode;
  options?: readonly string[]; check?: boolean; advanced?: boolean; id?: string;
}) {
  const generatedId = useId();
  const id = givenId || generatedId;
  const helperId = `${id}-hint`;
  const props = { id, 'aria-describedby': hint ? helperId : undefined };
  return <div className={`input-field ${advanced ? 'is-advanced' : ''}`} data-field={givenId}>
    {check ? <label className="check-label" htmlFor={id}>
      <input {...props} type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label> : <>
      <label className="field-label" htmlFor={id}>{label}</label>
      {options ? <div className="select-wrap"><select {...props} value={String(value)} onChange={e => onChange(e.target.value)}>
        {options.map(option => <option key={option} value={option}>{option || 'Automatic'}</option>)}
      </select><ChevronDown size={14} aria-hidden="true" /></div>
        : <input {...props} type="text" value={String(value)} onChange={e => onChange(e.target.value)} spellCheck={false} />}
    </>}
    {hint && <div className="field-hint" id={helperId} style={typeof hint === 'string' ? { whiteSpace: 'pre-line' } : undefined}>{hint}</div>}
  </div>;
}

export function L2Fields({ input, fields, advanced, onChange, onFocus, prefix = 'l2' }: {
  input: L2Input; fields: Field[]; advanced: boolean;
  onChange: (path: string, value: Value) => void; onFocus?: (objects: string[]) => void;
  prefix?: string;
}) {
  const nestedOptions = fields.filter(f => /\.(allTags|untagged|l2cp)$/.test(f.path) && fields.some(v => v.path === `${f.side}.vlan`)
    && (!f.when || f.when(input)));
  return <div className="field-grid">{fields.filter(f => !nestedOptions.includes(f) && (advanced || f.tier !== 'advanced') &&
    (!f.when || f.when(input)) && (!f.path.endsWith('.mtu') || input.emitMtu)).map(f =>
    <div key={f.path} className={f.path.endsWith('.vlan') && nestedOptions.some(option => option.side === f.side) ? 'vlan-field-row' : undefined}
      onMouseEnter={() => onFocus?.(f.side ? [`fp-${f.side}`, `port-${f.side}`] : [f.path.startsWith('cfm') ? 'cfm' : 'fd'])}
      onMouseLeave={() => onFocus?.([])}>
      <InputField id={`${prefix}-${f.path.replaceAll('.', '-')}`} label={f.path === 'device'
        ? <span className="device-field-label">{f.label}<span className="device-confirmation"><ArrowLeft size={13} aria-hidden="true" />Confirm Accurate!</span></span>
        : (f.side === 'left' || f.side === 'right') && f.path.endsWith('.vlan')
        ? input[f.side].role === 'ENNI' ? 'S-VLAN' : input[f.side].allTags && input.cfm.enabled
          && input.cfm.endpoint.toLowerCase() === f.side ? 'VLAN for Service OAM' : f.label : f.label} value={fieldValue(input, f.path)}
        onChange={value => onChange(f.path, value)} options={f.options} check={f.type === 'check'} advanced={f.tier === 'advanced'}
        hint={f.path === 'emitMtu' ? undefined : f.path.endsWith('.pfg') && input.device === DEVICE_392X
          ? 'Not supported by this builder on 392x. Logical-port PFG group policies require separate configuration.'
          : f.path.endsWith('.vlan') ? <details>
            <summary><CircleHelp size={13} className="inline" aria-hidden="true" /> VLAN input help</summary>
            Enter a single ID (350), a range (350-352), or a comma-separated list (350, 352). You can mix ranges and IDs.
            IDs must be 1-4094. Consecutive IDs share a range classifier. An egress push or stamp needs a single VLAN.
          </details>
          : f.path === 'cfm.localMep' ? <>Must match the <strong><u>far end's Remote MEP ID</u></strong>.</>
          : f.path === 'cfm.remoteMep' ? <>Must match the <strong><u>far end's Local MEP ID</u></strong>.</>
          : typeof f.hint === 'function' ? f.hint(input) : f.hint} />
      {f.path === 'emitMtu' && input.emitMtu && <div className="mt-3">
        <InputField id={`${prefix}-l2-mtu`} label="L2 MTU Size" value={input.left.mtu}
          onChange={value => { onChange('left.mtu', value); onChange('right.mtu', value); }} advanced
          hint={<>{f.hint} <a className="text-action" href="#/cheatsheet?section=mtu-sizes">MTU Details</a></>} />
        {input.left.mtu !== input.right.mtu && <p className="field-hint" role="status">
          Saved endpoint values differ (left: {input.left.mtu}, right: {input.right.mtu}). Enter a value here to update both.
        </p>}
      </div>}
      {f.path.endsWith('.vlan') && nestedOptions.some(option => option.side === f.side) && <div className="vlan-options">
        <L2Fields input={input} fields={nestedOptions.filter(option => option.side === f.side)} advanced={advanced}
          onChange={onChange} onFocus={onFocus} prefix={prefix} />
      </div>}
      {f.path.endsWith('.l2cp') && fieldValue(input, f.path) === true && <div className="mt-3">
        <InputField id={`${prefix}-${f.side}-l2cpProfile`} label="L2CP Profile" value={input.l2cpProfile}
          onChange={value => onChange('l2cpProfile', value)} advanced
          hint="Shared profile for enabled endpoints. Must already exist on the node (see the FWD_ALL sample)." />
      </div>}
    </div>)}</div>;
}

export function Issues({ errors = [], warnings = [] }: { errors?: string[]; warnings?: string[] }) {
  if (!errors.length && !warnings.length) return null;
  return <div className="issues" role={errors.length ? 'alert' : 'status'}>
    {errors.length > 0 && <div className="issue-error"><strong>Resolve before applying</strong><ul>{errors.map((msg, i) => <li key={i}>{msg}</li>)}</ul></div>}
    {warnings.length > 0 && <div className="issue-warning"><strong>Review service impact</strong><ul>{warnings.map((msg, i) => <li key={i}>{msg}</li>)}</ul></div>}
  </div>;
}

export function CodeBlock({ title, lines, onFocus, highlighted = [], individualCopy = false }: {
  title: string; lines: readonly (string | { text: string; objects?: string[]; explain?: string })[];
  onFocus?: (objects: string[]) => void; highlighted?: string[]; individualCopy?: boolean;
}) {
  const text = lines.map(line => typeof line === 'string' ? line : line.text).join('\n');
  const multipleCommands = individualCopy && lines.filter(line => {
    const value = typeof line === 'string' ? line : line.text;
    return value.trim() && !value.trimStart().startsWith('#');
  }).length > 1;
  return <div className="code-block">
    <div className="code-heading"><span>{title}</span><button className="code-copy" type="button"
      onClick={() => void copyText(text)} aria-label={`${multipleCommands ? 'Copy all' : 'Copy'} ${title}`}><Copy size={14} /> {multipleCommands ? 'Copy All' : 'Copy'}</button></div>
    <pre>{lines.length ? lines.map((line, i) => {
      const data = typeof line === 'string' ? { text: line } : line;
      return <span key={i} className={`code-line ${data.text.startsWith('#') ? 'is-comment' : ''} ${data.objects?.some(o => highlighted.includes(o)) ? 'is-highlighted' : ''}`}
        title={data.explain} onMouseEnter={() => onFocus?.(data.objects || [])} onMouseLeave={() => onFocus?.([])}>
        <span className="line-number" aria-hidden="true">{i + 1}</span><code>{data.text || ' '}</code>
        {multipleCommands && data.text.trim() && !data.text.trimStart().startsWith('#') && <button type="button"
          className="code-copy command-line-copy" aria-label={`Copy command ${i + 1} from ${title}`}
          onClick={() => void copyText(data.text)}><Copy size={14} aria-hidden="true" /> Copy</button>}{'\n'}
      </span>;
    }) : <code className="p-4 block">No commands available. Resolve the input errors above.</code>}</pre>
  </div>;
}

const InlineComments = createContext(false);

export function CreatorCodeBlock(props: ComponentProps<typeof CodeBlock>) {
  const enabled = useContext(InlineComments);
  return <CodeBlock {...props} lines={withInlineComments(props.lines, enabled)} />;
}

export function OutputTabs({ tabs, filename, text: rawText, disabled = false, inlineComments, actions }: {
  tabs: { id: string; label: string; content: ReactNode }[]; filename: string; text: string; disabled?: boolean;
  inlineComments?: { enabled: boolean; onChange: (enabled: boolean) => void };
  actions?: ReactNode;
}) {
  const text = rawText.split('\n').reduce<string[][]>((blocks, line) => {
    if (/^# /.test(line)) blocks.push([line], []); else blocks[blocks.length - 1].push(line);
    return blocks;
  }, [[]]).flatMap(block => /^# /.test(block[0] ?? '') ? block : withInlineComments(block, inlineComments?.enabled)).join('\n');
  const [active, setActive] = useState(tabs[0].id);
  const id = useId();
  return <Panel title="Configs and Commands" className="output-panel" actions={
    <div className="flex flex-wrap gap-2">{actions}
      <button className="button button-small" disabled={disabled} onClick={() => downloadFile(filename, text)}><Download size={13} />Download .txt</button>
    </div>}>
    {inlineComments && <label className="inline-comment-toggle mb-4">
      <input type="checkbox" checked={inlineComments.enabled} onChange={event => inlineComments.onChange(event.target.checked)} />
      <span><strong>Include inline Comments</strong>: Add brief # comments before each command section.</span>
    </label>}
    <div className="tab-list" role="tablist" aria-label="Generated commands">{tabs.map(tab =>
      <button key={tab.id} id={`${id}-${tab.id}`} role="tab" aria-selected={active === tab.id} aria-controls={`${id}-panel`}
        tabIndex={active === tab.id ? 0 : -1}
        onKeyDown={e => {
          const index = tabs.findIndex(t => t.id === active);
          const next = e.key === 'ArrowRight' ? (index + 1) % tabs.length : e.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
          if (next < 0) return;
          e.preventDefault(); setActive(tabs[next].id); document.getElementById(`${id}-${tabs[next].id}`)?.focus();
        }}
        onClick={() => setActive(tab.id)}>{tab.label}</button>)}</div>
    <div className="tab-body" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>
      <InlineComments.Provider value={inlineComments?.enabled ?? false}>{tabs.find(tab => tab.id === active)?.content}</InlineComments.Provider>
    </div>
  </Panel>;
}

export function ResetButton({ onReset }: { onReset: () => void }) {
  return <button className="button" onClick={() => { if (window.confirm('Restore all default values for this tool?')) onReset(); }}><RotateCcw size={14} />Reset</button>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state"><Check size={20} /><p>{children}</p></div>;
}
