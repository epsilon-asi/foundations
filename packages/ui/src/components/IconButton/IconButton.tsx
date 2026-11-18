import * as React from 'react';
import { IconButton as MuiIconButton, Tooltip, type IconButtonProps as MuiIconButtonProps } from '@mui/material';

export interface IconButtonProps extends MuiIconButtonProps {
  'aria-label': string;
  tooltip?: React.ReactNode;
  outlined?: boolean;
  filled?: boolean;
  grow?: boolean;
  variant?: 'square' | 'round';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ tooltip, outlined = true, filled = false, grow = false, variant = 'square', size = 'small', sx, ...props }, ref) {
    const dimension = size === 'small' ? 32 : size === 'large' ? 48 : 40;
    const button = (
      <MuiIconButton
        ref={ref}
        size={size}
        sx={[
          {
            border: outlined ? '2px solid' : 'none', borderColor: 'divider',
            bgcolor: filled ? 'background.paper' : undefined,
            borderRadius: variant === 'round' ? '50%' : 1,
            width: grow ? undefined : dimension, height: dimension
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
        {...props}
      />
    );

    return tooltip ? (
      <Tooltip title={tooltip} describeChild>
        <span style={{ display: 'inline-flex' }}>{button}</span>
      </Tooltip>
    ) : button;
  }
);

IconButton.displayName = 'IconButton';
