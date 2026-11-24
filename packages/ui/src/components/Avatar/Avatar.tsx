import * as React from 'react';
import { Avatar as MuiAvatar, type AvatarProps as MuiAvatarProps } from '@mui/material';
import { categoricalColor, type IdentityColor } from '../../theme/category';
import { useIdentityPaint } from '../../internal/useIdentityPaint';
import { styles } from '../../internal/presentation';
export interface AvatarProps extends Omit<MuiAvatarProps, 'color' | 'children'> {
  name?: string;
  icon?: React.ReactNode;
  size?: 'xs' | 'sm' | 'md';
  color?: IdentityColor;
}
export function Avatar({
  name = '',
  src,
  icon,
  size = 'sm',
  color = categoricalColor(name),
  alt = name,
  sx,
  ...props
}: AvatarProps) {
  const { sample, ink, background } = useIdentityPaint(color, 'solid'),
    parts = name.trim().split(/\s+/);
  const initials = [parts[0], ...(parts.length > 1 ? [parts.at(-1)!] : [])]
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toLocaleUpperCase();
  let localSrc: string | undefined;
  if (src) {
    try {
      const url = new URL(src, 'app://local/');
      if (['blob:', 'data:', 'file:', 'app:'].includes(url.protocol) && !/^[\\/]{2}/.test(src)) localSrc = src;
    } catch {
      /* An invalid image uses the initials. */
    }
  }
  const dimension = { xs: 18, sm: 28, md: 36 }[size];
  return (
    <MuiAvatar
      {...props}
      role="img"
      aria-label={alt || 'Avatar'}
      alt={alt}
      src={localSrc}
      sx={styles(
        {
          width: dimension,
          height: dimension,
          fontSize: size === 'xs' ? '0.625rem' : '0.8125rem',
          bgcolor: 'background.paper',
          backgroundImage: 'linear-gradient(' + background + ', ' + background + ')',
          color: ink
        },
        sx
      )}
    >
      <span ref={sample} hidden style={{ backgroundColor: background }} />
      {icon ?? (initials || '•')}
    </MuiAvatar>
  );
}
