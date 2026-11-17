import * as React from 'react';
import { Box, Card, CardActions, CardContent, CardHeader, type CardProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export interface DecoratedCardProps extends Omit<CardProps, 'title'> {
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  graphic?: React.ReactNode;
  graphicSx?: SxProps<Theme>;
  alignActions?: 'start' | 'end';
}

export const DecoratedCard = React.forwardRef<HTMLDivElement, DecoratedCardProps>(
  function DecoratedCard(
    { actions, alignActions = 'start', children, graphic, graphicSx, sx, title, ...props },
    ref
  ) {
    return (
      <Card
        ref={ref}
        sx={[
          { position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, overflowWrap: 'anywhere' },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
        {...props}
      >
        {graphic != null ? (
          <Box
            aria-hidden="true"
            sx={[
              { position: 'absolute', zIndex: 0, opacity: 0.1, top: 0, right: 0, pointerEvents: 'none' },
              ...(Array.isArray(graphicSx) ? graphicSx : graphicSx ? [graphicSx] : [])
            ]}
          >
            {graphic}
          </Box>
        ) : null}
        {title != null ? (
          <CardHeader
            title={title}
            slotProps={{ title: { component: 'h2', variant: 'h6' } }}
            sx={{ position: 'relative', mb: 0, pb: 0 }}
          />
        ) : null}
        <CardContent sx={{ position: 'relative', flexGrow: 1 }}>{children}</CardContent>
        {actions ? (
          <CardActions
            disableSpacing
            sx={{ position: 'relative', justifyContent: alignActions, flexWrap: 'wrap', gap: 1, px: 2, py: 1 }}
          >
            {actions}
          </CardActions>
        ) : null}
      </Card>
    );
  }
);

DecoratedCard.displayName = 'DecoratedCard';
