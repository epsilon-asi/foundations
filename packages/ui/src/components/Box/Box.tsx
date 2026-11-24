import { Box as MuiBox, type BoxProps as MuiBoxProps } from '@mui/material';
import type { Density } from '../../internal/presentation';
export interface BoxProps extends MuiBoxProps {
  as?: React.ElementType;
  density?: Density;
}
export function Box({ as, density, ...props }: BoxProps) {
  return <MuiBox component={as ?? 'div'} {...props} />;
}
