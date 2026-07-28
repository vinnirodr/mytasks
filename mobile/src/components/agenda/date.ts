/**
 * Organizados — Agenda date helpers
 *
 * Small, pure, local-time date utilities shared by `WeekStrip`, `AgendaList`,
 * and the Agenda screen (`src/app/(app)/explore.tsx`). Deliberately NOT
 * `toISOString()` (UTC) — see `src/api/board.ts`'s `todayISO()`/
 * `weekStartISO()` for the same rationale: a UTC round-trip can shift the
 * calendar day near midnight, and occurrences compare against the device's
 * local date/timezone the same way the daily board already does.
 */

// ---------------------------------------------------------------------------
// Copy tables (pt-BR abbreviations, indexed by `Date#getDay()`/`getMonth()`)
// ---------------------------------------------------------------------------

export const WEEKDAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

export const MONTH_ABBR = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Local `YYYY-MM-DD` (zero-padded) — the same shape `Occurrence.date` uses. */
export function localISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` string as a local (not UTC) midnight `Date`. */
export function parseLocalISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Adds (or subtracts, if negative) whole days, letting `Date` carry month/year rollover. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The 7 local `Date`s (Mon..Sun) for the week whose Monday is `weekStart` (`YYYY-MM-DD`). */
export function weekDates(weekStart: string): Date[] {
  const monday = parseLocalISO(weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function weekdayAbbr(date: Date): string {
  return WEEKDAY_ABBR[date.getDay()];
}

export function monthAbbr(date: Date): string {
  return MONTH_ABBR[date.getMonth()];
}
