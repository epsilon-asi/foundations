import * as React from 'react';
import { Typography, type TypographyProps } from '@mui/material';
import { useForkRef } from '@mui/material/utils';
import { Tooltip } from '../Tooltip';
import { styles } from '../../internal/presentation';
import { themeMonospace } from '../../theme/category';
export interface TextProps extends Omit<TypographyProps, 'variant' | 'color' | 'ref'> {
  variant?: 'body' | 'bodySmall' | 'caption' | 'label' | 'code' | 'title' | 'subtitle';
  tone?: 'default' | 'secondary' | 'muted' | 'success' | 'warning' | 'error' | 'info';
  weight?: 'regular' | 'medium';
  truncate?: boolean | number;
  as?: React.ElementType;
  ref?: React.Ref<HTMLElement>;
}
const variants = {
  body: 'body1',
  bodySmall: 'body2',
  caption: 'caption',
  label: 'subtitle2',
  code: 'body2',
  title: 'h6',
  subtitle: 'subtitle1'
} as const;
export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  truncate,
  as = 'span',
  sx,
  children,
  ref,
  ...props
}: TextProps) {
  const node = React.useRef<HTMLElement>(null);
  const merged = useForkRef(ref, node);
  const [clipped, setClipped] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = node.current;
    if (!el || !truncate) return;
    const measure = () => setClipped(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' && new ResizeObserver(measure);
    if (observer) observer.observe(el);
    return () => {
      if (observer) observer.disconnect();
    };
  }, [truncate, children]);
  const single = truncate === true || truncate === 1;
  const text = (
    <Typography
      {...props}
      ref={merged}
      noWrap={single || props.noWrap}
      component={as}
      variant={variants[variant]}
      tabIndex={
        props.tabIndex ??
        (truncate && clipped && !node.current?.parentElement?.closest('button, a[href], [role=button]')
          ? 0
          : undefined)
      }
      sx={styles(
        {
          m: 0,
          minWidth: 0,
          overflowWrap: 'anywhere',
          color:
            tone === 'default'
              ? 'text.primary'
              : tone === 'muted' || tone === 'secondary'
                ? 'text.secondary'
                : (t) => t.palette[tone][t.palette.mode === 'dark' ? 'light' : 'dark'],
          ...(variant === 'code' && { fontFamily: themeMonospace }),
          ...(weight && { fontWeight: weight === 'medium' ? 500 : 400 }),
          ...(single && { display: 'block' }),
          ...(truncate &&
            !single && {
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: truncate
            })
        },
        sx
      )}
    >
      {children}
    </Typography>
  );
  return truncate ? (
    <Tooltip title={clipped ? node.current?.textContent : ''} describeChild>
      {text}
    </Tooltip>
  ) : (
    text
  );
}
