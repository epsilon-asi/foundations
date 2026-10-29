import * as React from 'react';
import { Box, Paper, Stack, Typography, type PaperProps } from '@mui/material';

export interface EmptyStateProps extends Omit<PaperProps, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({
  action,
  children,
  compact = false,
  description,
  icon,
  sx,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <Paper
      variant="outlined"
      sx={[
        {
          borderStyle: 'dashed',
          p: compact ? 3 : 5,
          textAlign: 'center'
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...props}
    >
      <Stack alignItems="center" spacing={2} sx={{ marginInline: 'auto', maxWidth: 480 }}>
        {icon ? (
          <Box
            sx={(theme) => ({
              alignItems: 'center',
              bgcolor: theme.palette.action.hover,
              borderRadius: '50%',
              color: theme.palette.primary.main,
              display: 'inline-flex',
              fontSize: 32,
              height: 72,
              justifyContent: 'center',
              width: 72
            })}
          >
            {icon}
          </Box>
        ) : null}

        <Box>
          <Typography component="h2" sx={{ fontWeight: 700 }} variant={compact ? 'h6' : 'h5'}>
            {title}
          </Typography>

          {description ? (
            <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
              {description}
            </Typography>
          ) : null}
        </Box>

        {action}
        {children}
      </Stack>
    </Paper>
  );
}
