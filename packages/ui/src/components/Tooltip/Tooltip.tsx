import * as React from 'react';
import { Tooltip as MuiTooltip, useMediaQuery, type TooltipProps as MuiTooltipProps } from '@mui/material';
import { styles, type Density } from '../../internal/presentation';
export interface TooltipProps extends Omit<MuiTooltipProps, 'ref'> {
  disabled?: boolean;
  density?: Density;
  ref?: React.Ref<HTMLElement>;
}
export function Tooltip({ disabled, children, density, slotProps, ...props }: TooltipProps) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');

  const child = children as React.ReactElement<{ disabled?: boolean }>;
  return (
    <MuiTooltip
      {...props}
      title={disabled ? '' : props.title}
      slotProps={{
        ...slotProps,
        tooltip: (owner) => {
          const supplied =
            typeof slotProps?.tooltip === 'function' ? slotProps.tooltip(owner) : slotProps?.tooltip;
          return {
            ...supplied,
            sx: styles(
              { px: density === 'comfortable' ? 3 : 2, py: density === 'comfortable' ? 2 : 1 },
              supplied?.sx
            )
          };
        },
        ...(reduce && { transition: { timeout: 0 } })
      }}
    >
      {child.props.disabled && !disabled ? (
        <span tabIndex={0} style={{ display: 'inline-flex', maxWidth: '100%' }}>
          {child}
        </span>
      ) : (
        child
      )}
    </MuiTooltip>
  );
}
