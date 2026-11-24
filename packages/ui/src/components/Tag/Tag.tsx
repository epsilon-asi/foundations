import type * as React from 'react';
import { Box, ButtonBase } from '@mui/material';
import { useIdentityPaint } from '../../internal/useIdentityPaint';
import type { IdentityColor } from '../../theme/category';
import { styles, type SurfaceProps } from '../../internal/presentation';
import { Tooltip } from '../Tooltip';
import { Text } from '../Text';
export interface TagProps extends Omit<SurfaceProps, 'onClick' | 'children' | 'ref'> {
  label: string;
  color?: IdentityColor;
  variant?: 'soft' | 'outlined' | 'solid';
  size?: 'xs' | 'sm';
  icon?: React.ReactNode;
  maxWidth?: number | string;
  tooltip?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onRemove?: () => void;
  removeLabel?: string;
  ref?: React.Ref<HTMLSpanElement>;
}
export function Tag({
  label,
  color,
  variant = 'soft',
  size = 'sm',
  maxWidth = '100%',
  tooltip,
  onClick,
  onRemove,
  removeLabel,
  icon,
  density,
  ref,
  sx,
  ...props
}: TagProps) {
  const { sample, base, background, ink } = useIdentityPaint(color, variant);
  const content = (
    <>
      {icon}
      <Text truncate variant="caption" sx={{ color: 'inherit' }}>
        {label}
      </Text>
    </>
  );
  return (
    <Tooltip title={tooltip ?? ''} describeChild>
      <Box
        component="span"
        ref={ref}
        {...props}
        sx={styles(
          {
            position: 'relative',
            display: 'inline-flex',
            verticalAlign: 'middle',
            alignItems: 'center',
            gap: 1,
            maxWidth,
            minWidth: 0,
            height: size === 'xs' ? 18 : density === 'comfortable' ? 30 : 28,
            px: size === 'xs' ? 1 : 2,
            border: 1,
            borderColor: variant === 'outlined' ? base : 'transparent',
            borderRadius: 1,
            backgroundColor: 'background.paper',
            backgroundImage: 'linear-gradient(' + background + ', ' + background + ')',
            color: ink,
            '& button': { color: 'inherit', gap: 1, minWidth: 0 },
            '& button:focus-visible': { outline: '2px solid currentColor' }
          },
          sx
        )}
      >
        <span ref={sample} hidden style={{ backgroundColor: background }} />
        {onClick ? <ButtonBase onClick={onClick}>{content}</ButtonBase> : content}
        {onRemove && (
          <ButtonBase aria-label={removeLabel ?? 'Remove ' + label} onClick={onRemove}>
            ×
          </ButtonBase>
        )}
      </Box>
    </Tooltip>
  );
}
