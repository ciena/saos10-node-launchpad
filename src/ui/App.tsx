import { useEffect, useRef, useState, type ComponentType } from 'react';
import { ArrowRight, BookOpen, Cable, CheckCircle2, ChevronRight, Download, LayoutDashboard, Menu, Moon, Network, Settings, ShieldCheck, Sun, Terminal, X } from 'lucide-react';
import logo from '../assets/ciena-logo.svg?inline';
import { type Route, type Theme, notify, useStored } from './state';
import { Panel } from './components';
import { Guide, Cheatsheet, Changelog, Instructions } from './Guides';
import { L2Builder } from './L2Builder';
import { IpBuilder, SatBuilder } from './Tools';
import { ConfigReview } from './ConfigReview';
import fontLicense from '../assets/fonts/OFL.txt?raw';
import { CheatsheetIcon } from './CheatsheetIcon';
import { buildAgeDays, isStale } from '../lib/age.js';

type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
export interface Destination { id: Route; title: string; description: string; group: string; icon: Icon }
export const destinations: Destination[] = [
  { id: 'login', title: 'Initial login', description: 'Connect, secure access and prepare your first SAOS node.', group: 'Learn', icon: Terminal },
  { id: 'golden', title: 'Golden configs', description: 'Reusable starting points for a consistent node baseline.', group: 'Learn', icon: ShieldCheck },
  { id: 'terms', title: 'SAOS fundamentals', description: 'Understand ports, flow points, forwarding domains and services.', group: 'Learn', icon: BookOpen },
  { id: 'l2evc', title: 'L2 EVC builder', description: 'Build Ethernet services with a live, bidirectional packet walk.', group: 'Configure', icon: Cable },
  { id: 'l3ip', title: 'IP interface creator', description: 'Create routed interfaces, including VLAN and QinQ variants.', group: 'Configure', icon: Network },
  { id: 'sat', title: 'SAT benchmark', description: 'Configure generator and reflector nodes, then verify the service.', group: 'Validate', icon: CheckCircle2 },
  { id: 'validate', title: 'Config Validator', description: 'Review generated SAOS10 CLI and validate it against release- and platform-specific YANG.', group: 'Validate', icon: ShieldCheck },
  { id: 'cheatsheet', title: 'CLI cheatsheet', description: 'Find operational commands and keep your own field notes.', group: 'Validate', icon: CheatsheetIcon },
  { id: 'changelog', title: 'Changelog', description: 'See build revisions and timestamped additions to your CLI field notes.', group: 'Explore', icon: BookOpen },
  { id: 'instructions', title: 'Instructions', description: 'Read the project README and provide a self-contained guide for AI assistants.', group: 'Explore', icon: BookOpen },
];
function routeFromHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (path === 'design') return 'l2evc';
  return destinations.find(item => item.id === path)?.id || '';
}

