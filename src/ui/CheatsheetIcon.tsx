import bulb from '../assets/lightbulb.svg?raw';

const path = bulb.match(/<path d="([^"]+)"/)?.[1];
if (!path) throw new Error('The cheatsheet lightbulb asset is missing its path');

export function CheatsheetIcon({ size = 20, className = '', 'aria-hidden': hidden = true }: {
  size?: number; className?: string; 'aria-hidden'?: boolean;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
    className={`cheatsheet-lightbulb ${className}`} aria-hidden={hidden}>
    <path d={path} />
  </svg>;
}
