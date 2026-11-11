import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../generator/l2evc.js';
import { hierarchySvg } from './hierarchy.js';

test('object map grows transform boxes and lays out classifiers on separate rows', () => {
  const out = generate({
    device: '392x', fdSvlan: 4090,
    left: { allTags: true, untagged: true, l2cp: true, ingressOp: 'push-vid' },
    right: { egressOp: 'stamp-vid-value', vlan: 4093 },
  });
  const svg = hierarchySvg(out);
  const group = obj => svg.match(new RegExp(`<g data-obj="${obj}"[^]*?</g>`))[0];
  const ingress = group('ingress-left');
  assert.ok(ingress.includes('>Push 4090</text>') && !ingress.includes('ingressPush'));
  assert.ok(Number(ingress.match(/width="([^"]+)"/)[1]) >= 'Push 4090'.length * 7.5 + 20);
  const egress = group('egress-right');
  assert.ok(egress.includes('>Stamp 4093</text>') && !egress.includes('egressStamp'));
  assert.ok(Number(egress.match(/width="([^"]+)"/)[1]) >= 'Stamp 4093'.length * 7.5 + 20);
  assert.ok(group('egress-left').includes('>Pop</text>'));
  const classifiers = group('classifier-left');
  assert.match(classifiers, /height="90"/);
  assert.equal((classifiers.match(/class="o-name mono"/g) || []).length, 3);
  assert.ok(!classifiers.includes(', '));
  const transformY = Number(ingress.match(/<rect x="[^"]+" y="([^"]+)"/)[1]);
  assert.ok(transformY > 290, 'Transforms must move below the expanded classifier box');
});
