/* Shared builder state and highlighting. Click selections take precedence over transient hover. */
import { generate, normalize, defaults } from '../generator/l2evc.js';
import { get, set } from '../schema/l2-fields.js';

export class Model {
  constructor(initial = {}) {
    this.input = normalize(initial);
    this.out = generate(this.input);
    this.subs = new Set();
    this.focusSubs = new Set();
    this.selectedObjects = [];
    this.focusedObjects = [];
  }
  get(path) { return get(this.input, path); }
  set(path, value) {
    set(this.input, path, value);
    if (/^(left|right)\.fixedCos$/.test(path)) {
      if (/^[0-7]$/.test(String(value)))
        set(this.input, path.replace('.fixedCos', '.mapPolicy'), 'outer-tag');
      else if (value === '(disabled)')
        set(this.input, path.replace('.fixedCos', '.mapPolicy'), '(none)');
    }
    this.input = normalize(this.input);
    this.out = generate(this.input);
    for (const f of this.subs) f(this.out, path);
  }
  replace(input) {
    this.input = normalize(input);
    this.out = generate(this.input);
    for (const f of this.subs) f(this.out, '*');
  }
  reset() { this.replace(defaults()); }
  on(f) { this.subs.add(f); return () => this.subs.delete(f); }
  /** focus(['fp-left', ...]) highlights those objects everywhere; focus([]) clears. */
  focus(objects) {
    if (this.selectedObjects.length) return;
    this.focusedObjects = objects || [];
    for (const f of this.focusSubs) f(this.focusedObjects);
  }
  select(objects) {
    this.selectedObjects = [...objects];
    this.focusedObjects = [...objects];
    for (const f of this.focusSubs) f(this.focusedObjects);
  }
  onFocus(f) { this.focusSubs.add(f); f(this.focusedObjects); return () => this.focusSubs.delete(f); }
  /** Share links: #/l2evc?s=<base64 json> */
  shareParam() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.input)))); }
  static fromParam(s) { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } }
}
