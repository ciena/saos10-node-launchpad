/* Viz 1 (basic): SAOS object map - which config objects the service creates and how they bind.
 * Mirrors the F0 "How the SAOS objects fit together" chain: ETTP -> logical port -> flow point
 * (+ classifier, L2 transforms) -> forwarding domain. Click objects to select matching config lines. */
import { esc } from '../lib/util.js';

const rows = sub => Array.isArray(sub) ? sub : [sub];
const nodeWidth = (title, sub, minimum = 110) => Math.max(minimum, title.length * 6.5 + 20, ...rows(sub).map(text => text.length * 7.5 + 20));
const nodeHeight = sub => 54 + Math.max(0, rows(sub).length - 1) * 18;
function node(obj, x, y, w, kind, title, sub, cmd) {
  return `<g data-obj="${obj}" class="onode k-${kind}"><rect x="${x}" y="${y}" width="${w}" height="${nodeHeight(sub)}" rx="8"/>
  <text x="${x + 10}" y="${y + 20}" class="o-kind">${esc(title)}</text>
  ${rows(sub).map((text, index) => `<text x="${x + 10}" y="${y + 38 + index * 18}" class="o-name mono">${esc(text)}</text>`).join('')}${cmd ? `<title>${esc(cmd)}</title>` : ''}</g>`;
}
const edge = (x1, y1, x2, y2) => `<path class="o-edge" d="M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}"/>`;

export function hierarchySvg(out) {
  const v = out.vars, i = out.input;
  const cls = s => {
    const names = v[s].classifiers;
    return names.length > 10 ? [...names.slice(0, 10), `+ ${names.length - 10} more`] : names;
  };
  const xf = (s, d) => {
    const o = v[s][d === 'in' ? 'inOp' : 'egOp'];
    return o === 'no-op' ? 'no-op' : v[s][d === 'in' ? 'inName' : 'egName']
      .replace(/^(ingress|egress)/i, '').replace(/^(Push|Stamp)(\d+)$/, '$1 $2');
  };
  const transformWidth = Math.max(...['left', 'right'].flatMap(s => ['in', 'eg'].map(d => nodeWidth(d === 'in' ? 'Ingress' : 'Egress', xf(s, d)))));
  const portName = s => i[s].port === 'LAG' ? `LAG members (${v[s].lp})` : `ettp ${i[s].port}`;
  const columnWidth = Math.max(transformWidth * 2 + 10, ...['left', 'right'].flatMap(s => [
    nodeWidth(`Flow point (${i[s].role})`, v[s].fp, 230), nodeWidth('Classifier list', cls(s), 230),
    nodeWidth('Logical port', v[s].lp, 230), nodeWidth('ETTP / port', portName(s), 230),
  ]));
  const mepName = `${i.cfm.md} / ${out.cfm.ma} / ${i.cfm.localMep}`;
  const qosName = [i.left.meter, i.right.meter].filter(Boolean).join(', ') || 'frame-to-cos map';
  const centerWidth = Math.max(180, i.cfm.enabled ? nodeWidth('CFM MEP', mepName) : 0, nodeWidth('QoS', qosName));
  const leftX = 30, centerX = leftX + columnWidth + 30, rightX = centerX + centerWidth + 30;
  const classifierHeight = Math.max(...['left', 'right'].map(s => nodeHeight(cls(s))));
  const transformY = 200 + classifierHeight + 26, portY = transformY + 80, ettpY = portY + 80;
  const fdName = `${v.fd}${i.device === '392x' ? `  vlan-id ${i.fdSvlan}` : ''}`;
  const fdTitle = `Forwarding domain (${i.serviceType === 'ELINE' ? 'VPWS' : 'VPLS'})`;
  const width = rightX + columnWidth + 30, fdWidth = nodeWidth(fdTitle, fdName, 250);
  const viewWidth = Math.max(width, fdWidth + 60), fdX = (viewWidth - fdWidth) / 2;
  const col = (s, x) => {
    const S = s === 'left' ? 'Left' : 'Right';
    return [
      node(`fp-${s}`, x, 120, columnWidth, 'fp', `Flow point (${i[s].role})`, v[s].fp, `fps fp ${v[s].fp} fd-name ${v.fd} logical-port ${v[s].lp} ...`),
      node(`classifier-${s}`, x, 200, columnWidth, 'cls', 'Classifier list', cls(s)),
      node(`ingress-${s}`, x, transformY, transformWidth, 'xf', 'Ingress', xf(s, 'in')),
      node(`egress-${s}`, x + columnWidth - transformWidth, transformY, transformWidth, 'xf', 'Egress', xf(s, 'eg')),
      node(`port-${s}`, x, portY, columnWidth, 'lp', 'Logical port', v[s].lp),
      node(`port-${s}`, x, ettpY, columnWidth, 'ettp', 'ETTP / port', portName(s)),
      edge(x + columnWidth / 2, 174, x + columnWidth / 2, 200),
      edge(x + transformWidth / 2, 200 + nodeHeight(cls(s)), x + transformWidth / 2, transformY),
      edge(x + columnWidth - transformWidth / 2, 200 + nodeHeight(cls(s)), x + columnWidth - transformWidth / 2, transformY),
      edge(x + columnWidth / 2, transformY + 54, x + columnWidth / 2, portY),
      edge(x + columnWidth / 2, portY + 54, x + columnWidth / 2, ettpY),
      `<text x="${x + columnWidth / 2}" y="${ettpY + 72}" text-anchor="middle" class="o-side">${S} endpoint</text>`,
    ].join('');
  };
  return `<svg class="hierarchy" viewBox="0 0 ${viewWidth} ${ettpY + 80}" role="img" aria-label="SAOS object map">
  ${node('fd', fdX, 20, fdWidth, 'fd', fdTitle, fdName)}
  ${edge(viewWidth / 2 - 50, 74, leftX + columnWidth / 2, 120)}${edge(viewWidth / 2 + 50, 74, rightX + columnWidth / 2, 120)}
  ${col('left', leftX)}${col('right', rightX)}
  ${i.cfm.enabled ? node('cfm', centerX, 200, centerWidth, 'cfm', 'CFM MEP', mepName) + edge(centerX + centerWidth / 2, 200, i.cfm.endpoint === 'Left' ? leftX + columnWidth : rightX, 150) : ''}
  ${(i.left.meter || i.right.meter || i.left.fixedCos !== '(disabled)' || i.right.fixedCos !== '(disabled)') ? node('qos', centerX, transformY + 20, centerWidth, 'qos', 'QoS', qosName) : ''}
</svg>`;
}

export function mountHierarchy(model, el) {
  const highlight = () => el.querySelectorAll('[data-obj]').forEach(g => {
    const selected = model.selectedObjects.includes(g.dataset.obj);
    g.classList.toggle('hl', selected);
    g.setAttribute('aria-pressed', String(selected));
  });
  const draw = out => {
    el.innerHTML = hierarchySvg(out);
    el.querySelectorAll('[data-obj]').forEach(g => {
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `Select ${g.dataset.obj.replaceAll('-', ' ')}`);
    });
    highlight();
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
  const offs = [model.on(draw), model.onFocus(highlight)];
  return () => {
    offs.forEach(f => f());
    el.removeEventListener('click', click);
    el.removeEventListener('keydown', keydown);
  };
}
