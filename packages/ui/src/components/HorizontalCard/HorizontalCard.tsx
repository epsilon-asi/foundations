import * as React from 'react';
import { Box, Card, CardContent, Stack, Typography, type CardProps } from '@mui/material';

export interface HorizontalCardProps extends Omit<CardProps, 'title' | 'variant'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  contentSize?: 6 | 7 | 8 | 9;
  spacing?: number;
  variant?: CardProps['variant'] | 'transparent';
}

export const HorizontalCard = React.forwardRef<HTMLDivElement, HorizontalCardProps>(
  function HorizontalCard(
    { action, children, contentSize = 9, spacing = 2, subtitle, sx, title, variant, ...props },
    ref
  ) {
    return (
      <Card
        ref={ref}
        variant={variant === 'transparent' ? 'outlined' : variant}
        sx={[
          { width: '100%', minWidth: 0, containerType: 'inline-size', overflowWrap: 'anywhere' },
          ...(variant === 'transparent'
            ? [{ bgcolor: 'transparent', border: 'none', boxShadow: 'none' }]
            : []),
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
        {...props}
      >
        <CardContent>
          <Box sx={(theme) => ({
            display: 'grid',
            gap: theme.spacing(spacing),
            gridTemplateColumns: 'minmax(0, 1fr)',
            [`@container (min-width: ${theme.breakpoints.values.md}${theme.breakpoints.unit})`]: {
              gridTemplateColumns: `minmax(0, ${12 - contentSize}fr) minmax(0, ${contentSize}fr)`
            }
          })}>
            <Box sx={{ minWidth: 0 }}>
              <Stack spacing={2}>
                <Stack alignItems="center" direction="row" justifyContent="space-between" useFlexGap flexWrap="wrap" spacing={2}>
                  {typeof title === 'string' || typeof title === 'number' ? (
                    <Typography component="h2" variant="h6">
                      {title}
                    </Typography>
                  ) : (
                    title
                  )}
                  {action != null ? <Box>{action}</Box> : null}
                </Stack>
                {typeof subtitle === 'string' || typeof subtitle === 'number' ? (
                  <Typography color="text.secondary" variant="body2">
                    {subtitle}
                  </Typography>
                ) : (
                  subtitle
                )}
              </Stack>
            </Box>
            <Box sx={{ minWidth: 0 }}>{children}</Box>
          </Box>
        </CardContent>
      </Card>
    );
  }
);

HorizontalCard.displayName = 'HorizontalCard';
