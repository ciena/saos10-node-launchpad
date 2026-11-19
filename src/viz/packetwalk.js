/* Packet-walk diagram for the L2 EVC service flow.
 * Blue lane = Left -> Right (row 12), red lane = Right -> Left (row 15). Each chip shows the
 * VLAN tag stack at that point; [data-obj] groups highlight with config lines and fields. */
import { esc } from '../lib/util.js';

const X = { outL: 70, portL: 190, fpL: 340, fd: 500, fpR: 660, portR: 810, outR: 930 };
const LANE = { top: 175, bot: 295 };

/** Parse 's83:c101' / 'Untagged' / 'cXXX' / 'AllTags' / '101' into tag chips. */
export function parseTags(v) {
  const s = String(v ?? '');
  if (/^untagged$/i.test(s)) return [{ kind: 'none', text: 'untagged' }];
  if (/^alltags$/i.test(s)) return [{ kind: 'any', text: 'all tags' }];
  if (/^\d+$/.test(s)) return [{ kind: 'c', text: s }];
  if (/^\d+-\d+$/.test(s)) return [{ kind: 'c', text: s }];
  if (s.includes(',')) return [{ kind: 'c', text: 'VLAN set' }];
  return s.split(':').filter(Boolean).map(t => {
    const kind = t[0].toLowerCase() === 's' ? 's' : 'c';
    const id = t.slice(1);
    return { kind: /xxx/i.test(id) ? `${kind}-any` : kind, text: `${kind === 's' ? 'S' : 'C'}-${/xxx/i.test(id) ? 'any' : id}` };
  });
}

const chipWidth = v => parseTags(v).length * 67 - 3;

export function chips(x, y, v, { anchor = 'middle', title = '', kind } = {}) {
  const tags = parseTags(v);
  const w = 64, gap = 3, total = tags.length * w + (tags.length - 1) * gap;
  let x0 = anchor === 'middle' ? x - total / 2 : anchor === 'end' ? x - total : x;
  return `<g class="chips"><title>${esc(title || v)}</title>${tags.map(t => {
    const g = `<g class="chip k-${kind || t.kind}"><rect x="${x0}" y="${y - 11}" width="${w}" height="22" rx="11"/><text x="${x0 + w / 2}" y="${y + 4}" text-anchor="middle">${esc(t.text)}</text></g>`;
    x0 += w + gap;
    return g;
  }).join('')}</g>`;
}

function box(obj, x, y, w, hgt, label, cls = '') {
  return `<g data-obj="${obj}" class="node ${cls}"><rect x="${x - w / 2}" y="${y}" width="${w}" height="${hgt}" rx="10"/><text class="node-title" x="${x}" y="${y + 18}" text-anchor="middle">${esc(label)}</text></g>`;
}

/** VLAN chips on the SOAM Tx (y 398) and Rx (y 440) lanes: the MEP's own tags, the stack after the
 * MEP's flow point (Up MEP only), and the stack on the wire. Rx mirrors Tx (a mirrored peer config). */
export function soamChips(trail, start, exit) {
  if (!trail) return '';
  const dir = Math.sign(exit - start);
  // Merge consecutive stages with the same stack; keep the MEP chip only when the stack changes.
  const shown = [];
  for (const s of trail.steps) {
    const prev = shown[shown.length - 1];
    if (prev && prev.stack === s.stack) { if (s.at !== 'mep') prev.labels.push(s.label); } else shown.push({ ...s, labels: s.at === 'mep' ? [] : [s.label] });
  }
  const w = s => chipWidth(s.stack);
  const xs = shown.length === 1 ? [(start + exit) / 2] : shown.map((s, i) => {
    if (i === 0) return start + dir * (w(s) / 2 + 6);
    if (i === shown.length - 1) return exit - dir * (w(s) / 2 + 14);
    return (start + dir * (w(shown[0]) + 6) + exit - dir * (w(shown[shown.length - 1]) + 14)) / 2;
  });
  return `<g class="soam-tags" data-mep="${esc(trail.mep)}" data-wire="${esc(trail.wire)}">${shown.map((s, i) => {
    const what = [s.at === 'mep' ? 'MEP l2-transform' : '', ...s.labels].filter(Boolean).join(' - ');
    return chips(xs[i], 398, s.stack, { title: `SOAM Tx - ${what}: ${s.stack}` })
      + chips(xs[i], 440, s.stack, { title: `SOAM Rx - ${what}: ${s.stack}${trail.notes.length ? ` - ${trail.notes.join(' - ')}` : ''}` });
  }).join('')}</g>`;
}

