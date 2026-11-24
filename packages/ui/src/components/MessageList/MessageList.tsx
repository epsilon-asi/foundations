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
  const [bottom, setBottom] = React.useState(true);
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
  const navigateTo = (key: string, align: 'start' | 'center' | 'end') => {
    navigation.current = { key, align };
    navigate();
  };
  const attachList = React.useCallback(
    (handle: VirtuosoHandle | null) => {
      list.current = handle;
      if (handle && navigation.current) requestAnimationFrame(navigate);
    },
    [navigate]
  );
  // Appending items is handled by followOutput. On a resize without an append,
  // use the previous measured height to tell a pinned reader from one reading history.
  const lastHeight = React.useRef(0);
  const followResize = (height: number) => {
    const previous = lastHeight.current;
    lastHeight.current = height;
    const el = viewport.current;
    // Measurements can arrive while the initial scroll or a keyed jump is pending.
    // Preserve the latest explicit destination through those virtualizer retries.
    if (navigation.current && height !== previous) {
      navigate();
      return;
    }
    if (!el || !previous || height <= previous || !followOutput) return;
    if (previous - el.clientHeight - el.scrollTop <= 2) {
      list.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  };
  React.useLayoutEffect(() => {
    if (followOutput === 'always') {
      navigation.current = undefined;
      list.current?.scrollToIndex({ index: 'LAST', align: 'end' });
    }
  }, [items, followOutput]);
  const releaseNavigation = () => {
    navigation.current = undefined;
  };
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
      navigateTo(key, options?.align ?? 'start');
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
            initialTopMostItemIndex={followOutput ? { index: 'LAST', align: 'end' } : 0}
            computeItemKey={(_, item) => getItemKey(item)}
            followOutput={
              followOutput === false
                ? false
                : (atEnd) => (followOutput === 'always' || (atEnd && !navigation.current) ? 'auto' : false)
            }
            scrollerRef={(el) => {
              viewport.current = el instanceof HTMLElement ? el : null;
            }}
            onWheelCapture={releaseNavigation}
            onTouchMoveCapture={releaseNavigation}
            onPointerDownCapture={releaseNavigation}
            atBottomStateChange={setBottom}
            totalListHeightChanged={followResize}
            startReached={() => {
              if (!loadingOlder) onReachTop?.();
            }}
            onKeyDown={(e) => {
              onKeyDown?.(e);
              if (e.defaultPrevented || e.target !== e.currentTarget) return;
              const el = viewport.current;
              if (!el) return;
              if (['Home', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
                releaseNavigation();
              }
              if (e.key === 'End') scrollToBottom();
              else if (e.key === 'Home') navigateTo(keys[0], 'start');
              else if (e.key === 'PageUp' || e.key === 'PageDown')
                list.current?.scrollBy({ top: (e.key === 'PageUp' ? -1 : 1) * el.clientHeight });
              else return;
              e.preventDefault();
            }}
            itemContent={(index, item) => {
              const marked = highlight !== undefined && getItemKey(item) === highlight;
              return (
                <Box
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
