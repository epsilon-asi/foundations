import type { Theme } from '@mui/material/styles';
import type { StatusBadgeTone } from '../components/StatusBadge';
export const categoricalPalette = {
  plum: ['#794c81', '#dba8e4'],
  iris: ['#59539d', '#bcb4ff'],
  denim: ['#3b5f86', '#a2c7ec'],
  lagoon: ['#306c79', '#83cbd5'],
  jade: ['#366855', '#99cdb6'],
  olive: ['#646638', '#c4cc88'],
  ochre: ['#875f29', '#e4bc81'],
  clay: ['#965744', '#e4aa94'],
  rosewood: ['#894861', '#e5a5bc'],
  mulberry: ['#824775', '#dca5d1'],
  slate: ['#546078', '#b5c1da'],
  cocoa: ['#755e51', '#d9bfae']
} as const;
export type CategoricalColor = keyof typeof categoricalPalette;
export type IdentityColor = StatusBadgeTone | CategoricalColor | (string & {});
export const monospaceFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace';
export const identityTheme = { monospaceFamily, categorical: categoricalPalette };
declare module '@mui/material/styles' {
  interface Theme {
    identity?: { monospaceFamily: string; categorical: Record<CategoricalColor, readonly [string, string]> };
  }
  interface ThemeOptions {
    identity?: Theme['identity'];
  }
}
const names = Object.keys(categoricalPalette) as CategoricalColor[];
export function categoricalColor(key: string | number): CategoricalColor {
  let hash = 2166136261;
  for (const char of String(key)) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return names[(hash >>> 0) % names.length];
}
export function identityColor(theme: Theme, color: IdentityColor = 'neutral') {
  if (Object.hasOwn(categoricalPalette, color)) {
    return (theme.identity?.categorical ?? categoricalPalette)[color as CategoricalColor][
      theme.palette.mode === 'dark' ? 1 : 0
    ];
  }
  if (color === 'neutral') return theme.palette.text.secondary;
  if (color === 'info' || color === 'success' || color === 'warning' || color === 'error')
    return theme.palette[color as Exclude<StatusBadgeTone, 'neutral'>].main;
  return color;
}
