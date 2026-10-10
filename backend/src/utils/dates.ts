/**
 * Calendar-date helpers pinned to Sri Lanka time. They work on YYYY-MM-DD strings only, so the result
 * is the same whatever time zone the server runs in (a laptop in Sri Lanka, or a UTC host such as Vercel).
 */
export const todayInSriLanka = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });

const utcMs = (iso: string): number => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number => Math.round((utcMs(to) - utcMs(from)) / 86400000);

/** `iso` plus `days` calendar days, as YYYY-MM-DD. */
export const addDays = (iso: string, days: number): string => new Date(utcMs(iso) + days * 86400000).toISOString().slice(0, 10);
