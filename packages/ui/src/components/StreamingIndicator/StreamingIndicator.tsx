import { CircularProgress } from '@mui/material';
import { styles, type SurfaceProps } from '../../internal/presentation';
export interface StreamingIndicatorProps extends Omit<SurfaceProps, 'ref'> {
  label: string;
  size?: 'sm' | 'md';
  ref?: React.Ref<HTMLSpanElement>;
}
export function StreamingIndicator({ label, size = 'sm', sx, density, ...props }: StreamingIndicatorProps) {
  return (
    <CircularProgress
      {...props}
      role="status"
      aria-label={label}
      size={size === 'sm' ? 12 : 16}
      color="inherit"
      sx={styles({ flexShrink: 0, verticalAlign: 'middle' }, sx)}
    />
  );
}
