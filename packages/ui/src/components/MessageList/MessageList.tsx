import * as React from 'react';
import { Box } from '@mui/material';
import type { VirtuosoHandle } from 'react-virtuoso';
import { ActionButton } from '../ActionButton';
import { EmptyState } from '../EmptyState';
import { atBottom } from '../ScrollArea/ScrollArea';
import { styles, type SurfaceProps } from '../../internal/presentation';
const Virtuoso = React.lazy(() =>
  import('./virtualizer').then((module) => ({ default: module.Virtuoso }))
) as typeof import('react-virtuoso').Virtuoso;
export interface MessageListHandle {
  scrollToBottom(options?: { smooth?: boolean }): void;
  scrollToItem(key: string, options?: { align?: 'start' | 'center' | 'end'; highlight?: boolean }): void;
  isAtBottom(): boolean;
}
export interface MessageListProps<Item> extends Omit<SurfaceProps, 'children' | 'ref' | 'gap'> {
  'aria-label': string;
  items: readonly Item[];
  getItemKey: (item: Item) => string;
  renderItem: (item: Item, state: { index: number; highlighted: boolean }) => React.ReactNode;
  estimateItemHeight?: number;
  followOutput?: 'auto' | 'always' | false;
  onReachTop?: () => void;
  loadingOlder?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
  jumpToLatestLabel?: string;
  unseenCount?: number;
  gap?: number;
  ref?: React.Ref<MessageListHandle>;
}
interface Slots {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
}
const slots = {
  Header: ({ context }: { context: Slots }) => (
    <>
      {context.loading && <span role="status">Loading earlier items…</span>}
      {context.header}
    </>
  ),
  Footer: ({ context }: { context: Slots }) => <>{context.footer}</>
};
export function MessageList<Item>({
  items,
  getItemKey,
  renderItem,
  estimateItemHeight = 72,
  followOutput = 'auto',
  onReachTop,
  loadingOlder,
  header,
  footer,
  emptyState,
  jumpToLatestLabel = 'Jump to latest',
  unseenCount,
  gap,
  density,
  ref,
  sx,
  'aria-label': label,
  onKeyDown,
  ...props
}: MessageListProps<Item>) {
  const list = React.useRef<VirtuosoHandle>(null),
    viewport = React.useRef<HTMLElement | null>(null);
  const [bottom, setBottom] = React.useState(true),
    pinned = React.useRef(true);
  const navigation = React.useRef<{ key: string; align: 'start' | 'center' | 'end' }>(undefined);
  const keys = React.useMemo(() => items.map(getItemKey), [items, getItemKey]);
  const currentKeys = React.useRef(keys);
  React.useLayoutEffect(() => {
    currentKeys.current = keys;
  }, [keys]);
  const navigate = React.useCallback(() => {
    const target = navigation.current;
    if (!target || !list.current) return;
    const index = currentKeys.current.indexOf(target.key);
    if (index >= 0) list.current.scrollToIndex({ index, align: target.align });
  }, []);
  const attachList = React.useCallback(
    (handle: VirtuosoHandle | null) => {
      list.current = handle;
      if (handle && navigation.current) requestAnimationFrame(navigate);
    },
    [navigate]
  );
  const frame = React.useRef(0),
    userScroll = React.useRef(false);
  const followHeight = React.useCallback(() => {
    cancelAnimationFrame(frame.current);
    if (followOutput)
      frame.current = requestAnimationFrame(() => {
        const el = viewport.current;
        if (el && (followOutput === 'always' || pinned.current)) {
          el.scrollTop = el.scrollHeight;
        }
      });
  }, [followOutput]);
  React.useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const measureLast = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(followHeight);
      observer.observe(node);
      return () => observer.disconnect();
    },
    [followHeight]
  );
  const [highlight, setHighlight] = React.useState<string>(),
    timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  // Keep stable virtual indices for the existing items when older history arrives.
  const [anchor, setAnchor] = React.useState({ first: keys[0], index: 1_000_000_000 });
  let first = anchor.index;
  if (keys[0] !== anchor.first) {
    const prepended = anchor.first === undefined ? -1 : keys.indexOf(anchor.first);
    first = prepended < 0 ? 1_000_000_000 : Math.max(0, first - prepended);
    setAnchor({ first: keys[0], index: first });
  }
  // A scroll-to-index request can retry as measurements arrive. Rebase its
  // index when a prepend moves the destination while that request is pending.
  React.useLayoutEffect(() => {
    if (!navigation.current) return;
    navigate();
    const next = requestAnimationFrame(navigate);
    return () => cancelAnimationFrame(next);
  }, [first, navigate]);
  const scrollToBottom = (options?: { smooth?: boolean }) => {
    navigation.current = undefined;
    userScroll.current = false;
    pinned.current = true;
    list.current?.scrollToIndex({
      index: 'LAST',
      align: 'end',
      behavior:
        options?.smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
    });
  };
  React.useImperativeHandle(ref, () => ({
    scrollToBottom,
    isAtBottom: () => !viewport.current || atBottom(viewport.current),
    scrollToItem(key, options) {
      const index = keys.indexOf(key);
      if (index < 0) return;
      userScroll.current = false;
      pinned.current = index === keys.length - 1 && options?.align === 'end';
      navigation.current = { key, align: options?.align ?? 'start' };
      navigate();
      if (options?.highlight) {
        setHighlight(key);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setHighlight(undefined), 1800);
      }
    }
  }));
  const context = React.useMemo(() => ({ header, footer, loading: loadingOlder }), [header, footer, loadingOlder]);
  return (
    <Box {...props} sx={styles({ position: 'relative', height: 360, minHeight: 0, minWidth: 0 }, sx)}>
      {items.length === 0 ? (
        <Box role="log" tabIndex={0} aria-label={label}>
          {header}
          {emptyState ?? <EmptyState title="No messages" />}
          {footer}
        </Box>
      ) : (
        <React.Suspense fallback={<Box role="log" aria-label={label} aria-busy="true" tabIndex={0} />}>
          <Virtuoso<Item, Slots>
            ref={attachList}
            role="log"
            aria-label={label}
            aria-live="off"
            tabIndex={0}
            data={items}
            components={slots}
            context={context}
            firstItemIndex={first}
            defaultItemHeight={estimateItemHeight}
            initialTopMostItemIndex={0}
            computeItemKey={(_, item) => getItemKey(item)}
            followOutput={false}
            scrollerRef={(el) => {
              viewport.current = el instanceof HTMLElement ? el : null;
            }}
            onWheelCapture={(event) => {
              navigation.current = undefined;
              userScroll.current = true;
              if (event.deltaY < 0) pinned.current = false;
            }}
            onTouchMoveCapture={() => {
              navigation.current = undefined;
              userScroll.current = true;
              pinned.current = false;
            }}
            onPointerDownCapture={(event) => {
              if (event.target === event.currentTarget) {
                navigation.current = undefined;
                userScroll.current = true;
              }
            }}
            isScrolling={(scrolling) => {
              if (!scrolling) userScroll.current = false;
            }}
            onScroll={(e) => {
              const el = e.currentTarget;
              if (!(el instanceof HTMLElement)) return;
              if (userScroll.current) pinned.current = atBottom(el);
              else if (!navigation.current && atBottom(el)) pinned.current = true;
            }}
            atBottomStateChange={setBottom}
            startReached={() => {
              if (!loadingOlder) onReachTop?.();
            }}
            totalListHeightChanged={followHeight}
            onKeyDown={(e) => {
              onKeyDown?.(e);
              if (e.defaultPrevented || e.target !== e.currentTarget) return;
              const el = viewport.current;
              if (!el) return;
              if (['Home', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                navigation.current = undefined;
                userScroll.current = true;
                pinned.current = false;
              }
              if (e.key === 'End') scrollToBottom();
              else if (e.key === 'Home') el.scrollTop = 0;
              else if (e.key === 'PageUp' || e.key === 'PageDown')
                el.scrollTop += (e.key === 'PageUp' ? -1 : 1) * el.clientHeight;
              else return;
              e.preventDefault();
            }}
            itemContent={(index, item) => {
              const marked = highlight !== undefined && getItemKey(item) === highlight;
              return (
                <Box
                  ref={index - first === items.length - 1 ? measureLast : undefined}
                  sx={{
                    pb: index - first === items.length - 1 ? 0 : (gap ?? (density === 'comfortable' ? 3 : 2)),
                    bgcolor: marked ? 'action.selected' : undefined
                  }}
                >
                  {renderItem(item, { index: index - first, highlighted: marked })}
                </Box>
              );
            }}
          />
        </React.Suspense>
      )}
      {!bottom && items.length > 0 && (
        <ActionButton
          variant="contained"
          sx={{ position: 'absolute', bottom: (t) => t.spacing(2), insetInlineEnd: (t) => t.spacing(2) }}
          onClick={() => scrollToBottom()}
        >
          {jumpToLatestLabel}
          {unseenCount ? ' (' + unseenCount + ')' : ''}
        </ActionButton>
      )}
    </Box>
  );
}
