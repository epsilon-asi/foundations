import * as React from 'react';
import { useTheme } from '@mui/material';
import { getContrastRatio } from '@mui/material/styles';
import { identityColor, type IdentityColor } from '../theme/category';

/** Resolve browser CSS colors (including variables and alpha) over the actual surface. */
export function useIdentityPaint(color: IdentityColor | undefined, variant: 'soft' | 'outlined' | 'solid') {
  const theme = useTheme(),
    sample = React.useRef<HTMLSpanElement>(null);
  const base = identityColor(theme, color);
  const surface = theme.palette.background.paper;
  const background =
    variant === 'outlined'
      ? surface
      : 'color-mix(in srgb, ' + base + ' ' + (variant === 'solid' ? '100%' : '18%') + ', ' + surface + ')';
  const [ink, setInk] = React.useState(theme.palette.text.primary);
  React.useLayoutEffect(() => {
    const el = sample.current;
    if (!el || !window.CanvasRenderingContext2D) return;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = getComputedStyle(el).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const rgb = ctx.getImageData(0, 0, 1, 1).data;
    const actual = 'rgb(' + [rgb[0], rgb[1], rgb[2]].join(',') + ')';
    setInk(getContrastRatio(actual, '#fff') > getContrastRatio(actual, '#000') ? '#fff' : '#000');
  }, [surface, base, background, theme]);
  return { sample, base, background, ink };
}
