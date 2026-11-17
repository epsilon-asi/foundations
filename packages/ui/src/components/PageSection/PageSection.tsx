import * as React from 'react';
import { Box, Divider, Paper, Stack, Typography, type PaperProps } from '@mui/material';

export interface PageSectionProps extends Omit<PaperProps, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageSection({
  action,
  children,
  subtitle,
  sx,
  title,
  ...props
}: PageSectionProps) {
  return (
    <Paper
      sx={[
        {
          overflow: 'hidden',
          width: '100%',
          minWidth: 0,
          overflowWrap: 'anywhere'
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...props}
    >
      <Stack
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        spacing={2}
        useFlexGap
        flexWrap="wrap"
        sx={{ px: 3, py: 2.5 }}
      >
        <Box sx={{ minWidth: 0, flex: { sm: '1 1 180px' } }}>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          {subtitle ? (
            <Typography color="text.secondary" sx={{ mt: 0.5 }} variant="body2">
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        {action}
      </Stack>

      <Divider />

      <Box sx={{ p: 3 }}>{children}</Box>
    </Paper>
  );
}
