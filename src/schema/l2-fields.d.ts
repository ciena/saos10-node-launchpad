import type { Field, L2Input, Value } from '../ui/state';
interface SideField extends Omit<Field, 'path' | 'when'> {
  key: string;
  when?: (side: L2Input['left']) => boolean;
}
export const SERVICE_FIELDS: Field[];
export const SIDE_BASIC: SideField[];
export const SIDE_ADVANCED: SideField[];
export const CFM_BASIC: Field[];
export const CFM_ADVANCED: Field[];
export const GROUP_TITLES: Record<string, string>;
export function sideFields(side: 'left' | 'right', list: SideField[]): Field[];
export function get(input: L2Input, path: string): Value;
export function set(input: L2Input, path: string, value: Value): void;
