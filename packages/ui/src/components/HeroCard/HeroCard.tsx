import * as React from 'react';
import { Box, Card, Stack, Typography, type CardProps } from '@mui/material';

export interface HeroCardProps extends Omit<CardProps, 'title' | 'content'> {
  title: React.ReactNode;
  header: React.ReactNode;
  content: React.ReactNode;
  action?: React.ReactNode;
  visual?: React.ReactNode;
  flip?: boolean;
}

export const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  function HeroCard({ title, header, content, action, visual, flip = false, children, sx, ...props }, ref) {
    const visualNode = visual != null ? (
      <Box sx={{ flex: { xs: '0 0 auto', md: '1 1 280px' }, minWidth: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
        {visual}
      </Box>
    ) : null;

    return (
      <Card ref={ref} sx={[{ overflow: 'hidden', minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          {flip ? visualNode : null}
          <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 320px' }, minWidth: 0, p: { xs: 3, md: 4 }, alignSelf: 'stretch' }}>
            <Typography component="p" color="primary.main" variant="overline">{title}</Typography>
            <Typography component="h2" variant="h5" sx={{ mt: 1 }}>{header}</Typography>
            <Box sx={{ mt: 2, typography: 'body1', color: 'text.secondary' }}>{content}</Box>
            {action != null ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
            {children}
          </Box>
          {!flip ? visualNode : null}
        </Stack>
      </Card>
    );
  }
);

HeroCard.displayName = 'HeroCard';
