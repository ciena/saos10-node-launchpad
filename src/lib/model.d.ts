import type { L2Input, Value } from '../ui/state';
import type { generate } from '../generator/l2evc.js';
export class Model {
  constructor(initial?: L2Input);
  input: L2Input;
  out: ReturnType<typeof generate>;
  get(path: string): Value;
  set(path: string, value: Value): void;
  replace(input: L2Input): void;
  reset(): void;
  on(fn: (output: ReturnType<typeof generate>, path: string) => void): () => void;
  focus(objects: string[]): void;
  selectedObjects: string[];
  focusedObjects: string[];
  select(objects: string[]): void;
  onFocus(fn: (objects: string[]) => void): () => void;
  shareParam(): string;
  static fromParam(input: string): unknown;
}
