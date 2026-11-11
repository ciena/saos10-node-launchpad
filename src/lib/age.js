/* Offline build-age check: the standalone HTML cannot reach the internal release feed, so age is the only staleness signal. */
export const STALE_AFTER_DAYS = 60;

/** Whole days between a YYYY-MM-DD build date and `now`; null when the date is invalid. */
export function buildAgeDays(buildDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(buildDate))) return null;
  const built = Date.parse(`${buildDate}T00:00:00Z`);
  if (Number.isNaN(built)) return null;
  return Math.max(0, Math.floor((now.getTime() - built) / 86_400_000));
}

export function isStale(buildDate, now = new Date(), days = STALE_AFTER_DAYS) {
  const age = buildAgeDays(buildDate, now);
  return age !== null && age >= days;
}
