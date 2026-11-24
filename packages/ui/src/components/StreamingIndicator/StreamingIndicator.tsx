import { Box } from '@mui/material';
import { styles, reducedMotion, type SurfaceProps } from '../../internal/presentation';
export interface StreamingIndicatorProps extends Omit<SurfaceProps, 'ref'> {
  label: string;
  size?: 'sm' | 'md';
  ref?: React.Ref<HTMLSpanElement>;
}
export function StreamingIndicator({ label, size = 'sm', sx, density, ...props }: StreamingIndicatorProps) {
  return (
    <Box
      component="span"
      {...props}
      role="status"
      aria-label={label}
      sx={styles({ display: 'inline-flex', gap: density === 'comfortable' ? 1.5 : 1, ...reducedMotion }, sx)}
    >
      {[0, 1, 2].map((i) => (
        <Box
          component="span"
          key={i}
          aria-hidden
          sx={{
            height: size === 'sm' ? 4 : 6,
            width: size === 'sm' ? 4 : 6,
            bgcolor: 'currentColor',
            borderRadius: '50%',
            animation: 'ui-dot 1.2s ease-in-out infinite',
            animationDelay: i * 0.15 + 's',
            '@keyframes ui-dot': { '50%': { opacity: 0.35 } }
          }}
        />
      ))}
    </Box>
  );
}
