/* Viz 2 (intermediate): Ethernet frame - watch 802.1Q / 802.1ad tags get pushed, stamped and
 * popped at each stage of the packet walk, with the config line responsible for each change. */
import { h } from '../lib/util.js';
import { parseTags } from './packetwalk.js';

function stages(out, dir) {
  const d = out.diagram, c = id => out.config.find(l => l.id === id);
  return dir === 'lr' ? [
    { at: 'Customer frame arrives at the Left port', tags: d.G12, obj: 'port-left' },
    { at: `Left classifier accepts ${d.K12}`, tags: d.G12, obj: 'classifier-left', line: c('C20') },
    { at: d.N13, tags: d.N12, obj: 'ingress-left', line: c('C21') },
    { at: d.P13, tags: d.N12, obj: 'fd', line: c('C19') },
    { at: d.S13, tags: d.T12, obj: 'egress-right', line: c('C26') },
    { at: 'Frame leaves the Right port', tags: d.Y12, obj: 'port-right' },
  ] : [
    { at: 'Frame arrives at the Right port', tags: d.Y15, obj: 'port-right' },
    { at: `Right classifier accepts ${d.V15}`, tags: d.Y15, obj: 'classifier-right', line: c('C24') },
    { at: d.S16, tags: d.S15, obj: 'ingress-right', line: c('C25') },
    { at: d.P13, tags: d.S15, obj: 'fd', line: c('C19') },
    { at: d.K16, tags: d.L15, obj: 'egress-left', line: c('C22') },
    { at: 'Frame leaves the Left port', tags: d.G15, obj: 'port-left' },
  ];
}

const FIELDS = [['da', 'Dest MAC', 6], ['sa', 'Src MAC', 6], ['stag', 'S-tag', 4], ['ctag', 'C-tag', 4], ['type', 'Type', 4], ['payload', 'Payload', 14], ['fcs', 'FCS', 4]];

export function mountFrame(model, el) {
  let dir = 'lr', i = 0, timer = null;
  const segs = Object.fromEntries(FIELDS.map(([k, label, w]) => [k, h(`div.fseg.f-${k}`, { style: `--w:${w}` }, h('b', label), h('small', ''))]));
  const frame = h('div.frame', Object.values(segs));
  const caption = h('div.frame-cap');
  const line = h('code.frame-line');
  const dots = h('div.frame-dots');
  const stageSelect = h('select.stage-select', { 'aria-label': 'Frame encapsulation step', onchange: () => { stop(); i = Number(stageSelect.value); draw(); } });
  const play = h('button.btn', { type: 'button', onclick: () => (timer ? stop() : start()) }, 'Play');
  const ctl = h('div.row',
    h('div.seg', [['lr', 'Left >>> Right'], ['rl', 'Left <<< Right']].map(([k, t]) => h('button', { type: 'button', dataset: { dir: k }, onclick: () => { stop(); dir = k; i = 0; draw(); } }, t))),
    stageSelect, h('button.btn', { type: 'button', onclick: () => step(-1) }, '<<'), play,
    h('button.btn', { type: 'button', onclick: () => step(1) }, '>>'), dots);
  el.append(ctl, frame, caption, line);

  function draw() {
    const st = stages(model.out, dir);
    i = Math.min(i, st.length - 1);
    const s = st[i];
    stageSelect.replaceChildren(...st.map((stage, index) => h('option', { value: String(index) }, `${index + 1}. ${stage.at}`)));
    stageSelect.value = String(i);
    const tags = parseTags(s.tags);
    const stag = tags.length === 2 ? tags[0] : tags.find(t => t.kind.startsWith('s'));
    const ctag = tags.length === 2 ? tags[1] : tags.find(t => t.kind.startsWith('c'));
    const any = tags.find(t => t.kind === 'any');
    segs.stag.classList.toggle('off', !stag);
    segs.ctag.classList.toggle('off', !(ctag || any));
    segs.stag.querySelector('small').textContent = stag ? stag.text.replace('S-', 'VID ') : '';
    segs.ctag.querySelector('small').textContent = any ? 'any' : ctag ? ctag.text.replace('C-', 'VID ') : '';
    segs.type.querySelector('small').textContent = '0x0800';
    caption.replaceChildren(h('span.badge', `${i + 1}/${st.length}`), ' ', s.at, h('span.muted', `  -  tags: ${s.tags}`));
    line.textContent = s.line ? s.line.text : '';
    line.hidden = !s.line;
    dots.replaceChildren(...st.map((_, k) => h(`span.dot${k === i ? '.on' : ''}`)));
    el.querySelectorAll('[data-dir]').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
    model.focus([s.obj]);
  }
  const step = n => { const len = stages(model.out, dir).length; i = (i + n + len) % len; draw(); };
  function start() { timer = setInterval(() => step(1), 1600); play.textContent = 'Pause'; }
  function stop() { clearInterval(timer); timer = null; play.textContent = 'Play'; }
  draw();
  const off = model.on(draw);
  return () => { stop(); off(); };
}
