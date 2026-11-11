import { useCallback, useEffect, useState } from 'react';
import { defaults as l2Defaults } from '../generator/l2evc.js';
import { defaults as ipDefaults } from '../generator/l3ip.js';
import { defaults as satDefaults } from '../generator/sat.js';

export type L2Input = ReturnType<typeof l2Defaults>;
export type IpInput = ReturnType<typeof ipDefaults>;
export type SatInput = ReturnType<typeof satDefaults>;
export type Theme = 'light' | 'dark';
export type Route = '' | 'login' | 'golden' | 'terms' | 'cheatsheet' | 'l2evc' | 'l3ip' | 'sat' | 'design' | 'changelog' | 'instructions' | 'validate';
export type Value = string | boolean;
export interface Field {
  path: string;
  label: string;
  type?: string;
  options?: readonly string[];
  hint?: string | ((input: L2Input) => string | undefined);
  tier?: string;
  typical?: Value;
  group?: string;
  side?: string;
  when?: (input: L2Input) => boolean;
}

export function notify(message: string) {
  window.dispatchEvent(new CustomEvent<string>('snl-notify', { detail: message }));
}

export function startConfigReview(cli: string, source: string, platform = 'cn5164') {
  try {
    sessionStorage.setItem('snl-config-review', JSON.stringify({ cli, source, platform }));
    location.hash = '#/validate';
  } catch (error) {
    notify(`Could not open Config Validator: ${String(error)}. Copy the generated CLI into the Config Validator page instead.`);
  }
}

export function readStored<T>(key: string, fallback: T, valid: (value: unknown) => value is T, migrate?: (value: unknown) => unknown): T {
  try {
    const storageKey = `snl-${key}`;
    const current = localStorage.getItem(storageKey);
    const legacy = current === null;
    const raw = current ?? localStorage.getItem(`tbf-${key}`);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const value = migrate ? migrate(parsed) : parsed;
    if (!valid(value)) throw new Error('Saved data has an unsupported format');
    if (legacy) {
      try { localStorage.setItem(storageKey, JSON.stringify(value)); }
      catch (error) { setTimeout(() => notify(`Could not migrate saved ${key}: ${String(error)}. Existing data remains available.`), 0); }
    }
    return value;
  } catch (error) {
    // Run after the shell's notification listener has mounted.
    setTimeout(() => notify(`Could not restore ${key}: ${String(error)}. Defaults are shown; saved data has not been overwritten.`), 0);
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(`snl-${key}`, JSON.stringify(value));
  } catch (error) {
    notify(`Changes are available for this session but could not be saved: ${String(error)}. Export or download your work.`);
  }
}

export function useStored<T>(key: string, initial: T, valid: (value: unknown) => value is T, migrate?: (value: unknown) => unknown) {
  const [value, setValue] = useState(() => readStored(key, initial, valid, migrate));
  const update = useCallback((next: T) => {
    setValue(next);
    writeStored(key, next);
  }, [key]);
  return [value, update] as const;
}

export function shareSettings(route: Route, input: object) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(input))));
  return copyText(`${location.href.split('#')[0]}#/${route}?s=${encoded}`);
}

export function useSharedSettings<T extends object>(key: string, route: Route, defaults: T, migrate?: (value: unknown) => unknown) {
  const [input, setInput] = useStored(key, defaults, (v): v is T => matchesDefaults(v, defaults), migrate);
  useEffect(() => {
    const encoded = new URLSearchParams(location.hash.split('?')[1]).get('s');
    if (!encoded) return;
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(escape(atob(encoded))));
      const shared = migrate ? migrate(parsed) : parsed;
      if (!matchesDefaults(shared, defaults)) throw new Error('Shared settings have an unsupported format');
      setInput(shared);
      history.replaceState(null, '', `#/${route}`);
      setTimeout(() => notify('Shared configuration loaded'), 0);
    } catch (error) { setTimeout(() => notify(`Could not load shared settings: ${String(error)}. Your saved settings have not been changed.`), 0); }
    // Components are keyed by the full hash, so import once per shared link.
  }, [route, setInput, migrate]);
  return [input, setInput] as const;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function matchesDefaults<T extends object>(value: unknown, defaults: T): value is T {
  if (!isRecord(value)) return false;
  return Object.entries(defaults).every(([key, sample]) => {
    const item = value[key];
    if (Array.isArray(sample)) return Array.isArray(item) && item.every(v => typeof v === 'string');
    if (isRecord(sample)) return matchesDefaults(item, sample);
    return typeof item === typeof sample;
  });
}

export function fieldValue(input: object, path: string): Value {
  let current: unknown = input;
  for (const key of path.split('.')) current = isRecord(current) ? current[key] : undefined;
  return typeof current === 'boolean' || typeof current === 'string' ? current : '';
}

export function replaceField<T extends object>(input: T, path: string, value: Value): T {
  const next = structuredClone(input);
  if (!isRecord(next)) throw new Error('Form state must be an object');
  const parts = path.split('.');
  let target: Record<string, unknown> = next;
  for (const key of parts.slice(0, -1)) {
    const child = target[key];
    if (!isRecord(child)) throw new Error(`Invalid field path: ${path}`);
    target = child;
  }
  target[parts[parts.length - 1]] = value;
  return next;
}

export async function copyText(text: string) {
  let clipboardError: unknown;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied to clipboard');
      return;
    } catch (error) { clipboardError = error; }
  }
  const node = document.createElement('textarea');
  try {
    node.value = text;
    node.style.cssText = 'position:fixed;opacity:0';
    (document.querySelector('dialog:modal') || document.body).append(node);
    node.select();
    if (!document.execCommand('copy')) throw new Error(`Clipboard access was denied${clipboardError ? `: ${String(clipboardError)}` : ''}`);
    notify('Copied to clipboard');
  } catch (error) {
    notify(`Copy failed: ${String(error)}. Select and copy the text manually.`);
  } finally {
    node.remove();
  }
}

export function downloadFile(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
