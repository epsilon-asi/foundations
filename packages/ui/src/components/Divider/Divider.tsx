import { Divider as MuiDivider, type DividerProps as MuiDividerProps } from '@mui/material';
import { styles, type Density } from '../../internal/presentation';
export interface DividerProps extends MuiDividerProps {
  inset?: boolean;
  label?: React.ReactNode;
  density?: Density;
}
export function Divider({ inset, label, orientation = 'horizontal', density, sx, ...props }: DividerProps) {
  return (
    <MuiDivider
      component="div"
      flexItem={orientation === 'vertical'}
      orientation={orientation}
      {...props}
      role={label == null ? 'presentation' : 'separator'}
      aria-orientation={label == null ? undefined : orientation}
      aria-label={props['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
      sx={styles(
        {
          alignSelf: 'stretch',
          minWidth: 0,
          whiteSpace: 'normal',
          '&::before, &::after': orientation === 'horizontal' ? { flex: '1 1 0', width: 'auto' } : {},
          '& .MuiDivider-wrapper': {
            whiteSpace: 'normal',
            maxWidth: '100%',
            minWidth: 0,
            overflowWrap: 'anywhere',
            textAlign: 'center'
          },
          ...(inset && {
            clipPath: (t) =>
              'inset(' +
              (orientation === 'horizontal'
                ? '0 ' + t.spacing(density === 'comfortable' ? 3 : 2)
                : t.spacing(density === 'comfortable' ? 3 : 2) + ' 0') +
              ')'
          })
        },
        sx
      )}
    >
      {label}
    </MuiDivider>
  );
}
