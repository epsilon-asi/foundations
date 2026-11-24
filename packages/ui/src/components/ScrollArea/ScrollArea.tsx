import * as React from 'react';
import { Box } from '@mui/material';
import { styles, type SurfaceProps } from '../../internal/presentation';
export interface ScrollAreaHandle {
  scrollToTop(): void;
  scrollToBottom(options?: { smooth?: boolean }): void;
  isAtBottom(): boolean;
}
export interface ScrollAreaProps extends Omit<SurfaceProps, 'ref'> {
  'aria-label': string;
  axis?: 'x' | 'y' | 'both';
  maxHeight?: number | string;
  fadeEdges?: boolean;
  onReachStart?: () => void;
  onReachEnd?: () => void;
  ref?: React.Ref<ScrollAreaHandle>;
}
export const atBottom = (el: HTMLElement) => el.scrollHeight - el.clientHeight - el.scrollTop <= 2;
export function ScrollArea({
  axis = 'y',
  fadeEdges,
  maxHeight,
  onReachStart,
  onReachEnd,
  ref,
  onScroll,
  children,
  density,
  sx,
  ...props
}: ScrollAreaProps) {
  const root = React.useRef<HTMLDivElement>(null),
    content = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ overflow: false, start: true, end: true });
  const measure = React.useCallback(() => {
    const el = root.current;
    if (!el) return;
    const x = axis !== 'y' && el.scrollWidth > el.clientWidth,
      y = axis !== 'x' && el.scrollHeight > el.clientHeight;
    const start = (!x || Math.abs(el.scrollLeft) < 2) && (!y || el.scrollTop < 2);
    const end = (!x || el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) <= 2) && (!y || atBottom(el));
    setEdges((old) =>
      old.overflow === (x || y) && old.start === start && old.end === end ? old : { overflow: x || y, start, end }
    );
    return { start, end };
  }, [axis]);
  React.useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root.current!);
    observer.observe(content.current!);
    return () => observer.disconnect();
  }, [measure]);
  React.useImperativeHandle(
    ref,
    () => ({
      scrollToTop() {
        if (root.current) root.current.scrollTop = 0;
      },
      scrollToBottom(options) {
        const el = root.current;
        if (!el) return;
        if (options?.smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        else el.scrollTop = el.scrollHeight;
      },
      isAtBottom: () => !root.current || atBottom(root.current)
    }),
    []
  );
  return (
    <Box
      {...props}
      ref={root}
      role={props.role ?? 'region'}
      tabIndex={props.tabIndex ?? (edges.overflow ? 0 : undefined)}
      onScroll={(event) => {
        onScroll?.(event);
        const next = measure();
        if (next?.start && !edges.start) onReachStart?.();
        if (next?.end && !edges.end) onReachEnd?.();
      }}
      sx={styles(
        {
          minWidth: 0,
          maxHeight,
          overflowX: axis === 'y' ? 'hidden' : 'auto',
          overflowY: axis === 'x' ? 'hidden' : 'auto',
          scrollbarWidth: 'thin',
          ...(fadeEdges &&
            edges.overflow && {
              maskImage:
                'linear-gradient(to ' +
                (axis === 'x' ? 'right' : 'bottom') +
                ', ' +
                (edges.start ? 'black' : 'transparent') +
                ', black 5%, black 95%, ' +
                (edges.end ? 'black' : 'transparent') +
                ')'
            })
        },
        sx
      )}
    >
      <Box ref={content} sx={{ minWidth: axis === 'y' ? 0 : 'max-content' }}>
        {children}
      </Box>
    </Box>
  );
}
