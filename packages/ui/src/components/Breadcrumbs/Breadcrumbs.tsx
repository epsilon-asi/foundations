import * as React from 'react';
import { Breadcrumbs as MuiBreadcrumbs, Box, Link, Typography, type BreadcrumbsProps as MuiBreadcrumbsProps } from '@mui/material';
import { ActionButton } from '../ActionButton';
import type { LinkRenderer, LinkRenderProps } from '../../internal/links';

export type { LinkRenderer, LinkRenderProps } from '../../internal/links';
export interface BreadcrumbItem {
  id: string;
  label: React.ReactNode;
  href?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}
export interface BreadcrumbsProps extends Omit<MuiBreadcrumbsProps, 'children' | 'ref' | 'component'> {
  items: readonly BreadcrumbItem[];
  renderLink?: LinkRenderer;
}

export const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(function Breadcrumbs(
  { items, renderLink, sx, 'aria-label': label = 'Breadcrumb', ...props }, ref
) {
  const baseId = React.useId();
  if (items.length === 0) return null;
  return <MuiBreadcrumbs ref={ref} component="nav" aria-label={label} {...props}
    sx={[{ minWidth: 0, overflowWrap: 'anywhere', '& .MuiBreadcrumbs-ol': { rowGap: 0.5 },
      '& .MuiBreadcrumbs-li': { minWidth: 0, maxWidth: '100%' } }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    {items.map((item, index) => {
      const current = index === items.length - 1;
      if (current || item.disabled || (!item.href && !item.onClick)) return <Typography key={item.id} component="span" variant="body2"
        aria-current={current ? 'page' : undefined} aria-disabled={item.disabled || undefined}
        color={item.disabled ? 'text.disabled' : current ? 'text.primary' : 'text.secondary'}>{item.label}</Typography>;
      if (item.href) {
        const linkProps: LinkRenderProps = { id: `${baseId}-${encodeURIComponent(item.id)}`, href: item.href,
          children: item.label, onClick: item.onClick, style: { color: 'inherit', overflowWrap: 'anywhere' } };
        return <Box component="span" key={item.id} sx={{ color: 'text.secondary', '& > a': { textDecoration: 'none' }, '& > a:hover': { textDecoration: 'underline' } }}>
          {renderLink ? renderLink(linkProps) : <Link {...linkProps} variant="body2" />}
        </Box>;
      }
      return <ActionButton key={item.id} variant="text" color="inherit" onClick={item.onClick}
        sx={{ p: 0, fontWeight: 400, minWidth: 0, textAlign: 'start', textDecoration: 'underline' }}>{item.label}</ActionButton>;
    })}
  </MuiBreadcrumbs>;
});
