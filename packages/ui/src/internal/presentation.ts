import type { BoxProps } from '@mui/material';
import type { SystemStyleObject, SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';

export type Density = 'compact' | 'comfortable';
export interface SurfaceProps extends Omit<BoxProps, 'color' | 'title' | 'ref' | 'gap'> {
  density?: Density;
  ref?: React.Ref<HTMLDivElement>;
}
export function styles(base: SystemStyleObject<Theme>, sx?: BoxProps['sx']): SxProps<Theme> {
  return [reducedMotion, base, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])];
}
export const reducedMotion = {
  '@media (prefers-reduced-motion: reduce)': {
    '&, & *, & *::before, & *::after': {
      animation: 'none !important',
      transition: 'none !important',
      scrollBehavior: 'auto'
    }
  }
};