export function App() {
  const [hash, setHash] = useState(() => location.hash);
  const route = routeFromHash(hash);
  // Existing releases stored theme as a plain string rather than JSON.
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const settings = useRef<HTMLDialogElement>(null);
  const [textSize, setTextSize] = useStored('text-size', 0, (v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3);
  const [palette, setPalette] = useStored('palette', 'ciena', (v): v is string => ['ciena', 'ocean', 'orchid'].includes(String(v)));
  const [font, setFont] = useStored('font', 'default', (v): v is string => v === 'default' || v === 'opendyslexic');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [ageDismissed, setAgeDismissed] = useStored('age-notice-dismissed', '', (v): v is string => typeof v === 'string');
  const showAgeNotice = isStale(__BUILD_DATE__) && ageDismissed !== __APP_VERSION__;
  const current = destinations.find(item => item.id === route);
  useEffect(() => {
    const navigate = () => { setHash(location.hash); setMobileOpen(false); window.scrollTo(0, 0); };
    const show = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener('hashchange', navigate);
    window.addEventListener('snl-notify', show);
    return () => { window.removeEventListener('hashchange', navigate); window.removeEventListener('snl-notify', show); };
  }, []);
  useEffect(() => {
    if (hash.replace(/^#\/?/, '').split('?')[0] === 'design') {
      history.replaceState(null, '', `${location.pathname}${location.search}#/l2evc`);
      setHash(location.hash);
    }
  }, [hash]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('snl-theme', theme); } catch (error) { notify(`Theme preference could not be saved: ${String(error)}`); }
  }, [theme]);
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String([1, 1.125, 1.25, 1.5][textSize]));
    document.documentElement.dataset.palette = palette;
    document.documentElement.dataset.font = font;
  }, [textSize, palette, font]);
  useEffect(() => { document.title = `${current?.title || 'Start'} - SAOS10 Node Launchpad`; }, [current]);
  useEffect(() => {
    document.getElementById('view')?.focus({ preventScroll: true });
  }, [route]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 8000);
    return () => clearTimeout(timer);
  }, [message]);
  const navigation = <nav aria-label="Main navigation">
    <a href="#/" aria-current={route === '' ? 'page' : undefined} className="nav-home"><LayoutDashboard size={17} />Overview</a>
    {['Learn', 'Configure', 'Validate', 'Explore'].map(group => <div className="nav-group" key={group}>
      <p className="nav-group-label">{group}</p>
      {destinations.filter(item => item.group === group).map(item => <a key={item.id} href={`#/${item.id}`}
        aria-current={route === item.id ? 'page' : undefined}><item.icon size={17} /><span>{item.title}</span></a>)}
    </div>)}
  </nav>;
  return <div className="app-shell shell-workspace">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('view')?.focus(); }}>Skip to content</a>
    <header className="app-header">
      <a className="brand" href="#/" aria-label="SAOS10 Node Launchpad home"><img src={logo} alt="Ciena" /><div>SAOS10 <span>Node Launchpad</span></div></a>
      <div className="header-separator" />
      <nav className="breadcrumbs" aria-label="Current path">
        {current ? <><span>{current.group}</span><ChevronRight size={12} aria-hidden="true" /><strong aria-current="page">{current.title}</strong></>
          : <strong aria-current="page">Overview</strong>}
      </nav>
      <div className="header-actions">
        <a className="button primary download-html" href={location.protocol === 'file:' ? location.href.split('#')[0] : `./saos10-node-launchpad-v${__APP_VERSION__}.html`}
          download={`saos10-node-launchpad-v${__APP_VERSION__}.html`} onClick={e => {
            if (import.meta.env.DEV) { e.preventDefault(); notify('Run npm run package to create the offline HTML download.'); }
          }}><Download size={15} /><span>Download HTML</span></a>
        <button className="icon-button mobile-menu" aria-expanded={mobileOpen} aria-controls="app-navigation" aria-label="Toggle navigation"
          onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={19} /> : <Menu size={19} />}</button>
        <button className="icon-button" aria-label="Page settings" aria-haspopup="dialog" onClick={() => settings.current?.showModal()}><Settings size={19} /></button>
      </div>
    </header>
    <dialog ref={settings} className="settings-dialog" aria-labelledby="settings-title">
      <div className="flex items-center justify-between gap-3"><h2 id="settings-title">Page settings</h2>
        <form method="dialog"><button className="icon-button" aria-label="Close settings"><X size={18} /></button></form></div>
      <p className="entry-note my-4">Changes apply instantly and are remembered in this browser.</p>
      <div className="settings-grid">
        <div className="settings-size"><span>Text size</span><output>{['Standard - 100%', 'Comfort - 112.5%', 'Large - 125%', 'Extra large - 150%'][textSize]}</output>
          <input aria-label="Text size" type="range" min="0" max="3" step="1" value={textSize} onChange={e => setTextSize(Number(e.target.value))} />
          <div className="settings-size-labels" role="group" aria-label="Text size presets">
            {['Standard', 'Comfort', 'Large', 'Extra large'].map((label, index) =>
              <button key={label} type="button" aria-pressed={textSize === index} style={{ left: `${index * 100 / 3}%` }}
                onClick={() => setTextSize(index)}>{label}</button>)}
          </div>
        </div>
        <div><p className="settings-label mb-2">Light / dark mode</p><button className="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'dark'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{theme === 'dark' ? 'Dark mode' : 'Light mode'}</button></div>
        <label>Color scheme<select aria-label="Color scheme" value={palette} onChange={e => setPalette(e.target.value)}>
          <option value="ciena">Ciena - red & warm neutrals</option><option value="ocean">Ocean - blue & teal</option><option value="orchid">Orchid - purple & slate</option>
        </select></label>
        <label>Reading font<select aria-label="Reading font" value={font} onChange={e => setFont(e.target.value)}>
          <option value="default">Default - Aptos / system</option><option value="opendyslexic">OpenDyslexic</option>
        </select><span className="entry-note">Commands remain fixed-width. OpenDyslexic is included, including offline; no installation needed.</span></label>
      </div>
      <details className="mt-5"><summary>OpenDyslexic font license</summary><pre className="font-license">{fontLicense}</pre></details>
    </dialog>
    <aside id="app-navigation" className={`app-navigation ${mobileOpen ? 'is-open' : ''}`}>{navigation}</aside>
    <main id="view" tabIndex={-1} className="app-main">
      {showAgeNotice && <div className="age-notice" role="note">
        <span>This copy (v{__APP_VERSION__}, built {__BUILD_DATE__}) is {buildAgeDays(__BUILD_DATE__)} days old. Ask your Ciena contact for the latest version.</span>
        <button className="icon-button" aria-label="Dismiss version age notice" onClick={() => setAgeDismissed(__APP_VERSION__)}><X size={16} /></button>
      </div>}
      {route === '' && <Home />}
      {(route === 'login' || route === 'golden' || route === 'terms') && <Guide key={route} route={route} />}
      {route === 'cheatsheet' && <Cheatsheet sectionId={new URLSearchParams(hash.split('?')[1]).get('section')} />}
      {route === 'changelog' && <Changelog />}
      {route === 'instructions' && <Instructions />}
      {route === 'validate' && <ConfigReview />}
      {route === 'l2evc' && <L2Builder key={hash} />}
      {route === 'l3ip' && <IpBuilder key={hash} />}
      {route === 'sat' && <SatBuilder key={hash} />}
      <footer className="app-footer"><span>SNL - v{__APP_VERSION__} - built {__BUILD_DATE__}</span></footer>
    </main>
    <div className={`toast-message ${message ? 'visible' : ''}`} role="status" aria-live="polite">{message}
      {message && <button aria-label="Dismiss notification" onClick={() => setMessage('')}><X size={16} /></button>}</div>
  </div>;
}

