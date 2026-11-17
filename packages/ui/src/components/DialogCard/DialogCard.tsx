import * as React from 'react';
import { Box, Card, CardActions, Stack, Typography, type CardProps } from '@mui/material';
import type { Breakpoint } from '@mui/material/styles';

export interface DialogCardProps extends Omit<CardProps, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: Breakpoint | false;
}

export const DialogCard = React.forwardRef<HTMLDivElement, DialogCardProps>(
  function DialogCard(
    { actions, children, icon, maxWidth = 'xl', message, subtitle, sx, title, variant = 'outlined', ...props },
    ref
  ) {
    return (
      <Card
        ref={ref}
        variant={variant}
        sx={[
          (theme) => ({
            width: '100%',
            minWidth: 0,
            overflowWrap: 'anywhere',
            maxWidth: maxWidth === false
              ? 'none'
              : maxWidth === 'xs'
                ? Math.max(theme.breakpoints.values.xs, 444)
                : theme.breakpoints.values[maxWidth],
            m: 0,
            borderColor: theme.palette.divider,
            p: 2,
            pt: 4
          }),
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
        {...props}
      >
        {title != null || subtitle != null || icon != null ? (
          <Stack alignItems="center" direction="row" spacing={2} sx={{ pb: 2 }}>
            {icon != null ? <Box sx={{ display: 'flex', flexShrink: 0 }}>{icon}</Box> : null}
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              {title != null ? (
                <Typography component="h2" variant="h5">
                  {title}
                </Typography>
              ) : null}
              {subtitle != null ? (
                <Typography component="p" color="text.secondary" variant="subtitle2">
                  {subtitle}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        ) : null}
        {message != null ? (
          <Typography sx={{ mb: children != null ? 2 : 0 }} variant="body1">
            {message}
          </Typography>
        ) : null}
        {children}
        {actions ? (
          <CardActions disableSpacing sx={{ mt: 4, p: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            {actions}
          </CardActions>
        ) : null}
      </Card>
    );
  }
);

DialogCard.displayName = 'DialogCard';
