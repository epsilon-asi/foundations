import { LinearProgress } from '@mui/material';
import { Stack } from '../Stack';
import { Text } from '../Text';
import type { StatusBadgeTone } from '../StatusBadge';
import type { SurfaceProps } from '../../internal/presentation';
export interface MeterProps extends SurfaceProps {
  label: string;
  value: number;
  valueText?: string;
  size?: 'xs' | 'sm';
  tone?: 'auto' | StatusBadgeTone;
  warnAt?: number;
  dangerAt?: number;
  showValue?: boolean;
  layout?: 'inline' | 'stacked';
}
export function Meter({
  label,
  value,
  valueText,
  size = 'sm',
  tone = 'auto',
  warnAt = 75,
  dangerAt = 90,
  showValue = true,
  layout = 'inline',
  density,
  ...props
}: MeterProps) {
  const n = Number.isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
  const state = tone === 'auto' ? (n >= dangerAt ? 'error' : n >= warnAt ? 'warning' : 'neutral') : tone;
  const description =
    (valueText ?? n + '%') +
    (tone === 'auto'
      ? ' · ' + ({ error: 'High', warning: 'Elevated', neutral: 'Normal' } as Record<string, string>)[state]
      : '');
  return (
    <Stack
      {...props}
      density={density}
      direction={layout === 'inline' ? 'row' : 'column'}
      align={layout === 'inline' ? 'center' : undefined}
      wrap
    >
      <Text variant="caption">{label}</Text>
      <LinearProgress
        variant="determinate"
        value={n}
        color={state === 'neutral' ? 'inherit' : state}
        role="meter"
        aria-label={label}
        aria-valuenow={n}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={description}
        sx={{
          height: size === 'xs' ? 4 : 6,
          flex: layout === 'inline' ? '1 1 48px' : undefined,
          minWidth: 24,
          color: state === 'neutral' ? 'text.secondary' : undefined,
          borderRadius: 1
        }}
      />
      {(showValue || state === 'warning' || state === 'error') && (
        <Text variant="caption">{showValue ? description : state}</Text>
      )}
    </Stack>
  );
}
