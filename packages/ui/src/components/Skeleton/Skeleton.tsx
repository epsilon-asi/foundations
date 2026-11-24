import { Skeleton as MuiSkeleton, type SkeletonProps as MuiSkeletonProps } from '@mui/material';
import { Stack } from '../Stack';
import { reducedMotion, type Density } from '../../internal/presentation';
export interface SkeletonProps extends Omit<MuiSkeletonProps, 'variant'> {
  variant?: 'text' | 'rect' | 'circle';
  lines?: number;
  density?: Density;
}
export function Skeleton({ variant = 'text', lines = 1, width, height, density, sx, ...props }: SkeletonProps) {
  return (
    <Stack aria-hidden="true" gap={density === 'comfortable' ? 2 : 1} sx={sx}>
      {Array.from({ length: Math.max(1, Math.floor(lines)) }, (_, i) => (
        <MuiSkeleton
          {...props}
          key={i}
          aria-hidden="true"
          sx={reducedMotion}
          variant={variant === 'rect' ? 'rectangular' : variant === 'circle' ? 'circular' : 'text'}
          width={width}
          height={height}
        />
      ))}
    </Stack>
  );
}
