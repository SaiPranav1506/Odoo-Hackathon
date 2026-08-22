// Date helpers used across modules (all dates treated as local calendar dates).

export function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayDateOnly(): Date {
  return toDateOnly(new Date());
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// Inclusive number of calendar days between two date-only values.
export function inclusiveDays(start: Date, end: Date): number {
  const ms = toDateOnly(end).getTime() - toDateOnly(start).getTime();
  return Math.round(ms / 86400000) + 1;
}

// Iterate dates inclusive.
export function* eachDate(start: Date, end: Date): Generator<Date> {
  let cur = toDateOnly(start);
  const endD = toDateOnly(end);
  let guard = 0;
  while (cur.getTime() <= endD.getTime() && guard < 366) {
    yield cur;
    cur = addDays(cur, 1);
    guard++;
  }
}

export function dateRangeOverlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  const as = toDateOnly(aStart).getTime();
  const ae = toDateOnly(aEnd).getTime();
  const bs = toDateOnly(bStart).getTime();
  const be = toDateOnly(bEnd).getTime();
  return as <= be && bs <= ae;
}

export function currentMonthPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime());
}