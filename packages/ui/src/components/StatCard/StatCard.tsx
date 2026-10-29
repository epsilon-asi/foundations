import * as React from 'react';
import { Box, Card, CardContent, Chip, Stack, Typography, type CardProps } from '@mui/material';
import { alpha, type Theme } from '@mui/material/styles';

export type StatTone = 'positive' | 'neutral' | 'warning' | 'danger';

export interface StatCardProps extends Omit<CardProps, 'title'> {
  title: React.ReactNode;
  value: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  trendLabel?: string;
  tone?: StatTone;
  icon?: React.ReactNode;
}

const toneSx = (tone: StatTone) => (theme: Theme) => {
  switch (tone) {
    case 'positive':
      return {
        bgcolor: alpha(theme.palette.success.main, 0.12),
        color: theme.palette.success.dark
      };
    case 'warning':
      return {
        bgcolor: alpha(theme.palette.warning.main, 0.12),
        color: theme.palette.warning.dark
      };
    case 'danger':
      return {
        bgcolor: alpha(theme.palette.error.main, 0.12),
        color: theme.palette.error.dark
      };
    default:
      return {
        bgcolor: alpha(theme.palette.primary.main, 0.1),
        color: theme.palette.primary.dark
      };
  }
};

export function StatCard({
  description,
  eyebrow,
  icon,
  sx,
  title,
  tone = 'positive',
  trendLabel,
  value,
  ...props
}: StatCardProps) {
  return (
    <Card
      sx={[
        {
          minWidth: 260
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...props}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" spacing={2}>
          <Box>
            {eyebrow ? (
              <Typography color="text.secondary" sx={{ display: 'block', mb: 1 }} variant="caption">
                {eyebrow}
              </Typography>
            ) : null}

            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>

            <Typography sx={{ mt: 1, fontWeight: 800 }} variant="h4">
              {value}
            </Typography>

            {description ? (
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
                {description}
              </Typography>
            ) : null}
          </Box>

          {icon ? (
            <Box
              sx={(theme) => ({
                alignItems: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderRadius: 3,
                color: theme.palette.primary.main,
                display: 'inline-flex',
                fontSize: 28,
                height: 56,
                justifyContent: 'center',
                width: 56
              })}
            >
              {icon}
            </Box>
          ) : null}
        </Stack>

        {trendLabel ? (
          <Chip
            label={trendLabel}
            size="small"
            sx={[
              {
                mt: 2
              },
              toneSx(tone)
            ]}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
