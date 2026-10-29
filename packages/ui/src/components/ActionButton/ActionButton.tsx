import * as React from 'react';
import { Button, CircularProgress, Stack, type ButtonProps } from '@mui/material';

export interface ActionButtonProps extends ButtonProps {
  loading?: boolean;
  loadingLabel?: React.ReactNode;
  fullWidthOnMobile?: boolean;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      children,
      disabled,
      fullWidthOnMobile = false,
      loading = false,
      loadingLabel,
      startIcon,
      sx,
      ...props
    },
    ref
  ) {
    const responsiveSx = fullWidthOnMobile
      ? {
          width: {
            xs: '100%',
            sm: 'auto'
          }
        }
      : undefined;

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        startIcon={loading ? undefined : startIcon}
        sx={[responsiveSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
        {...props}
      >
        {loading ? (
          <Stack alignItems="center" direction="row" spacing={1}>
            <CircularProgress color="inherit" size={16} />
            <span>{loadingLabel ?? children}</span>
          </Stack>
        ) : (
          children
        )}
      </Button>
    );
  }
);

ActionButton.displayName = 'ActionButton';
