import * as React from 'react';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Divider,
  Typography,
  type BoxProps,
  type CardProps
} from '@mui/material';

export interface PropertyListItem {
  id?: string;
  label: React.ReactNode;
  value?: React.ReactNode;
  align?: 'horizontal' | 'vertical';
}

export interface PropertyListItemProps extends Omit<BoxProps, 'children'>, PropertyListItem {
  children?: React.ReactNode;
  disableGutters?: boolean;
  emptyValue?: React.ReactNode;
}

export const PropertyListItem = React.forwardRef<HTMLDivElement, PropertyListItemProps>(
  function PropertyListItem(
    { align = 'vertical', children, disableGutters = false, emptyValue = '—', label, sx, value, ...props },
    ref
  ) {
    const content = children ?? value ?? emptyValue;

    return (
      <Box
        ref={ref}
        sx={[
          {
            display: 'flex',
            flexDirection: align === 'horizontal' ? 'row' : 'column',
            flexWrap: 'wrap',
            minWidth: 0,
            overflowWrap: 'anywhere',
            gap: 0.5,
            px: disableGutters ? 0 : 3,
            py: 1.5
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
        ]}
        {...props}
      >
        <Typography
          component="dt"
          variant="subtitle2"
          sx={{ minWidth: 0, flex: align === 'horizontal' ? '0 1 180px' : undefined }}
        >
          {label}
        </Typography>
        <Box component="dd" sx={{ m: 0, flex: align === 'horizontal' ? '1 1 160px' : undefined, minWidth: 0, color: 'text.secondary', typography: 'body2' }}>
          {typeof content === 'boolean' ? String(content) : content}
        </Box>
      </Box>
    );
  }
);

PropertyListItem.displayName = 'PropertyListItem';

export interface PropertiesDisplayCardProps extends Omit<CardProps, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  properties: readonly PropertyListItem[];
  headerAction?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PropertiesDisplayCard = React.forwardRef<HTMLDivElement, PropertiesDisplayCardProps>(
  function PropertiesDisplayCard(
    { actions, headerAction, properties, subtitle, sx, title, ...props },
    ref
  ) {
    return (
      <Card ref={ref} sx={[{ minWidth: 0, overflowWrap: 'anywhere' }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} {...props}>
        <CardHeader
          title={title}
          subheader={subtitle}
          action={headerAction}
          slotProps={{ title: { component: 'h2', variant: 'h6' } }}
          sx={{
            flexWrap: 'wrap', gap: 1,
            '& .MuiCardHeader-content': { minWidth: 0, flex: '1 1 180px' },
            '& .MuiCardHeader-action': { m: 0, alignSelf: 'center', maxWidth: '100%' }
          }}
        />
        <Divider />
        <CardContent>
          <Box
            component="dl"
            sx={{ m: 0, '& > div:not(:last-child)': { borderBottom: 1, borderColor: 'divider' } }}
          >
            {properties.map((property, index) => (
              <PropertyListItem key={property.id ?? index} disableGutters {...property} />
            ))}
          </Box>
        </CardContent>
        {actions ? (
          <>
            <Divider />
            <CardActions disableSpacing sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
              {actions}
            </CardActions>
          </>
        ) : null}
      </Card>
    );
  }
);

PropertiesDisplayCard.displayName = 'PropertiesDisplayCard';
