import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, getContrastRatio } from '@mui/material/styles';
import { DecoratedCard, type DecoratedCardProps } from '../DecoratedCard';

export interface InsightCardProps extends DecoratedCardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  emphasis?: 'solid' | 'soft';
}

function InsightGraphic() {
  return <svg viewBox="0 0 440 420" width="440" height="420" fill="none">
    {[280, 180, 88].map((radius) => <circle key={radius} cx="40" cy="40" r={radius} fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeOpacity="0.4" />)}
  </svg>;
}

export const InsightCard = React.forwardRef<HTMLDivElement, InsightCardProps>(function InsightCard(
  { title, icon, headerAction, tone = 'primary', emphasis = 'solid', graphic = <InsightGraphic />, graphicSx, children, sx, ...props }, ref
) {
  return <DecoratedCard ref={ref} {...props} title={undefined} graphic={graphic}
    graphicSx={[{ left: 0, right: 'auto', opacity: emphasis === 'solid' ? 0.5 : 0.15 }, ...(Array.isArray(graphicSx) ? graphicSx : graphicSx ? [graphicSx] : [])]}
    sx={[(theme) => {
      const background = theme.palette[tone].dark;
      const foreground = getContrastRatio(background, theme.palette.common.white) >= getContrastRatio(background, theme.palette.common.black)
        ? theme.palette.common.white : theme.palette.common.black;
      return { bgcolor: emphasis === 'solid' ? background : alpha(theme.palette[tone].main, 0.1),
        color: emphasis === 'solid' ? foreground : 'text.primary',
        '& > .MuiCardContent-root': { display: 'flex', flexDirection: 'column', gap: 2 } };
    }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, minWidth: 0 }}>
      {icon != null ? <Box aria-hidden sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40,
        flexShrink: 0, borderRadius: 1, bgcolor: 'rgba(127,127,127,0.15)', '& > svg': { fontSize: 24 } }}>{icon}</Box> : null}
      <Typography component="h2" variant="h6" sx={{ flex: '1 1 140px', minWidth: 0 }}>{title}</Typography>
      {headerAction != null ? <Box sx={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}>{headerAction}</Box> : null}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
  </DecoratedCard>;
});
