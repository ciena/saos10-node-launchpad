import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../generator/l2evc.js';
import { packetWalkSvg } from './packetwalk.js';

test('SOAM positions follow MEP direction while retaining FP binding and wire direction', () => {
  for (const endpoint of ['Left', 'Right']) {
    for (const direction of ['Up', 'Down']) {
      const out = generate({ cfm: { enabled: true, endpoint, direction } });
      const svg = packetWalkSvg(out);
      const left = endpoint === 'Left';
      const exit = left === (direction === 'Down') ? 20 : 980;
      const mepX = direction === 'Up' ? (left ? 190 : 810) : 500;
      const start = mepX + (exit === 20 ? -70 : 70);
      assert.ok(svg.includes(`data-endpoint="${endpoint}" data-direction="${direction}"`));
      assert.ok(svg.includes(`data-traffic="tx" d="M${start},398 H${exit}"`));
      assert.ok(svg.includes(`data-traffic="rx" d="M${exit},440 H${start}"`));
      assert.ok(svg.includes(`class="soam-node" x="${mepX - 70}" y="377" width="140" height="83"`));
      assert.ok(svg.includes(`class="soam-binding" d="M${left ? 340 : 660},364 V370 H${mepX} V377"`));
      assert.ok(svg.includes(`x="${mepX}" y="418.5" text-anchor="middle" dominant-baseline="middle" class="small soam-label">MEP`));
      assert.ok(svg.includes('SOAM - test1'));
      assert.ok(svg.includes('animateMotion dur="3s"'));
      assert.ok(!packetWalkSvg(out, { animate: false }).includes('animateMotion'));
    }
  }
  assert.ok(!packetWalkSvg(generate({ cfm: { enabled: false } })).includes('class="soam-instance"'));
});

test('SOAM lanes show the MEP tag, the flow-point action and the wire tag stack', () => {
  const base = { fdSvlan: 200, left: { role: 'UNI', vlan: 101 }, right: { role: 'ENNI', vlan: 200 } };
  const up = packetWalkSvg(generate({ ...base, cfm: { enabled: true, endpoint: 'Left', direction: 'Up', tagged: true } }), { animate: false });
  assert.ok(up.includes('data-mep="c101" data-wire="s200:c101"'));
  assert.ok(up.includes('SOAM Tx - MEP l2-transform - fp1_test1: no ingress action: c101'));
  assert.ok(up.includes('egress push 200: s200:c101</title>'));
  assert.ok(!up.includes('soam-op'));
  assert.match(up, /y="423" text-anchor="middle" class="small">SOAM Tx \/ Rx/);
  const down = packetWalkSvg(generate({ ...base, cfm: { enabled: true, endpoint: 'Right', direction: 'Down', tagged: true, tagVlan: 101 },
    right: { role: 'ENNI', vlan: 200, egressOp: 'pop-type' } }), { animate: false });
  assert.ok(down.includes('data-wire="c101"'));
  assert.ok(down.includes('egress pop not applied'));
});

test('392x forwarding domain shows its SVLAN in a centered three-line switching label', () => {
  const svg = packetWalkSvg(generate({ device: '392x', fdSvlan: 4090 }), { animate: false });
  assert.ok(!svg.includes("FD's SVID"));
  assert.match(svg, /L2 Switching<tspan x="500" dy="12">with<\/tspan><tspan x="500" dy="12">FD's SVLAN : 4090<\/tspan>/);
  assert.ok(svg.includes('>Left &lt;&lt;&lt; Right</text>'));
});

test('Endpoint braces label each port/flow-point pair and L2 transforms wrap onto two lines', () => {
  const svg = packetWalkSvg(generate({ left: { role: 'UNI', vlan: 101 }, right: { role: 'ENNI', vlan: 200 } }), { animate: false });
  assert.ok(svg.includes('>Left Endpoint (UNI)</text>') && svg.includes('>Right Endpoint (ENNI)</text>'));
  assert.equal((svg.match(/class="endpoint-brace"/g) || []).length, 2);
  assert.ok(svg.includes('class="node-title" x="190" y="102" text-anchor="middle">Port</text>'));
  assert.ok(svg.includes('class="node-title" x="340" y="102" text-anchor="middle">Flow Point</text>'));
  assert.match(svg, /data-obj="egress-right" class="op"><text x="660" y="227" text-anchor="middle">Egress L2 Transform<tspan x="660" dy="12">\(egressPush\w+\)<\/tspan>/);
  assert.ok(svg.includes('>No Ingress L2 Action</text>'));
});
