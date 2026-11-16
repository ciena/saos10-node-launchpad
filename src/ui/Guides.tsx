import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { CalendarClock, Copy, Download, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { CodeBlock, InputField, PageHead, Panel, Segments } from './components';
import { copyText, downloadFile, isRecord, notify, useStored, type Route } from './state';
import releaseChangelog from '../../CHANGELOG.md?raw';
import readme from '../../README.md?raw';
import apacheLicense from '../../licenses/Apache-2.0.txt?raw';
import { guideSectionTitles } from './guide-section-titles';

const activityStorageKey = 'cheatsheet-changelog-v0.8.14';
const pageChangelog = '# Changelog\n\n' + releaseChangelog.split(/(?=^## )/m).filter(section => {
  const version = section.match(/^## \[(\d+)\.(\d+)\.(\d+)\]/);
  if (!version) return false;
  const major = Number(version[1]);
  return major >= 1;
}).join('');

const content = Object.fromEntries(Object.entries(import.meta.glob<string>('../../content/*.{md,txt}', { eager: true, query: '?raw', import: 'default' }))
  .map(([path, text]) => [path.split('/').pop()!.replace(/\.(md|txt)$/, ''), text]));
const images = Object.fromEntries(Object.entries(import.meta.glob<string>('../../content/images/*', { eager: true, query: '?url', import: 'default' }))
  .map(([path, url]) => [`images/${path.split('/').pop()}`, url]));
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const decode = (text: string) => { const node = document.createElement('textarea'); node.innerHTML = text; return node.value; };
const slug = (text: string) => text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const code = (text: string) => escape(text).replace(/&lt;([A-Za-z][\w.#-]*)&gt;/g, (_, name: string) => `<span class="ph" data-ph="${name}">&lt;${name}&gt;</span>`);
const commentCode = (text: string) => text.split('\n').map(line => line.trimStart().startsWith('#')
  ? line.split(/(`[^`\n]+`)/g).map(part => part.startsWith('`') && part.endsWith('`')
    ? `<code class="inline-example">${code(part.slice(1, -1))}</code>` : code(part)).join('')
  : code(line)).join('\n');
const copyIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
const sectionCopyButton = (title: string) => `<button type="button" class="code-copy section-copy" aria-label="Copy ${escape(title)}">${copyIcon} Copy</button>`;
const parser = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      return `<div class="cli"${lang === 'text' ? ' data-guidance="true"' : ''}><button type="button" class="copy" aria-label="Copy command block">${copyIcon} Copy</button><pre><code>${lang === 'text' ? escape(text) : commentCode(text)}</code></pre></div>`;
    },
    codespan({ text }) { return `<code class="cmd">${code(decode(text))}</code>`; },
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>`;
    },
    image({ href, title, text }) {
      return `<figure><img src="${escape(images[href] || href)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''} loading="lazy">${text ? `<figcaption>${escape(text)}</figcaption>` : ''}</figure>`;
    },
    link({ href, tokens }) {
      return `<a href="${escape(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${this.parser.parseInline(tokens)}</a>`;
    },
  },
});
interface Section { id: string; title: string; html: string; level?: 2 | 3 }
function parseDocument(md: string, includeSubsections = false, conciseTitles = false) {
  const node = document.createElement('div');
  node.innerHTML = DOMPurify.sanitize(parser.parse(md, { async: false }));
  const title = node.querySelector('h1')?.textContent || '';
  node.querySelector('h1')?.remove();
  if (conciseTitles) {
    for (const heading of node.querySelectorAll<HTMLElement>('h2, h3')) {
      const summary = guideSectionTitles[heading.id];
      if (!summary || (heading.textContent || '').trim().split(/\s+/).length <= 7) continue;
      const details = document.createElement('p');
      details.className = 'guide-section-description';
      details.innerHTML = heading.innerHTML;
      heading.textContent = summary;
      heading.after(details);
    }
  }
  for (const li of node.querySelectorAll('li')) {
    const first = li.firstElementChild?.matches('p') ? li.firstElementChild.firstElementChild : li.firstElementChild;
    if (first?.matches('code.cmd')) {
      li.classList.add('cmd-row');
      const button = document.createElement('button');
      button.className = 'copy';
      button.type = 'button';
      button.innerHTML = `${copyIcon} Copy`;
      button.setAttribute('aria-label', 'Copy command');
      li.prepend(button);
    }
  }
  const sections: Section[] = [];
  let current: Section = { id: 'introduction', title: 'Introduction', html: '' };
  for (const child of Array.from(node.children)) {
    if (child.tagName === 'H2' || (includeSubsections && child.tagName === 'H3')) {
      if (current.html) sections.push(current);
      current = { id: child.id, title: child.textContent || '', html: '', level: child.tagName === 'H2' ? 2 : 3 };
    }
    current.html += child.outerHTML;
  }
  if (current.html) sections.push(current);
  const placeholders = [...new Set(Array.from(node.querySelectorAll<HTMLElement>('[data-ph]'))
    .map(el => el.dataset.ph!).filter(name => name !== 'FP_name'))]
    .sort((a, b) => a === 'VLAN#' ? 1 : b === 'VLAN#' ? -1 : 0);
  return { title, html: node.innerHTML, sections, placeholders };
}
const stringMap = (v: unknown): v is Record<string, string> => isRecord(v) && Object.values(v).every(value => typeof value === 'string');

function revealSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (node instanceof HTMLDetailsElement) node.open = true;
  }
  target.scrollIntoView({ block: 'start' });
}
function commandBullets(node: HTMLElement) {
  node.querySelectorAll('button.copy').forEach(button => button.remove());
  for (const block of node.querySelectorAll('.cli')) {
    const code = block.querySelector('code');
    if (!code) continue;
    const list = document.createElement('ul');
    list.className = 'cli command-list';
    for (const line of code.innerHTML.split('\n')) {
      const item = document.createElement('li');
      const command = document.createElement('code');
      command.innerHTML = line || ' ';
      if (command.textContent?.trimStart().startsWith('#')) {
        item.className = 'prose-note';
        const note = document.createElement('span');
        note.className = 'guide-comment';
        note.innerHTML = command.innerHTML;
        item.append(note);
      } else item.append(command);
      list.append(item);
    }
    block.replaceWith(list);
  }
  for (const command of node.querySelectorAll('code.cmd')) {
    if (!command.textContent?.trimStart().startsWith('#')) continue;
    const note = document.createElement('span');
    note.className = 'guide-comment';
    note.innerHTML = command.innerHTML;
    command.replaceWith(note);
  }
  for (const item of node.querySelectorAll('li')) {
    if (!item.querySelector('code') || item.textContent?.trimStart().startsWith('#')) item.classList.add('prose-note');
  }
}
function sectionCodeHtml(html: string) {
  const source = document.createElement('div');
  source.innerHTML = html;
  source.querySelectorAll('button.copy').forEach(button => button.remove());
  if (source.firstElementChild?.matches('h2, h3')) source.firstElementChild.remove();
  const lines: string[] = [];
  const figures: string[] = [];
  let hasCommands = false;
  const comment = (html: string, pointsToCommand = false, className = '') => {
    const probe = document.createElement('div');
    probe.innerHTML = html;
    if (!probe.textContent?.trim()) return;
    const prefix = pointsToCommand ? '# ^^^ ' : '# ';
    for (const line of html.replace(/<br\s*\/?>/gi, '\n').split('\n')) {
      if (line.trim()) lines.push(`<span class="guide-comment ${className}">${prefix}${line.replace(/^\s*#\s*/, '')}</span>`);
    }
  };
  const command = (html: string) => {
    const probe = document.createElement('div');
    probe.innerHTML = html;
    if (probe.textContent?.trimStart().startsWith('#')) comment(html);
    else {
      if (probe.textContent?.trim()) hasCommands = true;
      lines.push(`<code class="cmd">${html || ' '}</code>`);
    }
  };
  const visit = (element: Element) => {
    if (element.matches('.cli')) {
      const block = element.querySelector('pre > code');
      if (!block) return;
      for (const line of block.innerHTML.split('\n')) {
        if (element.hasAttribute('data-guidance')) comment(line);
        else command(line);
      }
      return;
    }
    if (element.matches('ul, ol, li') && element.firstElementChild?.matches('li, p')) {
      Array.from(element.children).forEach(visit);
      return;
    }
    const first = element.firstChild;
    if (first instanceof Element && first.matches('code.cmd')) {
      if (first.textContent?.trimStart().startsWith('#')) { comment(element.innerHTML); return; }
      command(first.innerHTML);
      const remainder = element.cloneNode(true) as Element;
      remainder.firstChild?.remove();
      comment(remainder.innerHTML.replace(/^\s*(?:--?(?:>|&gt;)|-)\s*/, ''), true);
      return;
    }
    if (element.matches('table')) {
      for (const row of element.querySelectorAll('tr')) {
        comment(escape(Array.from(row.querySelectorAll('th, td')).map(cell => cell.textContent?.trim() || '').join(' | ')));
      }
      return;
    }
    if (element.matches('figure')) {
      figures.push(element.outerHTML);
      for (const line of blockText(element as HTMLElement).split('\n')) comment(escape(line));
      return;
    }
    comment(element.innerHTML, false, element.classList.contains('guide-section-description') ? 'guide-section-description' : '');
  };
  Array.from(source.children).forEach(element => {
    visit(element);
    lines.push('');
  });
  if (!hasCommands) {
    for (const block of source.querySelectorAll('.cli')) {
      const prose = document.createElement('div');
      prose.innerHTML = (block.querySelector('pre > code')?.innerHTML || '').split('\n')
        .filter(line => line.trim()).map(line => `<p>${line.replace(/^\s*#\s*/, '')}</p>`).join('');
      block.replaceWith(...prose.childNodes);
    }
    for (const element of source.querySelectorAll('p, li')) {
      const first = element.firstChild;
      if (first instanceof Text) first.textContent = first.textContent?.replace(/^\s*#\s*/, '') || '';
      else if (first instanceof Element && first.matches('code.cmd')) first.innerHTML = first.innerHTML.replace(/^\s*#\s*/, '');
    }
    return source.innerHTML;
  }
  return `<pre class="guide-section-block">${lines.join('\n').trimEnd()}</pre>${figures.join('')}`;
}
function sectionCommands(section: Element | null | undefined) {
  const block = section?.querySelector('.guide-section-block');
  if (block) return [block.textContent || ''];
  return Array.from(section?.querySelectorAll('.cli code, code.cmd, .guide-comment, .personal-command') || [])
    .filter(node => !node.parentElement?.closest('.guide-comment'))
    .map(node => node.textContent || '').filter(Boolean);
}
// CLI Cheatsheet: commands stay in code blocks or command rows, and descriptions stay ordinary prose.
// A list item is a command row only when it starts with the command; a bullet that mentions one later stays prose.
function startsWithCommand(item: Element) {
  const body = item.querySelector(':scope > p') || item;
  const first = Array.from(body.childNodes).find(node =>
    !(node instanceof Text && !node.textContent?.trim()) && !(node instanceof Element && node.matches('button.copy')));
  return first instanceof Element && first.matches('code.cmd');
}
function commandRow(item: Element) {
  const body = item.querySelector(':scope > p') || item;
  const button = item.querySelector(':scope > button.copy');
  const command = body.querySelector(':scope > code.cmd');
  const row = document.createElement('div');
  row.className = 'cs-row';
  const cell = document.createElement('div');
  cell.className = 'cs-cmd';
  const note = document.createElement('div');
  note.className = 'cs-note';
  button?.remove();
  command?.remove();
  note.innerHTML = body.innerHTML.replace(/^\s*(?:--?(?:>|&gt;)|-)\s*/, '').trim();
  if (command) cell.append(command);
  row.append(cell);
  if (note.textContent?.trim()) row.append(note);
  if (button) row.append(button);
  return row;
}
function cheatsheetSectionHtml(html: string) {
  const source = document.createElement('div');
  source.innerHTML = html;
  if (source.firstElementChild?.matches('h2, h3')) source.firstElementChild.remove();
  for (const block of source.querySelectorAll('.cli[data-guidance]')) {
    block.classList.add('cli-output');
    block.querySelector('button.copy')?.remove();
  }
  for (const item of source.querySelectorAll('li.cmd-row')) {
    if (item.parentElement?.matches('ul') && startsWithCommand(item)) continue;
    item.classList.remove('cmd-row');
    item.querySelector(':scope > button.copy')?.remove();
  }
  for (const list of Array.from(source.querySelectorAll('ul'))) {
    if (!list.querySelector(':scope > li.cmd-row')) continue;
    // A run of command items becomes a command table; ordinary bullets around it stay a list.
    const parts: HTMLElement[] = [];
    let rows: HTMLElement | null = null;
    let bullets: HTMLElement | null = null;
    for (const item of Array.from(list.children)) {
      if (item.matches('li.cmd-row')) {
        bullets = null;
        if (!rows) { rows = document.createElement('div'); rows.className = 'cmd-table'; parts.push(rows); }
        rows.append(commandRow(item));
      } else {
        rows = null;
        if (!bullets) { bullets = document.createElement('ul'); parts.push(bullets); }
        bullets.append(item);
      }
    }
    list.replaceWith(...parts);
  }
  for (const button of source.querySelectorAll('button.copy')) button.innerHTML = `${copyIcon}<span>Copy</span>`;
  for (const command of source.querySelectorAll(':not(pre) > code.cmd')) command.setAttribute('title', 'Click to copy');
  return source.innerHTML;
}
function cheatsheetCommands(root: ParentNode | null | undefined) {
  return Array.from(root?.querySelectorAll('.cli:not(.cli-output) pre > code, .cs-cmd > code.cmd') || [])
    .map(node => (node.textContent || '').replace(/\s+$/, '')).filter(Boolean);
}
function collapsibleDocument(html: string) {
  const headingsWithoutCopy = new Set([
    'Console Cable Type and Terminal Settings, per platform',
    'Console Cable Notes',
    'No Console/USB Cable?',
    '[392x] Initial IP Configs for Management',
    '[393x, 394x, 398x, 51xx, 81xx] Initial IP Configs for Management',
  ]);
  const source = document.createElement('div');
  source.innerHTML = html;
  commandBullets(source);
  const result = document.createElement('div');
  let section: HTMLElement = result;
  let subsection: HTMLElement = result;
  for (const child of Array.from(source.children)) {
    if (child.matches('h2, h3')) {
      const details = document.createElement('details');
      details.className = 'login-section';
      details.dataset.copySection = '';
      details.id = child.tagName === 'H3' ? `${section.id}-${child.id}` : child.id;
      const summary = document.createElement('summary');
      summary.textContent = child.textContent;
      if (!headingsWithoutCopy.has(child.textContent || '')) {
        summary.insertAdjacentHTML('beforeend', sectionCopyButton(child.textContent || 'section'));
      }
      details.append(summary);
      if (child.tagName === 'H2') {
        result.append(details);
        section = details;
      } else section.append(details);
      subsection = details;
    } else subsection.append(child);
  }
  return result.innerHTML;
}

function MarkdownBody({ html, values, className = '' }: { html: string; values: Record<string, string>; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[data-ph]').forEach(node => {
      const key = node.dataset.ph!;
      node.textContent = values[key] || `<${key}>`;
    });
  }, [html, values]);
  return <div className={`prose${html.includes('command-list') ? ' command-prose' : ''}${className ? ` ${className}` : ''}`} ref={ref} dangerouslySetInnerHTML={{ __html: html }} onClick={e => {
    if (!(e.target instanceof Element)) return;
    const sectionButton = e.target.closest('button.section-copy');
    if (sectionButton) {
      e.preventDefault();
      e.stopPropagation();
      const commands = sectionCommands(sectionButton.closest('[data-copy-section]'));
      if (commands.length) void copyText(commands.join('\n'));
      else notify('This section has no commands to copy.');
      return;
    }
    const button = e.target.closest('button.copy');
    if (button) {
      const text = button.closest('.cli')?.querySelector('code')?.textContent
        || button.closest('.cmd-row, .cs-row')?.querySelector('code.cmd')?.textContent;
      if (text) void copyText(text.replace(/\s+$/, ''));
      return;
    }
    // On the cheatsheet any command outside a code block copies on click, unless the reader is selecting text.
    const inline = e.target.closest('.cheatsheet-prose :not(pre) > code.cmd');
    if (inline?.textContent && window.getSelection()?.isCollapsed !== false) { void copyText(inline.textContent); return; }
    const link = e.target.closest('a');
    if (link?.getAttribute('href')?.startsWith('#')) {
      const target = document.getElementById(link.getAttribute('href')!.slice(1));
      if (target) { e.preventDefault(); revealSection(target.id); }
    }
  }} />;
}
function Placeholders({ names, values, onChange, defaultCollapsed = false }: {
  names: string[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void; defaultCollapsed?: boolean;
}) {
  if (!names.length) return null;
  const fillCurrentDateTime = () => {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    onChange({ ...values, MANUAL_DATETIME: now });
  };
  return <details className="panel placeholder-panel" open={!defaultCollapsed && names.length <= 8}>
    <summary>Fill-in values</summary>
    <div className="field-grid">{names.map(name => <div key={name} className="placeholder-field">
      <InputField label={`<${name}>`} value={values[name] || ''}
        onChange={value => onChange({ ...values, [name]: String(value) })} />
      {name === 'MANUAL_DATETIME' && <button className="button" type="button" onClick={fillCurrentDateTime}>
        <CalendarClock size={14} />Insert current date/time
      </button>}
    </div>)}</div>
    <button className="text-action mt-4" onClick={() => onChange({})}>Clear all values</button>
  </details>;
}
function Document({ source, storageKey, selectable = false, fillIn = false, collapsible = false }: {
  source: string; storageKey: string; selectable?: boolean; fillIn?: boolean; collapsible?: boolean;
}) {
  const doc = useMemo(() => parseDocument(source, selectable, selectable), [source, selectable]);
  const html = useMemo(() => {
    if (collapsible) return collapsibleDocument(doc.html);
    if (storageKey.startsWith('terms-')) {
      const node = document.createElement('div');
      node.innerHTML = doc.html;
      node.querySelectorAll('button.copy').forEach(button => button.remove());
      return `<div class="read-only-guide">${node.innerHTML}</div>`;
    }
    return doc.html;
  }, [doc.html, collapsible, storageKey]);
  const [savedValues, setValues] = useStored(`ph-${storageKey}`, {}, stringMap);
  const values = fillIn ? savedValues : {};
  const [selected, setSelected] = useState<string[]>([]);
  const sections = doc.sections.filter(section => section.id !== 'introduction');
  const timingSectionIds = sections.filter(section => ['Timing - NTP', 'Timing - Manual'].includes(section.title)).map(section => section.id);
  const comment = (text: string) => text.trim().split('\n').map(line => `# ${line.trim()}`).join('\n');
  // Unfilled variables stay as their <NAME> placeholder in the downloaded text.
  const modeSection = sections.find(section => section.title === 'Going into "config" mode and exiting')?.id || '';
  const wrapConfig = selected.includes(modeSection) && selected.some(id => id !== modeSection);
  const combined = sections.filter(section => selected.includes(section.id) && (!wrapConfig || section.id !== modeSection)).map(section => {
    const node = document.createElement('div');
    node.innerHTML = section.html;
    node.querySelectorAll('button.copy').forEach(button => button.remove());
    node.querySelectorAll<HTMLElement>('[data-ph]').forEach(el => {
      const name = el.dataset.ph!;
      el.textContent = values[name] || `<${name}>`;
    });
    node.firstElementChild?.remove();
    const formatted = document.createElement('div');
    formatted.innerHTML = sectionCodeHtml(node.innerHTML);
    const block = formatted.querySelector('.guide-section-block');
    return [comment(section.title), block ? block.textContent || '' : comment(blockText(formatted))].join('\n\n');
  }).join('\n\n');
  const text = combined ? `${wrapConfig ? 'config\n\n' : ''}${combined}\n${wrapConfig ? '\nexit\n' : ''}` : '';
  return <>
    {selectable && <Panel title="Build your golden config" className="mb-5">
      <p className="entry-note mb-4">Common day-one configs (NTP, licensing, SNMP, global profiles). Edit the &lt;PLACEHOLDER&gt; fields (unfilled ones download as &lt;NAME&gt;), then copy each block or download a selection. Selecting Timing - NTP or Timing - Manual clears the other timing option.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="button primary" disabled={!selected.length}
          onClick={() => downloadFile('saos10-golden-config.txt', text)}><Download size={14} />Download selected .txt</button>
        <button className="button" disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button>
      </div>
      {text && <details className="mt-4"><summary>Preview combined config</summary><CodeBlock title="Selected golden config" lines={text.trimEnd().split('\n')} /></details>}
    </Panel>}
    {fillIn && <Placeholders names={doc.placeholders} values={values} onChange={setValues} defaultCollapsed={collapsible} />}
    <div className="document-layout">{selectable ? <div className="grid gap-5">
      {sections.map(section => <FieldNoteSection key={section.id} section={section} values={values}
        headingControl={<input type="checkbox" checked={selected.includes(section.id)} aria-label={`Include ${section.title}`}
          onChange={e => {
            const checked = e.target.checked;
            setSelected(current => checked
              ? [...current.filter(id => !timingSectionIds.includes(section.id) || !timingSectionIds.includes(id)), section.id]
              : current.filter(id => id !== section.id));
          }} />} />)}
    </div> : <Panel><MarkdownBody html={html} values={values} /></Panel>}
      <nav className="document-toc" aria-label="On this page"><p>ON THIS PAGE</p>{doc.sections.filter(section => section.id !== 'introduction').map(section =>
        <a key={section.id} href={`#${section.id}`} onClick={e => { e.preventDefault(); revealSection(section.id); }}>{section.title}</a>)}</nav>
    </div>
  </>;
}
export function Guide({ route }: { route: Extract<Route, 'login' | 'golden' | 'terms'> }) {
  const key = route === 'login' ? 'initial-login' : route === 'golden' ? 'golden-configs' : 'terms-f0';
  return <>
    <PageHead eyebrow="LEARN / FIELD GUIDE" title={route === 'login' ? 'Your first connection.' : route === 'golden' ? 'A solid starting point.' : 'Understand the building blocks.'}
      description={route === 'login' ? 'From an out-of-the-box node to secure management access. Fill placeholders once and copy the commands you need.'
        : route === 'golden' ? 'Ciena Solution Architect recommended baseline configurations. Adapt the examples to your environment before applying.'
          : 'Build a mental model of SAOS objects, Ethernet services and operational terminology.'} />
    <Document key={key} source={content[key]} storageKey={key} selectable={route === 'golden'}
      fillIn={route !== 'terms'} collapsible={route === 'login'} />
    {route === 'terms' && <p className="entry-note mt-5">Adapted from <a className="text-action" href="https://github.com/ciena/saos-labs" target="_blank" rel="noopener noreferrer">ciena/saos-labs</a> under the Apache-2.0 license (<button className="text-action underline" onClick={() => downloadFile('Apache-2.0.txt', apacheLicense, 'text/plain')}>download license text</button>).</p>}
  </>;
}

interface Entry { id: string; section: string; command: string; note: string; added?: string; number?: number }
function isEntry(v: unknown): v is Entry {
  return isRecord(v) && typeof v.id === 'string' && typeof v.command === 'string' && !!v.command.trim()
    && typeof v.note === 'string' && typeof v.section === 'string'
    && (v.number === undefined || (Number.isSafeInteger(v.number) && Number(v.number) > 0));
}
const isEntries = (v: unknown): v is Entry[] => Array.isArray(v) && v.every(isEntry);

interface EntryChange { id: string; timestamp: string; preview: string }
const isEntryChanges = (value: unknown): value is EntryChange[] => Array.isArray(value) && value.every(item =>
  isRecord(item) && typeof item.id === 'string' && typeof item.timestamp === 'string'
  && !Number.isNaN(Date.parse(item.timestamp)) && typeof item.preview === 'string');

export function Changelog() {
  const [changes] = useStored(activityStorageKey, [], isEntryChanges);
  return <>
    <PageHead eyebrow="EXPLORE / CHANGELOG" title="What changed."
      description={`You are viewing v${__APP_VERSION__}. Build changes ship with this HTML; personal entry activity stays in this browser.`} />
    <Panel title="Your cheatsheet additions" className="mb-5"
      description="Timestamp and first five lines of the saved command and note. Newest first; retained even if the entry is later deleted. Imports and pre-existing entries are not backfilled. This history is not shared with other users or included in Download HTML.">
      {!changes.length && <p className="entry-note">No additions recorded yet. Use Add entry on the CLI cheatsheet to start your activity history.</p>}
      <div className="grid gap-5">{changes.map(change => <article key={change.id} className="cheatsheet-change">
        <p className="mb-2"><strong>Cheatsheet entry added</strong> - <time dateTime={change.timestamp}>{change.timestamp}</time></p>
        <CodeBlock title="First five lines" lines={change.preview.split('\n')} />
      </article>)}</div>
    </Panel>
    <Document source={pageChangelog} storageKey="release-changelog" />
  </>;
}

export function Instructions() {
  return <>
    <PageHead eyebrow="EXPLORE / INSTRUCTIONS" title="Instructions for people and AI assistants."
      description="This page is bundled from the project README so it remains available in the standalone HTML copy." />
    <Document source={readme} storageKey="instructions-readme" />
  </>;
}

// innerText on a detached clone falls back to textContent and loses line breaks, so rebuild them from the block structure.
const BLOCKS = 'p, li, div, pre, h1, h2, h3, h4, h5, h6, tr, figure, blockquote, ul, ol, table, summary, details';
export function blockText(root: HTMLElement) {
  const node = root.cloneNode(true) as HTMLElement;
  node.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  node.querySelectorAll('td, th').forEach(cell => cell.append('\t'));
  node.querySelectorAll(BLOCKS).forEach(block => block.append('\n'));
  return (node.textContent || '').split('\n').map(line => line.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function FieldNoteSection({ section, values, children, headingControl, variant = 'commented' }: {
  section: Section; values: Record<string, string>; children?: ReactNode; headingControl?: ReactNode;
  variant?: 'commented' | 'cheatsheet';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cheatsheet = variant === 'cheatsheet';
  const html = useMemo(() => cheatsheet ? cheatsheetSectionHtml(section.html) : sectionCodeHtml(section.html),
    [section.html, cheatsheet]);
  const hasCommands = useMemo(() => {
    if (!cheatsheet) return true;
    const node = document.createElement('div');
    node.innerHTML = html;
    return cheatsheetCommands(node).length > 0;
  }, [html, cheatsheet]);
  const Heading = cheatsheet ? 'h3' : 'h2';
  return <Panel id={section.id} className="field-note-section">
    <div ref={ref}>
      <div className="field-note-heading">{headingControl}<Heading>{section.title}</Heading>
        {hasCommands && <button className="code-copy" aria-label={cheatsheet ? `Copy commands: ${section.title}` : `Copy ${section.title}`} onClick={() => {
          const prose = ref.current?.querySelector<HTMLElement>('.prose');
          const text = cheatsheet ? cheatsheetCommands(prose).join('\n')
            : prose?.querySelector('.guide-section-block') ? sectionCommands(ref.current).join('\n') : prose ? blockText(prose) : '';
          if (!text) { notify('This section has no content to copy.'); return; }
          void copyText(text);
        }}><Copy size={14} aria-hidden="true" /> {cheatsheet ? 'Copy commands' : 'Copy'}</button>}
      </div>
      <MarkdownBody html={html} values={values} className={cheatsheet ? 'cheatsheet-prose' : ''} />
      {children}
    </div>
  </Panel>;
}

interface CheatsheetGroup { id: string; title: string; sections: Section[] }
const personalTopic = 'my-entries';

export function Cheatsheet({ sectionId }: { sectionId?: string | null }) {
  // Level-two headings are topic groups; each level-three heading is a numbered section inside its group.
  const doc = useMemo(() => {
    const groups: CheatsheetGroup[] = [];
    const seen = new Map<string, number>();
    let number = 0;
    for (const item of parseDocument(content.cheatsheet, true).sections) {
      if (item.id === 'introduction') continue;
      if (item.level === 2) { groups.push({ id: item.id, title: item.title, sections: [] }); continue; }
      if (!groups.length) groups.push({ id: 'general', title: 'General', sections: [] });
      const count = (seen.get(item.id) || 0) + 1;
      seen.set(item.id, count);
      groups[groups.length - 1].sections.push({ ...item, id: count === 1 ? item.id : `${item.id}-${count}`, title: `#${++number} - ${item.title}` });
    }
    return { groups, sections: groups.flatMap(group => group.sections) };
  }, []);
  const baseCount = doc.sections.length;
  const [savedEntries, setEntries] = useStored('cheatsheet-user', [], isEntries);
  const [nextSaved, setNextSaved] = useStored('cheatsheet-next-number', baseCount + 1,
    (v): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0);
  const used = new Set(savedEntries.flatMap(entry => entry.number && entry.number > baseCount ? [entry.number] : []));
  let allocate = Math.max(baseCount, ...used) + 1;
  const assigned = new Set<number>();
  const entries = savedEntries.map(entry => {
    let number = entry.number;
    if (!number || number <= baseCount || assigned.has(number)) number = allocate++;
    assigned.add(number);
    return { ...entry, number };
  });
  const nextNumber = Math.max(nextSaved, allocate);
  const values: Record<string, string> = {};
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  useEffect(() => {
    if (!sectionId) return;
    setQuery('');
    setTopic('all');
    const frame = requestAnimationFrame(() => revealSection(sectionId));
    return () => cancelAnimationFrame(frame);
  }, [sectionId]);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [section, setSection] = useState('my-entries');
  const [command, setCommand] = useState('');
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLowerCase();
  const matchSection = (item: Section): Section | null => {
    if (!normalized) return item;
    const node = document.createElement('div');
    node.innerHTML = item.html;
    const titleMatches = item.title.toLowerCase().includes(normalized);
    if (titleMatches) return item;
    const searchable = Array.from(node.querySelectorAll(':scope > ul > li, :scope > ol > li, :scope > p, :scope > .cli, :scope > figure, :scope > table'));
    if (!searchable.length) return (node.textContent || '').toLowerCase().includes(normalized) ? item : null;
    let matches = 0;
    for (const child of searchable) {
      if ((child.textContent || '').toLowerCase().includes(normalized)) matches++;
      else child.remove();
    }
    return matches ? { ...item, html: node.innerHTML } : null;
  };
  const groups = doc.groups.filter(group => topic === 'all' || topic === group.id)
    .map(group => ({ ...group, sections: group.sections.map(matchSection).filter((item): item is Section => item !== null) }))
    .filter(group => group.sections.length);
  const filtered = groups.flatMap(group => group.sections);
  const showPersonal = topic === 'all' || topic === personalTopic;
  const userFiltered = showPersonal
    ? entries.filter(entry => `#${entry.number} ${entry.command} ${entry.note}`.toLowerCase().includes(normalized)) : [];
  const filtering = Boolean(normalized) || topic !== 'all';
  const shown = filtered.length + userFiltered.length;
  const jump = (id: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView(); };
  async function importFile(selected: File) {
    if (importing) { notify('Wait for the current import to finish.'); return; }
    setImporting(true);
    try {
      const incoming: unknown = JSON.parse(await selected.text());
      if (!Array.isArray(incoming)) throw new Error('Expected a JSON array of entries');
      const ids = new Set(entries.map(entry => entry.id));
      const added: Entry[] = [];
      for (const raw of incoming) {
        if (!isRecord(raw) || typeof raw.command !== 'string' || !raw.command.trim()) throw new Error('Each entry needs nonempty command text');
        if (raw.note !== undefined && typeof raw.note !== 'string') throw new Error('Entry note must be text');
        if (raw.section !== undefined && typeof raw.section !== 'string') throw new Error('Entry section must be text');
        if (raw.id !== undefined && typeof raw.id !== 'string') throw new Error('Entry ID must be text');
        const entry: Entry = { id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(), section: typeof raw.section === 'string' ? raw.section : 'my-entries', command: raw.command, note: typeof raw.note === 'string' ? raw.note : '' };
        if (!ids.has(entry.id)) { ids.add(entry.id); added.push({ ...entry, number: nextNumber + added.length }); }
      }
      setEntries([...entries, ...added]);
      setNextSaved(nextNumber + added.length);
      notify(`Imported ${added.length} new entries`);
    } catch (error) { notify(`Import failed: ${String(error)}. No entries were changed.`); }
    finally { setImporting(false); }
  }
  return <>
    <PageHead eyebrow="VALIDATE / COMMAND REFERENCE" title="Your ultimate SAOS10 cheatsheet."
      description="Grouped by topic and searchable. Copy one command or a whole section, add your own entries and export them for your next deployment."
      actions={<button className="button primary" disabled={importing} onClick={() => setAdding(!adding)}><Plus size={14} />Add entry</button>} />
    <div className="cheatsheet-search flex flex-wrap items-center gap-3">
      <label className="search-field flex-1 min-w-48"><Search size={16} /><input value={query} type="search" aria-label="Search commands and notes" placeholder="Search commands and notes... e.g. lldp, cfm, ping" onChange={e => setQuery(e.target.value)} /></label>
      <button className="button" onClick={() => downloadFile('cheatsheet-my-entries.json', JSON.stringify(entries, null, 2), 'application/json')}><Download size={14} />Export</button>
      <button className="button" aria-label="Import entries" disabled={importing} onClick={() => file.current?.click()}><Upload size={14} />{importing ? 'Importing...' : 'Import'}</button>
      <button className="button" title="Review your entries in a public GitHub issue before submitting. Do not include secrets or customer data." onClick={() => {
        if (!entries.length) { notify('Add an entry first'); return; }
        const md = entries.map(entry => `### ${entry.section}\n\n\`\`\`cli\n${entry.command}\n\`\`\`\n${entry.note}`).join('\n\n');
        window.open(`https://github.com/ciena/saos10-node-launchpad/issues/new?title=${encodeURIComponent('Cheatsheet: proposed entries')}&body=${encodeURIComponent(md)}`, '_blank', 'noopener,noreferrer');
      }}>Add tip to GitHub</button>
      <input ref={file} hidden type="file" accept=".json,application/json" aria-label="Import cheatsheet JSON" onChange={e => { const selected = e.target.files?.[0]; if (selected) void importFile(selected); e.target.value = ''; }} />
    </div>
    <div className="cheatsheet-topics">
      <Segments label="Topic" value={topic} onChange={setTopic} options={[{ id: 'all', label: 'All topics' },
        ...doc.groups.map(group => ({ id: group.id, label: group.title })), { id: personalTopic, label: 'My entries' }]} />
      {filtering && <p className="entry-note" role="status">Showing {shown} of {baseCount + entries.length} sections</p>}
    </div>
    {adding && <Panel title="Add a field note" className="mb-5"><form className="entry-form" onSubmit={e => {
      e.preventDefault();
      if (!command.trim()) { notify('Enter a command before saving'); return; }
      const timestamp = new Date().toISOString();
      const id = crypto.randomUUID();
      setEntries([...entries, { id, section, number: nextNumber, command: command.trim(), note: note.trim(), added: timestamp.slice(0, 10) }]);
      setNextSaved(nextNumber + 1);
      const preview = [command.trim(), note.trim()].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 5).join('\n');
      let historyError = '';
      try {
        const historyKey = `snl-${activityStorageKey}`;
        const raw = localStorage.getItem(historyKey) ?? localStorage.getItem(`tbf-${activityStorageKey}`);
        const changes: unknown = raw === null ? [] : JSON.parse(raw);
        if (!isEntryChanges(changes)) throw new Error('Saved activity history has an unsupported format');
        localStorage.setItem(historyKey, JSON.stringify([{ id, timestamp, preview }, ...changes]));
      } catch (error) { historyError = ` Activity history could not be updated: ${String(error)}. Existing history has not been overwritten.`; }
      setTopic(current => current === 'all' ? current : personalTopic);
      setCommand(''); setNote(''); setAdding(false); notify(`Entry saved in this browser.${historyError}`);
    }}>
      <p className="entry-note">New section number: <strong>#{nextNumber}</strong></p>
      <label>Related section<select value={section} onChange={e => setSection(e.target.value)}><option value="my-entries">My entries</option>{doc.sections.filter(item => item.id !== 'introduction').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label>Command(s)<textarea required rows={4} value={command} onChange={e => setCommand(e.target.value)} spellCheck={false} placeholder="show something <NAME>" /></label>
      <label>What it does / when to use it<input value={note} onChange={e => setNote(e.target.value)} /></label>
      <div className="flex gap-2"><button className="button primary" type="submit" disabled={importing}>Save entry</button><button className="button" type="button" onClick={() => setAdding(false)}><X size={14} />Cancel</button></div>
    </form></Panel>}
    <div className="document-layout"><div className="grid gap-5">
      {groups.map(group => <section key={group.id} className="cheatsheet-group" aria-labelledby={`topic-${group.id}`}>
        <h2 id={`topic-${group.id}`} className="cheatsheet-group-title">{group.title}
          <span>{group.sections.length} {group.sections.length === 1 ? 'section' : 'sections'}</span></h2>
        <div className="grid gap-5">{group.sections.map(item =>
          <FieldNoteSection key={item.id} section={item} values={values} variant="cheatsheet" />)}</div>
      </section>)}
      {!shown && <Panel><p>No matching commands or notes.</p></Panel>}
      {showPersonal && <Panel id="my-entries" title={`My entries (${userFiltered.length})`}>
        <p className="entry-note">Stored in this browser only. Export to back up or share.</p>
        {!userFiltered.length && <p className="entry-note">No entries to show. Add a field note above.</p>}
        <div className="grid gap-5">{userFiltered.map(entry => <FieldNoteSection key={entry.id} variant="cheatsheet"
          section={{ id: `entry-${entry.id}`, title: `#${entry.number} - ${entry.note || entry.command.split('\n')[0]}`,
            html: `${entry.note ? `<p>${escape(entry.note)}</p>` : ''}<div class="cli"><button type="button" class="copy" aria-label="Copy command block">${copyIcon} Copy</button><pre><code>${commentCode(entry.command)}</code></pre></div>` }} values={values}>
          <button className="text-action mt-2" disabled={importing} onClick={() => {
            if (confirm(`Delete "${entry.command.split('\n')[0]}"?`)) {
              setEntries(entries.filter(item => item.id !== entry.id));
              setNextSaved(nextNumber);
            }
          }}><Trash2 size={12} />Delete entry</button>
        </FieldNoteSection>)}</div>
      </Panel>}
    </div><nav className="document-toc cheatsheet-toc" aria-label="Cheatsheet sections"><p>SECTIONS</p>
      {groups.map(group => <div key={group.id} className="toc-group">
        <a className="toc-group-title" href={`#topic-${group.id}`} onClick={jump(`topic-${group.id}`)}>{group.title}</a>
        {group.sections.map(item => <a key={item.id} href={`#${item.id}`} onClick={jump(item.id)}>{item.title}</a>)}
      </div>)}
      {userFiltered.length > 0 && <div className="toc-group">
        <a className="toc-group-title" href="#my-entries" onClick={jump('my-entries')}>My entries</a>
        {userFiltered.map(entry => <a key={entry.id} href={`#entry-${entry.id}`} onClick={jump(`entry-${entry.id}`)}>
          #{entry.number} - {entry.note || entry.command.split('\n')[0]}</a>)}
      </div>}
    </nav></div>
  </>;
}
