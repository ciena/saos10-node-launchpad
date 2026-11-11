import { useRef, useState, type FormEvent } from 'react';
import { ExternalLink, ShieldCheck, X } from 'lucide-react';
import { DEFAULT_SAOS_VERSION, DEFAULT_TRANSLATOR_URL, validateSaosCli, type SaosValidation } from '../lib/translator.js';
import { PageHead, Panel } from './components';
import { isRecord, notify } from './state';

const pendingKey = 'snl-config-review';
const releaseOptions = [
  { value: '10_12_00_0228', label: '10.12.00-0228', platforms: ['cn3926', 'cn3984', 'cn5130', 'cn5144', 'cn5162', 'cn5164', 'cn5166', 'cn5170', 'cn5171', 'cn8110', 'cn8112', 'cn8114'] },
  { value: '10_11_02_0199', label: '10.11.02-0199', platforms: ['cn3926', 'cn3984', 'cn5130', 'cn5162', 'cn5164', 'cn5170', 'cn5171', 'cn8110', 'cn8112', 'cn8114'] },
  { value: '10_11_01_0248', label: '10.11.01-0248', platforms: ['cn3984', 'cn5130', 'cn5162', 'cn5164', 'cn5170', 'cn5171', 'cn8110', 'cn8112', 'cn8114'] },
] as const;
const getRelease = (value: string) => releaseOptions.find(option => option.value === value) || releaseOptions[0];
interface PendingReview { cli: string; source: string; platform: string }
const isPendingReview = (value: unknown): value is PendingReview => isRecord(value)
  && typeof value.cli === 'string' && typeof value.source === 'string' && typeof value.platform === 'string';
