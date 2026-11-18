import * as React from 'react';
import { Box, Tooltip, Typography, type BoxProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { calendarDay, timestamp, type DateValue } from '../../internal/dateTime';

export type { DateValue } from '../../internal/dateTime';
export interface DateDisplayProps extends Omit<BoxProps, 'children' | 'color' | 'ref'> {
  value: DateValue | null | undefined;
  start?: DateValue | null;
  now?: DateValue;
  locale?: string | string[];
  timeZone?: string;
  formatOptions?: Intl.DateTimeFormatOptions;
  color?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  showRelative?: boolean;
  progressLabel?: string;
  emptyValue?: React.ReactNode;
}

export const DateDisplay = React.forwardRef<HTMLDivElement, DateDisplayProps>(function DateDisplay(
  { value, start, now = Date.now(), locale = 'en-US', timeZone = 'UTC', formatOptions,
    color = 'primary', showRelative = false, progressLabel = 'Date range progress', emptyValue = '—', sx, ...props }, ref
) {
  const end = timestamp(value);
  const beginning = timestamp(start);
  const reference = timestamp(now);
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', ...formatOptions, timeZone });
  const formatted = end === null ? null : formatter.format(end);
  const endDay = end === null ? null : calendarDay(end, timeZone);
  const startDay = beginning === null ? null : calendarDay(beginning, timeZone);
  const today = reference === null ? null : calendarDay(reference, timeZone);
  const days = endDay === null || today === null ? null : endDay - today;
  const relative = days === null ? undefined : new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day');
  const progress = startDay === null || endDay === null || today === null || startDay > endDay ? null
    : startDay === endDay ? (today >= endDay ? 100 : 0)
      : Math.round(Math.max(0, Math.min(100, (today - startDay) / (endDay - startDay) * 100)));
  const date = <Box ref={ref} {...props} sx={[{ position: 'relative', minWidth: 0, width: '100%', overflow: 'hidden',
    border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.75, textAlign: 'center', overflowWrap: 'anywhere' },
    ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {progress !== null ? <Box role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={progress} aria-valuetext={`${progress}% · ${relative}`} sx={{ position: 'absolute', inset: 0 }}>
      <Box aria-hidden sx={(theme) => ({ width: `${progress}%`, height: '100%', bgcolor: alpha(theme.palette[color].main, 0.18) })} />
    </Box> : null}
    {formatted !== null ? <Typography component="time" dateTime={new Date(end!).toISOString()} variant="body2" sx={{ position: 'relative' }}>{formatted}</Typography>
      : <Typography component="span" variant="body2">{emptyValue}</Typography>}
    {showRelative && relative ? <Typography component="span" variant="caption" color="text.secondary" sx={{ position: 'relative', display: 'block' }}>{relative}</Typography> : null}
  </Box>;
  return relative && !showRelative ? <Tooltip title={relative} describeChild>{date}</Tooltip> : date;
});
