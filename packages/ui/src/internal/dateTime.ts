export type DateValue = Date | string | number;

export function timestamp(value: DateValue | null | undefined): number | null {
  if (value == null || value === '') return null;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

/** Calendar days in the requested zone, independent of the length of a DST day. */
export function calendarDay(value: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)!.value);
  // setUTCFullYear also handles years 0..99 without Date.UTC's 1900 offset.
  const day = new Date(0);
  day.setUTCFullYear(part('year'), part('month') - 1, part('day'));
  return day.getTime() / 86_400_000;
}

export function relativeTime(value: number, now: number, locale: string | string[]): string {
  const seconds = (value - now) / 1000;
  const magnitude = Math.abs(seconds);
  const [divisor, unit] = magnitude < 60 ? [1, 'second'] as const
    : magnitude < 3600 ? [60, 'minute'] as const
      : magnitude < 86_400 ? [3600, 'hour'] as const : [86_400, 'day'] as const;
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(seconds / divisor), unit);
}
