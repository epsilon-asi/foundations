import * as React from 'react';
import { Stack as MuiStack, type StackProps as MuiStackProps } from '@mui/material';
import { styles, type Density } from '../../internal/presentation';

export type StackProps<C extends React.ElementType = 'div'> = Omit<
  MuiStackProps<C>,
  'gap' | 'spacing' | 'useFlexGap'
> & {
  as?: C;
  density?: Density;
  gap?: number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  inline?: boolean;
};

export function Stack<C extends React.ElementType = 'div'>(props: StackProps<C>): React.JSX.Element;
export function Stack({
  as,
  component,
  gap,
  direction,
  align,
  justify,
  wrap,
  inline,
  divider,
  children,
  density = 'compact',
  sx,
  ...props
}: Omit<StackProps, 'as'> & { as?: React.ElementType }) {
  // MUI filters falsy children when interleaving dividers. Keep a visible numeric zero.
  const contents =
    divider == null ? children : React.Children.map(children, (child) => (child === 0 ? <>{child}</> : child));
  return (
    <MuiStack
      {...props}
      component={component ?? as ?? 'div'}
      direction={direction}
      spacing={gap ?? (density === 'compact' ? 2 : 3)}
      useFlexGap
      divider={divider != null && <>{divider}</>}
      alignItems={align ?? props.alignItems}
      justifyContent={justify ?? props.justifyContent}
      flexWrap={wrap === undefined ? props.flexWrap : wrap ? 'wrap' : 'nowrap'}
      sx={styles({ minWidth: 0, ...(inline && { display: 'inline-flex' }) }, sx)}
    >
      {contents}
    </MuiStack>
  );
}
