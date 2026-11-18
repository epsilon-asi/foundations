import * as React from 'react';
import { Box, Typography, type BoxProps } from '@mui/material';
import { Breadcrumbs, type BreadcrumbItem, type BreadcrumbsProps } from '../Breadcrumbs';

export interface PageHeaderProps extends Omit<BoxProps, 'title' | 'children' | 'ref'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: readonly BreadcrumbItem[];
  breadcrumbProps?: Omit<BreadcrumbsProps, 'items'>;
  headingLevel?: 'h1' | 'h2';
}

/** A content header only; application layout and document metadata remain with the caller. */
export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  { title, subtitle, eyebrow, actions, breadcrumbs = [], breadcrumbProps, headingLevel = 'h1', sx, ...props }, ref
) {
  return <Box component="header" ref={ref} {...props} sx={[{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', minWidth: 0,
    overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Breadcrumbs items={breadcrumbs} {...breadcrumbProps} />
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
        {eyebrow != null ? <Typography component="div" variant="overline" color="text.secondary">{eyebrow}</Typography> : null}
        <Typography component={headingLevel} variant="h4">{title}</Typography>
        {subtitle != null ? <Typography component="div" variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>{subtitle}</Typography> : null}
      </Box>
      {actions != null ? <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0, maxWidth: '100%' }}>{actions}</Box> : null}
    </Box>
  </Box>;
});