export function packetWalkSvg(out, { animate = true } = {}) {
  const d = out.diagram, i = out.input, v = out.vars;
  // "Ingress L2 Transform (name)" wraps onto two lines so it stays inside the flow point box.
  const opLabel = (obj, x, y, text) => {
    if (obj === 'fd' && i.device === '392x') {
      return `<g data-obj="fd" class="op"><text x="${x}" y="${y - 12}" text-anchor="middle">L2 Switching<tspan x="${x}" dy="12">with</tspan><tspan x="${x}" dy="12">FD's SVLAN : ${esc(i.fdSvlan)}</tspan></text></g>`;
    }
    const [head, name] = String(text).split(/ (?=\()/);
    return `<g data-obj="${obj}" class="op"><text x="${x}" y="${y}" text-anchor="middle">${esc(head)}${name
      ? `<tspan x="${x}" dy="12">${esc(name)}</tspan>` : ''}</text></g>`;
  };
  // Curly brace, tip up, spanning one endpoint's port and flow point boxes.
  const brace = (x1, x2, label) => {
    const xc = (x1 + x2) / 2, r = 8, top = 64, mid = 71, bot = 78;
    return `<g class="endpoint-group"><text class="endpoint-label" x="${xc}" y="${top - 6}" text-anchor="middle">${esc(label)}</text>
    <path class="endpoint-brace" d="M${x1},${bot} Q${x1},${mid} ${x1 + r},${mid} H${xc - r} Q${xc},${mid} ${xc},${top} Q${xc},${mid} ${xc + r},${mid} H${x2 - r} Q${x2},${mid} ${x2},${bot}"/></g>`;
  };
  const cfmSide = i.cfm.enabled ? (i.cfm.endpoint === 'Left' ? 'fpL' : 'fpR') : null;
  const fpX = cfmSide ? X[cfmSide] : 0;
  const mepX = i.cfm.direction === 'Up' ? (i.cfm.endpoint === 'Left' ? X.portL : X.portR) : X.fd;
  const exitsLeft = (i.cfm.endpoint === 'Left') === (i.cfm.direction === 'Down');
  const oamExit = exitsLeft ? 20 : 980;
  const oamStart = mepX + (exitsLeft ? -70 : 70);
  const txPath = `M${oamStart},398 H${oamExit}`;
  const rxPath = `M${oamExit},440 H${oamStart}`;
  const minX = Math.min(0, ...[d.G12, d.G15].map(tags => X.outL - 10 - chipWidth(tags) / 2 - 12));
  const maxX = Math.max(1000, ...[d.Y12, d.Y15].map(tags => X.outR + 10 + chipWidth(tags) / 2 + 12));
  return `<svg class="packetwalk" viewBox="${minX} 0 ${maxX - minX} ${cfmSide ? 480 : 390}" role="group" aria-label="Packet walk through the node">
  <defs>
    <marker id="pw-ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" class="arrow-b"/></marker>
    <marker id="pw-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" class="arrow-r"/></marker>
    <marker id="pw-oam" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10z" class="oam-arrow"/></marker>
  </defs>
  <rect class="nid" x="120" y="44" width="760" height="${cfmSide ? 420 : 330}" rx="16"/>
  <text class="nid-title" x="500" y="36" text-anchor="middle">SAOS 10 Node - ${esc(i.device === '392x' ? '392x' : '3931 / 394x / 398x / 51xx / 81xx')}</text>
  ${brace(X.portL - 55, X.fpL + 70, `Left Endpoint (${i.left.role})`)}
  ${brace(X.fpR - 70, X.portR + 55, `Right Endpoint (${i.right.role})`)}
  ${box('port-left', X.portL, 84, 110, 280, 'Port', 'port')}
  ${box('fp-left', X.fpL, 84, 140, 280, 'Flow Point', 'fp')}
  ${box('fd', X.fd, 84, 120, 280, d.P2, 'fd')}
  ${box('fp-right', X.fpR, 84, 140, 280, 'Flow Point', 'fp')}
  ${box('port-right', X.portR, 84, 110, 280, 'Port', 'port')}
  <text class="small mono" x="${X.fd}" y="120" text-anchor="middle">fd ${esc(v.fd)}</text>
  <text class="small mono" x="${X.fpL}" y="120" text-anchor="middle">${esc(v.left.fp)}</text>
  <text class="small mono" x="${X.fpR}" y="120" text-anchor="middle">${esc(v.right.fp)}</text>
  <text class="small mono" x="${X.portL}" y="120" text-anchor="middle">${esc(v.left.lp)}</text>
  <text class="small mono" x="${X.portR}" y="120" text-anchor="middle">${esc(v.right.lp)}</text>
  <g data-obj="classifier-left"><text class="small" x="${X.portL}" y="${LANE.top - 24}" text-anchor="middle">classifier</text>${chips(X.portL, LANE.top, d.K12, { title: `Left classifier accepts ${d.K12}`, kind: parseTags(d.G12)[0]?.kind })}</g>
  <g data-obj="classifier-right"><text class="small" x="${X.portR}" y="${LANE.bot - 24}" text-anchor="middle">classifier</text>${chips(X.portR, LANE.bot, d.V15, { title: `Right classifier accepts ${d.V15}`, kind: parseTags(d.Y15)[0]?.kind })}</g>

  <path class="lane-b" d="M20,${LANE.top + 26} H980" marker-end="url(#pw-ab)"/>
  <path class="lane-r" d="M980,${LANE.bot + 26} H20" marker-end="url(#pw-ar)"/>
  ${animate ? `<circle class="pkt-b" r="6"><animateMotion dur="5s" repeatCount="indefinite" path="M20,${LANE.top + 26} H980"/></circle>
  <circle class="pkt-r" r="6"><animateMotion dur="5s" begin="-2.5s" repeatCount="indefinite" path="M980,${LANE.bot + 26} H20"/></circle>` : ''}

  <text class="lane-label b" x="20" y="${LANE.top - 30}">Left &gt;&gt;&gt; Right</text>
  ${chips(X.outL - 10, LANE.top, d.G12, { title: `Arrives at Left port: ${d.G12}` })}
  <g data-obj="ingress-left">${chips(X.fpL, LANE.top, d.N12, { title: `After Left ingress: ${d.N12}` })}</g>
  ${opLabel('ingress-left', X.fpL, LANE.top + 52, d.N13)}
  ${opLabel('fd', X.fd, LANE.top + 52, d.P13)}
  <g data-obj="egress-right">${chips(X.fpR, LANE.top, d.T12, { title: `After Right egress: ${d.T12}` })}</g>
  ${opLabel('egress-right', X.fpR, LANE.top + 52, d.S13)}
  ${chips(X.outR + 10, LANE.top, d.Y12, { title: `Leaves Right port: ${d.Y12}` })}

  <text class="lane-label r" x="980" y="${LANE.bot - 30}" text-anchor="end">Left &lt;&lt;&lt; Right</text>
  ${chips(X.outR + 10, LANE.bot, d.Y15, { title: `Arrives at Right port: ${d.Y15}` })}
  <g data-obj="ingress-right">${chips(X.fpR, LANE.bot, d.S15, { title: `After Right ingress: ${d.S15}` })}</g>
  ${opLabel('ingress-right', X.fpR, LANE.bot + 52, d.S16)}
  <g data-obj="egress-left">${chips(X.fpL, LANE.bot, d.L15, { title: `After Left egress: ${d.L15}` })}</g>
  ${opLabel('egress-left', X.fpL, LANE.bot + 52, d.K16)}
  ${chips(X.outL - 10, LANE.bot, d.G15, { title: `Leaves Left port: ${d.G15}` })}
  ${cfmSide ? `<g data-obj="cfm" class="soam-instance" data-endpoint="${esc(i.cfm.endpoint)}" data-direction="${esc(i.cfm.direction)}">
    <title>SOAM ${esc(i.cfm.md)} / ${esc(out.cfm.ma)}: ${esc(i.cfm.direction)} MEP ${esc(i.cfm.localMep)} on ${esc(out.cfm.fpName)}; remote MEP ${esc(i.cfm.remoteMep)}. ${i.cfm.direction === 'Up' ? 'Traffic crosses the forwarding domain and exits the opposite port.' : 'Traffic exits directly through the local port.'}</title>
    <path class="soam-binding" d="M${fpX},364 V370 H${mepX} V377"/>
    <rect class="soam-node" x="${mepX - 70}" y="377" width="140" height="83" rx="10"/>
    <text x="${mepX}" y="401.5" text-anchor="middle" dominant-baseline="middle" class="small soam-label">SOAM - ${esc(out.cfm.ma.length > 17 ? `${out.cfm.ma.slice(0, 16)}...` : out.cfm.ma)}</text>
    <text x="${mepX}" y="418.5" text-anchor="middle" dominant-baseline="middle" class="small soam-label">MEP ${esc(i.cfm.localMep)} - ${esc(i.cfm.direction)}</text>
    <text x="${mepX}" y="435.5" text-anchor="middle" dominant-baseline="middle" class="small soam-label">Peer MEP ${esc(i.cfm.remoteMep)}</text>
    <path class="soam-traffic" data-traffic="tx" d="${txPath}" marker-end="url(#pw-oam)"/>
    <path class="soam-traffic" data-traffic="rx" d="${rxPath}" marker-end="url(#pw-oam)"/>
    <text x="${(oamStart + oamExit) / 2}" y="423" text-anchor="middle" class="small">SOAM Tx / Rx</text>
    ${soamChips(out.soam, oamStart, oamExit)}
    ${animate ? `<circle class="soam-packet" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="${txPath}"/></circle>
    <circle class="soam-packet" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="${rxPath}"/></circle>` : ''}
  </g>` : ''}
</svg>`;
}

/** Mount a live packet walk bound to a Model. */
export function mountPacketWalk(model, el, opts) {
  const highlight = objs => el.querySelectorAll('[data-obj]').forEach(g => {
    g.classList.toggle('hl', objs.includes(g.dataset.obj));
    g.setAttribute('aria-pressed', String(model.selectedObjects.includes(g.dataset.obj)));
  });
  const draw = out => {
    el.innerHTML = packetWalkSvg(out, opts);
    el.querySelectorAll('[data-obj]').forEach(g => {
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `Select ${g.dataset.obj.replaceAll('-', ' ')}`);
    });
    highlight(model.focusedObjects);
  };
  draw(model.out);
  const select = g => model.select(model.selectedObjects.includes(g.dataset.obj) ? [] : [g.dataset.obj]);
  const click = e => { const g = e.target.closest('[data-obj]'); if (g) select(g); };
  const keydown = e => {
    if (e.key === 'Escape') { model.select([]); e.preventDefault(); return; }
    const g = e.target.closest('[data-obj]');
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g); }
  };
  el.addEventListener('click', click);
  el.addEventListener('keydown', keydown);
  const off1 = model.on(draw);
  const off2 = model.onFocus(highlight);
  return () => {
    off1(); off2();
    el.removeEventListener('click', click);
    el.removeEventListener('keydown', keydown);
  };
}
