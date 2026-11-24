import * as React from 'react';
import { Box, type BoxProps } from '../Box';
import { styles } from '../../internal/presentation';
export interface StackProps extends Omit<BoxProps, 'gap'> {
  direction?: 'row' | 'column';
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  divider?: React.ReactNode;
  inline?: boolean;
}
export function Stack({
  direction = 'column',
  gap,
  align,
  justify,
  wrap,
  inline,
  divider,
  density = 'compact',
  children,
  sx,
  ...props
}: StackProps) {
  return (
    <Box
      {...props}
      sx={styles(
        {
          minWidth: 0,
          display: inline ? 'inline-flex' : 'flex',
          flexDirection: direction,
          gap: gap ?? (density === 'compact' ? 2 : 3),
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap'
        },
        sx
      )}
    >
      {divider == null
        ? children
        : React.Children.toArray(children).map((child, index) => (
            <React.Fragment key={React.isValidElement(child) ? (child.key ?? index) : index}>
              {index > 0 && divider}
              {child}
            </React.Fragment>
          ))}
    </Box>
  );
}
