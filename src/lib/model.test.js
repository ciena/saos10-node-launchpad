import test from 'node:test';
import assert from 'node:assert/strict';
import { Model } from './model.js';

test('selecting Fixed CoS sets only that endpoint MAP Policy to outer-tag and allows later overrides', () => {
  const defaults = new Model();
  assert.equal(defaults.get('left.mapPolicy'), '(none)');
  assert.equal(defaults.get('right.mapPolicy'), '(none)');
  for (const side of ['left', 'right']) {
    const other = side === 'left' ? 'right' : 'left';
    const model = new Model({ left: { mapPolicy: 'dscp' }, right: { mapPolicy: 'inner-tag' } });
    const otherPolicy = model.get(`${other}.mapPolicy`);
    for (const value of ['0', '5', '7']) {
      model.set(`${side}.fixedCos`, value);
      assert.equal(model.get(`${side}.mapPolicy`), 'outer-tag');
      assert.equal(model.get(`${other}.mapPolicy`), otherPolicy);
      model.set(`${side}.mapPolicy`, 'dscp');
      assert.equal(model.get(`${side}.mapPolicy`), 'dscp');
      assert.equal(model.get(`${other}.mapPolicy`), otherPolicy);
    }
    model.set(`${side}.fixedCos`, '(disabled)');
    assert.equal(model.get(`${side}.mapPolicy`), '(none)');
    assert.equal(model.get(`${other}.mapPolicy`), otherPolicy);
  }
});

test('packet selections override hover until explicitly cleared', () => {
  const model = new Model();
  const events = [];
  const off = model.onFocus(objects => events.push(objects));
  model.focus(['port-left']);
  assert.deepEqual(events.at(-1), ['port-left']);
  model.select(['fd']);
  model.focus(['fp-right']);
  model.focus([]);
  assert.deepEqual(model.focusedObjects, ['fd']);
  assert.deepEqual(events.at(-1), ['fd']);
  model.set('serviceName', 'updated');
  assert.deepEqual(model.selectedObjects, ['fd']);
  let initial;
  const offReplay = model.onFocus(objects => { initial = objects; });
  assert.deepEqual(initial, ['fd']);
  model.select(['fp-left']);
  assert.deepEqual(events.at(-1), ['fp-left']);
  model.select([]);
  assert.deepEqual(events.at(-1), []);
  model.focus(['port-right']);
  assert.deepEqual(events.at(-1), ['port-right']);
  off(); offReplay();
  const count = events.length;
  model.select(['fd']);
  assert.equal(events.length, count);
});
