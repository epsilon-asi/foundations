import type * as React from 'react';
import { Box, Chip, type ChipProps } from '@mui/material';
import { useIdentityPaint } from '../../internal/useIdentityPaint';
import type { IdentityColor } from '../../theme/category';
import { styles, type SurfaceProps } from '../../internal/presentation';
import type { StatusBadgeProps } from '../StatusBadge';
import { Tooltip } from '../Tooltip';
import { Text } from '../Text';
import { IconButton } from '../IconButton';
import { CloseIcon } from '../../internal/CloseIcon';
export interface TagProps extends Omit<SurfaceProps, 'onClick' | 'children' | 'ref'> {
  label: string;
  color?: IdentityColor;
  variant?: StatusBadgeProps['variant'];
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
  const height = size === 'xs' ? 18 : density === 'comfortable' ? 30 : 28;
  const chipProps = {
    size: 'small',
    variant: variant === 'outlined' ? 'outlined' : 'filled',
    icon: icon != null ? <span>{icon}</span> : undefined,
    label: (
      <Text truncate variant="caption" sx={{ color: 'inherit', fontWeight: 'inherit' }}>
        {label}
      </Text>
    ),
    sx: {
      maxWidth: '100%',
      minWidth: 0,
      height,
      color: 'inherit',
      // The independently focusable remove action occupies the end of the chip.
      ...(onRemove && { paddingInlineEnd: (theme) => theme.spacing(size === 'xs' ? 4.5 : 7) }),
      bgcolor: 'background.paper',
      backgroundImage: 'linear-gradient(' + background + ', ' + background + ')',
      borderColor: variant === 'outlined' ? base : undefined,
      '& .MuiChip-label': { minWidth: 0, px: size === 'xs' ? 1 : 2 },
      '& .MuiChip-icon': { color: 'inherit' },
      '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: -2 }
    }
  } satisfies ChipProps;
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
            minWidth: 0,
            maxWidth,
            color: ink
          },
          sx
        )}
      >
        <span ref={sample} hidden style={{ backgroundColor: background }} />
        {onClick ? (
          <Chip {...chipProps} component="button" type="button" onClick={onClick} />
        ) : (
          <Chip {...chipProps} component="span" />
        )}
        {onRemove && (
          <IconButton
            aria-label={removeLabel ?? 'Remove ' + label}
            onClick={onRemove}
            outlined={false}
            variant="round"
            sx={{
              position: 'absolute',
              insetInlineEnd: 0,
              top: 0,
              height,
              width: height,
              p: 0,
              color: 'inherit',
              '& svg': { fontSize: size === 'xs' ? 12 : 16 }
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>
    </Tooltip>
  );
}
