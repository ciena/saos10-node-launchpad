import test from 'node:test';
import assert from 'node:assert/strict';
import { withInlineComments } from './config-comments.js';
import { generate as l2Generate } from '../generator/l2evc.js';
import { generate as ipGenerate, PLATFORMS } from '../generator/l3ip.js';

test('inline comments precede sections without changing executable commands', () => {
  const l2 = l2Generate({ emitMtu: true, cfm: { enabled: true } });
  const inputs = [
    [...l2.config, ...l2.cfm.config].filter(line => !line.skip),
    ...PLATFORMS.map(platform => ipGenerate({ platform }).config),
    ...Object.values(l2.fixedCos).filter(profile => profile.used).map(profile => profile.lines),
    l2.cfm.global,
  ];
  for (const input of inputs) {
    const plain = withInlineComments(input);
    const annotated = withInlineComments(input, true);
    const text = line => typeof line === 'string' ? line : line.text;
    assert.deepEqual(annotated.filter(line => !text(line).startsWith('#')), plain);
    assert.ok(annotated.some(line => text(line).startsWith('# ')));
    assert.ok(!annotated.some(line => text(line).includes('left blank')));
    assert.deepEqual(withInlineComments(annotated, true), annotated);
  }
});

test('comments group adjacent commands and preserve L2 highlighting metadata', () => {
  const lines = [
    { text: 'classifiers classifier one', objects: ['classifier'] },
    { text: 'classifiers classifier two', objects: ['classifier'] },
    { text: 'fds fd test', objects: ['fd'] },
  ];
  const annotated = withInlineComments(lines, true);
  assert.equal(annotated.length, 5);
  assert.deepEqual(annotated[0].objects, ['classifier']);
  assert.deepEqual(annotated[3].objects, ['fd']);
  assert.equal(lines.length, 3);
  assert.deepEqual(withInlineComments(['# skipped', 'config', 'exit']), ['config', 'exit']);
});