function readPending(): PendingReview | null {
  try {
    const raw = sessionStorage.getItem(pendingKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    sessionStorage.removeItem(pendingKey);
    return isPendingReview(value) ? value : null;
  } catch (error) {
    notify(`Could not restore the pending configuration for review: ${String(error)}`);
    return null;
  }
}

export function ConfigReview() {
  const [pending] = useState(readPending);
  const [cli, setCli] = useState(pending?.cli || '');
  const [source] = useState(pending?.source || 'Pasted configuration');
  const [saosVersion, setSaosVersion] = useState(DEFAULT_SAOS_VERSION);
  const [platform, setPlatform] = useState<string>(() => {
    const platforms = getRelease(DEFAULT_SAOS_VERSION).platforms;
    return platforms.find(option => option === pending?.platform) || 'cn5164';
  });
  const [result, setResult] = useState<SaosValidation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);

  async function validate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const verdict = await validateSaosCli({ cli, saosVersion, platform, signal: request.signal });
      setResult(verdict);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason);
      setError(request.signal.aborted ? 'Validation cancelled.' : detail);
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  return <>
    <PageHead eyebrow="VALIDATE / SAOS10" title="Config Validator"
      description="Review generated configuration locally. Online YANG validation is available only in builds configured with an approved translator endpoint."
      actions={DEFAULT_TRANSLATOR_URL ? <a className="button" href={DEFAULT_TRANSLATOR_URL.replace(/\/mcp\/?$/, '/')} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={14} />Open Translator app
      </a> : undefined} />
    <form className="config-review" onSubmit={event => void validate(event)}>
      <Panel title="Configuration and target" description={source}>
        <div className="field-grid">
          <div className="input-field">
            <label className="field-label" htmlFor="review-release">SAOS release</label>
            <div className="select-wrap"><select id="review-release" value={saosVersion} onChange={event => {
              const choice = event.target.value;
              setSaosVersion(choice);
              const availablePlatforms = getRelease(choice).platforms;
              if (!availablePlatforms.some(option => option === platform)) setPlatform(availablePlatforms[0]);
              setResult(null);
            }}>
              {releaseOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></div>
            <div className="field-hint">Choose the release running on the target node. The translator ID uses underscores.</div>
          </div>
          <div className="input-field">
            <label className="field-label" htmlFor="review-platform">Platform</label>
            <div className="select-wrap"><select id="review-platform" value={platform} onChange={event => {
              setPlatform(event.target.value);
              setResult(null);
            }}>
              {getRelease(saosVersion).platforms.map(option => <option key={option} value={option}>{option}</option>)}
            </select></div>
            <div className="field-hint">Platform controls bootstrap state and YANG feature gates; availability can vary by release.</div>
          </div>
        </div>
        <label className="field-label mt-5" htmlFor="review-cli">SAOS10 CLI configuration</label>
        <textarea id="review-cli" rows={18} spellCheck={false} value={cli} onChange={event => { setCli(event.target.value); setResult(null); }}
          placeholder={'config\nfds fd CUSTOMER-A mode vpls\n...'} />
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="button primary" type="submit" disabled={busy || !cli.trim() || !DEFAULT_TRANSLATOR_URL}>
            <ShieldCheck size={14} />{busy ? 'Validating...' : DEFAULT_TRANSLATOR_URL ? 'Review with SAOS Translator' : 'Online validation unavailable'}
          </button>
          {busy && <button className="button" type="button" onClick={() => controller.current?.abort()}><X size={14} />Cancel</button>}
          <button className="button" type="button" disabled={!cli} onClick={() => { setCli(''); setResult(null); setError(''); }}>Clear</button>
        </div>
      </Panel>
      <Panel title="Where this review runs">
        <p className="entry-note">{DEFAULT_TRANSLATOR_URL
          ? <>The configuration is sent only after you select <strong>Review with SAOS Translator</strong>, to the configured endpoint <a className="text-action" href={DEFAULT_TRANSLATOR_URL} target="_blank" rel="noopener noreferrer">{DEFAULT_TRANSLATOR_URL}</a>. Avoid secrets and management credentials.</>
          : 'Remote validation is not configured in this build. No configuration is sent, and no validation verdict is produced.'}
          {' '}Launchpad does not connect to a device or save this text as a profile.</p>
        <p className="entry-note mt-3">Local generator checks, YANG validation and hardware evidence are different levels of evidence. A passing YANG result applies only to the selected release and platform; it does not prove that the feature works on a device or has passed a lab test.</p>
        {location.protocol === 'file:' && <p className="note mt-3">Standalone-file generation works offline. Remote validation requires a configured online service and permission for local-file browser requests (CORS).</p>}
      </Panel>
      {busy && <p role="status" className="note">Waiting for the SAOS Translator. Its first validation for a release may take longer while the models load.</p>}
      {error && <Panel title="Validation unavailable" ><p role="alert" className="issue-error">{error}</p></Panel>}
      {result && <Panel title="Validation evidence" className="validation-result">
        <p role={result.valid ? 'status' : 'alert'} className={result.valid ? 'validation-pass' : 'issue-error'}>
          <strong>{result.valid ? 'YANG validation passed' : 'YANG validation found issues'}</strong>
          {' '}- SAOS {saosVersion} - {platform}
        </p>
        {result.message && <p className="entry-note mt-3">{result.message}</p>}
        {!result.details?.length && <p className="entry-note mt-3">No diagnostics were returned. Hardware and lab verification remain unconfirmed.</p>}
        {result.details?.length ? <ul className="validation-diagnostics">{result.details.map((item, index) => <li key={`${item.line}-${item.code}-${index}`}>
          <span className={`diagnostic-severity severity-${item.severity || 'error'}`}>{item.severity || 'error'}</span>
          {item.line ? <span>Line {item.line}</span> : null}
          {item.code && <code>{item.code}</code>}
          <span>{item.message || 'No diagnostic message was provided.'}</span>
          {item.src_line && <pre>{item.src_line}</pre>}
        </li>)}</ul> : null}
        <div className="evidence-classes mt-5" aria-label="Support evidence classification">
          <p><strong>YANG semantic validation</strong><span>{result.valid ? 'Passed' : 'Diagnostics returned'} - SAOS {saosVersion} - {platform}</span></p>
          <p><strong>Published documentation</strong><span>Not checked by this validation action.</span></p>
          <p><strong>Hardware / lab verification</strong><span>Not checked. No device or lab was contacted.</span></p>
          <p><strong>Feature support conclusion</strong><span>Unclassified. A YANG pass is not proof of hardware support; diagnostics are not automatically an unsupported-feature verdict.</span></p>
        </div>
      </Panel>}
    </form>
  </>;
}
