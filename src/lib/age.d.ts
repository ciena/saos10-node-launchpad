export const STALE_AFTER_DAYS: number;
export function buildAgeDays(buildDate: string, now?: Date): number | null;
export function isStale(buildDate: string, now?: Date, days?: number): boolean;
