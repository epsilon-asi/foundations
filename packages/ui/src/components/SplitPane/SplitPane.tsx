import * as React from 'react';
import { Box, type BoxProps } from '@mui/material';
import { useTheme, type SxProps, type Theme } from '@mui/material/styles';

export type SplitPaneResizeReason = 'pointer' | 'keyboard';
export interface SplitPaneProps extends Omit<BoxProps, 'children' | 'onChange'> {
  children: readonly [React.ReactNode, React.ReactNode];
  /** Horizontal places panels side by side; vertical places them above and below. Sizes are pixels. */
  orientation?: 'horizontal' | 'vertical';
  size?: number;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  minSecondSize?: number;
  keyboardStep?: number;
  disabled?: boolean;
  resizeLabel?: string;
  firstLabel?: string;
  secondLabel?: string;
  onSizeChange?: (size: number, reason: SplitPaneResizeReason) => void;
  onResizeEnd?: (size: number, reason: SplitPaneResizeReason) => void;
  firstSx?: SxProps<Theme>;
  secondSx?: SxProps<Theme>;
}

const HANDLE_SIZE = 8;
const nonnegative = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, value) : fallback;

export const SplitPane = React.forwardRef<HTMLDivElement, SplitPaneProps>(function SplitPane(
  { children, orientation = 'horizontal', size, defaultSize = 280, minSize = 120, maxSize,
    minSecondSize = 120, keyboardStep = 10, disabled = false, resizeLabel = 'Resize panels',
    firstLabel = 'First panel', secondLabel = 'Second panel', onSizeChange, onResizeEnd, firstSx, secondSx,
    sx, dir, ...props }, ref
) {
  const id = React.useId();
  const theme = useTheme();
  const root = React.useRef<HTMLDivElement>(null);
  const handle = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ pointerId: number; coordinate: number; size: number; last: number } | null>(null);
  const [internalSize, setSize] = React.useState(defaultSize);
  const [length, setLength] = React.useState<number | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const horizontal = orientation === 'horizontal';
  const rtl = (dir ?? theme.direction) === 'rtl';
  const sign = horizontal && rtl ? -1 : 1;
  React.useImperativeHandle(ref, () => root.current!);
  React.useLayoutEffect(() => {
    const measure = () => {
      const rect = root.current!.getBoundingClientRect();
      setLength(horizontal ? rect.width : rect.height);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(root.current!);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [horizontal]);
  const upper = Math.min(maxSize === undefined ? Infinity : nonnegative(maxSize, Infinity),
    length === null ? Infinity : Math.max(0, length - HANDLE_SIZE - nonnegative(minSecondSize, 0)));
  const lower = Math.min(nonnegative(minSize, 0), upper);
  const clamp = (next: number) => Math.min(upper, Math.max(lower, nonnegative(next, lower)));
  const current = clamp(size ?? internalSize);
  const change = (next: number, reason: SplitPaneResizeReason) => {
    const constrained = clamp(Math.round(next));
    if (constrained !== (reason === 'pointer' ? drag.current?.last : current)) {
      if (size === undefined) setSize(constrained);
      onSizeChange?.(constrained, reason);
    }
    return constrained;
  };
  const endDrag = (commit: boolean) => {
    const previous = drag.current;
    drag.current = null;
    setDragging(false);
    if (previous && handle.current?.hasPointerCapture?.(previous.pointerId)) handle.current.releasePointerCapture(previous.pointerId);
    if (previous && commit) onResizeEnd?.(previous.last, 'pointer');
  };
  React.useEffect(() => {
    // An axis, direction, or availability change invalidates an in-progress gesture.
    const previous = drag.current;
    drag.current = null;
    setDragging(false);
    if (previous && handle.current?.hasPointerCapture?.(previous.pointerId)) handle.current.releasePointerCapture(previous.pointerId);
  }, [disabled, orientation, sign]);
  React.useEffect(() => () => {
    const previous = drag.current;
    if (previous && handle.current?.hasPointerCapture?.(previous.pointerId)) handle.current.releasePointerCapture(previous.pointerId);
  }, []);
  return <Box ref={root} dir={dir ?? theme.direction} {...props} sx={[{ display: 'grid', width: '100%', height: '100%', minWidth: 0, minHeight: 0,
    ...(horizontal ? { gridTemplateColumns: `minmax(0, ${current}px) ${HANDLE_SIZE}px minmax(0, 1fr)` }
      : { gridTemplateRows: `minmax(0, ${current}px) ${HANDLE_SIZE}px minmax(0, 1fr)` }),
    userSelect: dragging ? 'none' : undefined }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}>
    <Box id={`${id}-first`} role="region" aria-label={firstLabel}
      sx={[{ minWidth: 0, minHeight: 0, overflow: 'auto', overflowWrap: 'anywhere' }, ...(Array.isArray(firstSx) ? firstSx : firstSx ? [firstSx] : [])]}>{children[0]}</Box>
    <Box ref={handle} role="separator" tabIndex={disabled ? -1 : 0} aria-label={resizeLabel}
      aria-orientation={horizontal ? 'vertical' : 'horizontal'} aria-controls={`${id}-first`}
      aria-valuemin={Math.round(lower)} aria-valuemax={Number.isFinite(upper) ? Math.round(upper) : undefined}
      aria-valuenow={Math.round(current)} aria-valuetext={`${Math.round(current)} pixels`} aria-disabled={disabled || undefined}
      sx={{ position: 'relative', touchAction: 'none', cursor: disabled ? 'default' : horizontal ? 'col-resize' : 'row-resize',
        bgcolor: 'divider', '&:hover': { bgcolor: disabled ? 'divider' : 'action.selected' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2, zIndex: 1 },
        '&::after': { content: '""', position: 'absolute', bgcolor: 'text.secondary', borderRadius: 1,
          ...(horizontal ? { width: 2, height: 24, top: 'calc(50% - 12px)', left: 3 } : { height: 2, width: 24, left: 'calc(50% - 12px)', top: 3 }) } }}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drag.current = { pointerId: event.pointerId, coordinate: horizontal ? event.clientX : event.clientY, size: current, last: current };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || event.pointerId !== start.pointerId || disabled) return;
        start.last = change(start.size + sign * ((horizontal ? event.clientX : event.clientY) - start.coordinate), 'pointer');
      }}
      onPointerUp={(event) => { if (drag.current?.pointerId === event.pointerId) endDrag(true); }}
      onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) endDrag(false); }}
      onLostPointerCapture={() => { if (drag.current) endDrag(false); }}
      onKeyDown={(event) => {
        if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
        const increment = nonnegative(keyboardStep, 10) * (event.shiftKey ? 5 : 1);
        let next: number;
        if (event.key === 'Home') next = lower;
        else if (event.key === 'End' && Number.isFinite(upper)) next = upper;
        else if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) next = current + sign * increment;
        else if (event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) next = current - sign * increment;
        else return;
        event.preventDefault();
        const result = change(next, 'keyboard');
        if (result !== current) onResizeEnd?.(result, 'keyboard');
      }} />
    <Box id={`${id}-second`} role="region" aria-label={secondLabel}
      sx={[{ minWidth: 0, minHeight: 0, overflow: 'auto', overflowWrap: 'anywhere' }, ...(Array.isArray(secondSx) ? secondSx : secondSx ? [secondSx] : [])]}>{children[1]}</Box>
  </Box>;
});