const overviewDesigns = [
  { id: 'tasks', title: 'Simple' },
  { id: 'expert', title: 'Expert' },
] as const;
type OverviewDesign = typeof overviewDesigns[number]['id'];
const isOverviewDesign = (v: unknown): v is OverviewDesign => overviewDesigns.some(design => design.id === v);
const migrateOverview = (v: unknown) => v === 'simple' || v === 'learning' ? 'tasks' : v;

function Home() {
  const [design, setDesign] = useStored('overview-design', 'tasks', isOverviewDesign, migrateOverview);
  const visible = [...destinations];
  if (design === 'expert') {
    const priority: Route[] = ['l2evc', 'l3ip', 'sat', 'validate', 'cheatsheet', 'golden', 'design', 'login', 'terms', 'changelog', 'instructions'];
    visible.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
  }
  return <div className={`overview overview-${design}`} data-overview={design}>
    <div className="overview-picker"><div className="segments" role="group" aria-label="Overview design">
      {overviewDesigns.map(item => <button key={item.id} aria-pressed={design === item.id} onClick={() => setDesign(item.id)}>{item.title}</button>)}
    </div></div>
    <header className="overview-header"><p className="eyebrow">SAOS10 NODE LAUNCHPAD</p>
      <h1>{design === 'expert' ? "Engineer's command desk." : 'Start with the outcome.'}</h1>
    </header>
    {design === 'tasks' && <div className="overview-missions">
      {[
        { title: 'Bring a node online', text: 'Access and a repeatable baseline.', links: ['login', 'golden', 'terms'] },
        { title: 'Deliver a service', text: 'Ethernet or routed connectivity.', links: ['l2evc', 'l3ip'] },
        { title: 'Prove and troubleshoot', text: 'Benchmark traffic and inspect the CLI.', links: ['sat', 'cheatsheet'] },
      ].map(mission => <Panel key={mission.title} title={mission.title} description={mission.text}>
        {mission.links.map(id => { const item = destinations.find(item => item.id === id)!; return <a className="overview-link" key={id} href={`#/${id}`}><item.icon size={18} />{item.title}<ArrowRight size={16} /></a>; })}
      </Panel>)}
    </div>}
    <div className="section-heading"><h2>{design === 'expert' ? 'Direct access' : 'All tools & references'}</h2></div>
    <div className="tool-cards">
      {visible.map(item => design === 'expert'
        ? <a className="overview-link overview-directory-item" key={item.id} href={`#/${item.id}`}><item.icon size={18} /><div><strong>{item.title}</strong>
          <p>{item.description}</p></div><ArrowRight size={14} /></a>
        : <ToolCard key={item.id} item={item} />)}
    </div>
  </div>;
}
function ToolCard({ item }: { item: Destination }) {
  return <a href={`#/${item.id}`} className="tool-card"><span className="tool-icon"><item.icon size={20} /></span>
    <h3>{item.title}</h3><p>{item.description}</p><div className="tool-card-footer"><span>{item.group}</span><ArrowRight size={15} /></div></a>;
}
