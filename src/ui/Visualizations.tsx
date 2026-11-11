import { useEffect, useRef, useState } from 'react';
import type { Model } from '../lib/model.js';
import { mountPacketWalk } from '../viz/packetwalk.js';
import { mountHierarchy } from '../viz/hierarchy.js';
import { mountFrame } from '../viz/frame.js';

const renderers = { walk: mountPacketWalk, map: mountHierarchy, frame: mountFrame };
export type Kind = keyof typeof renderers;
export const isVisualKind = (value: unknown): value is Kind =>
  typeof value === 'string' && Object.hasOwn(renderers, value);
export const visuals: { id: Kind; title: string; description: string }[] = [
  { id: 'walk', title: 'Packet walk', description: 'See frames traverse the node in both directions. Click an object to highlight its config.' },
  { id: 'map', title: 'Object maps', description: 'Connect the SAOS building blocks: ETTP, logical port, classifier, flow point and forwarding domain. Click an object to highlight it; click it again or press Escape in the diagram to clear.' },
  { id: 'frame', title: 'Frame Encapsulation', description: 'Inspect each packet-walk step directly. Watch S-tags and C-tags change and read the command responsible.' },
];

export function Diagram({ model, kind }: { model: Model; kind: Kind }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    setError('');
    let cleanup: (() => void) | undefined;
    try {
      cleanup = kind === 'walk' ? mountPacketWalk(model, node, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches })
        : renderers[kind](model, node);
    } catch (issue) {
      node.replaceChildren();
      setError(`Visualization unavailable: ${String(issue)}. Use the packet walk or object map instead.`);
    }
    return () => { cleanup?.(); node.replaceChildren(); };
  }, [model, kind]);
  return <>{error && <p className="note" role="alert">{error}</p>}<div ref={host} className={`diagram-host viz-${kind}`} /></>;
}
