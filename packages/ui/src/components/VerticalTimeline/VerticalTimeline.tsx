import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { relativeTime, timestamp, type DateValue } from '../../internal/dateTime';
import { EmptyState } from '../EmptyState';
import type { StatusBadgeTone } from '../StatusBadge';

export interface VerticalTimelineItem {
  id: string;
  title: React.ReactNode;
  content?: React.ReactNode;
  date?: DateValue | null;
  icon?: React.ReactNode;
  tone?: StatusBadgeTone;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}
export interface VerticalTimelineProps extends Omit<BoxProps<'ol'>, 'children' | 'ref' | 'position'> {
  items: readonly VerticalTimelineItem[];
  position?: 'left' | 'right' | 'alternate' | 'alternate-reverse';
  dateFormat?: 'absolute' | 'relative';
  locale?: string | string[];
  timeZone?: string;
  formatOptions?: Intl.DateTimeFormatOptions;
  now?: DateValue;
  density?: 'compact' | 'comfortable';
  emptyState?: React.ReactNode;
}

export const VerticalTimeline = React.forwardRef<HTMLOListElement, VerticalTimelineProps>(function VerticalTimeline(
  { items, position = 'right', dateFormat = 'absolute', locale = 'en-US', timeZone = 'UTC', formatOptions, now = Date.now(),
    density = 'compact', emptyState = <EmptyState compact title="No activity yet" />, sx, 'aria-label': label = 'Activity', ...props }, ref
) {
  const reference = timestamp(now);
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...formatOptions, timeZone });
  return <Box component="ol" ref={ref} aria-label={label} {...props}
    sx={[{ m: 0, p: 0, listStyle: 'none', width: '100%', minWidth: 0, containerType: 'inline-size', overflowWrap: 'anywhere' },
      ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {items.length === 0 ? <Box component="li">{emptyState}</Box> : items.map((item, index) => {
      const time = timestamp(item.date);
      const hasDate = item.date != null;
      const text = time === null ? '—' : dateFormat === 'relative' && reference !== null ? relativeTime(time, reference, locale) : formatter.format(time);
      const left = position === 'left' || (position === 'alternate' && index % 2 === 1) || (position === 'alternate-reverse' && index % 2 === 0);
      const spacing = density === 'compact' ? 1.5 : 2.5;
      return <Box component="li" key={item.id} sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', columnGap: 1.5, rowGap: 0.5, pb: spacing,
        '@container (min-width: 600px)': { gridTemplateColumns: 'minmax(0, 1fr) 28px minmax(0, 1fr)' } }}>
        <Box aria-hidden sx={{ gridColumn: 1, gridRow: '1 / span 2', display: 'flex', flexDirection: 'column', alignItems: 'center',
          '@container (min-width: 600px)': { gridColumn: 2, gridRow: 1 } }}>
          <Box sx={(theme) => {
            const colour = !item.tone || item.tone === 'neutral' ? theme.palette.text.secondary : theme.palette[item.tone][theme.palette.mode === 'dark' ? 'light' : 'dark'];
            return { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              bgcolor: alpha(colour, 0.12), color: colour, border: '1px solid', borderColor: alpha(colour, 0.3), '& > svg': { fontSize: 16 } };
          }}>{item.icon ?? <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' }} />}</Box>
          {index < items.length - 1 ? <Box sx={{ flex: 1, width: 2, minHeight: 12, bgcolor: 'divider', mt: 0.75, mb: -spacing }} /> : null}
        </Box>
        {hasDate ? <Box sx={{ gridColumn: 2, gridRow: 1, minWidth: 0,
          '@container (min-width: 600px)': { gridColumn: left ? 3 : 1, textAlign: left ? 'start' : 'end', pt: 0.5 } }}>
          {time === null ? <Typography component="span" variant="caption" color="text.secondary">{text}</Typography>
            : <Typography component="time" variant="caption" color="text.secondary" dateTime={new Date(time).toISOString()} title={formatter.format(time)}>{text}</Typography>}
        </Box> : null}
        <Box sx={{ gridColumn: 2, gridRow: hasDate ? 2 : 1, minWidth: 0,
          '@container (min-width: 600px)': { gridColumn: left ? 1 : 3, gridRow: 1, textAlign: left ? 'end' : 'start' } }}>
          <Typography component="h3" variant="subtitle2">{item.title}</Typography>
          {item.status != null ? <Box sx={{ mt: 0.5 }}>{item.status}</Box> : null}
          {item.content != null ? <Box sx={{ mt: 0.75, color: 'text.secondary', typography: 'body2' }}>{item.content}</Box> : null}
          {item.actions != null ? <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1,
            '@container (min-width: 600px)': { justifyContent: left ? 'flex-end' : 'flex-start' } }}>{item.actions}</Box> : null}
        </Box>
      </Box>;
    })}
  </Box>;
});
