import * as React from 'react';
import { Box } from '@mui/material';
import { ScrollArea, type ScrollAreaHandle } from '../ScrollArea';
import { Stack } from '../Stack';
import { CopyButton } from '../CopyButton';
import { Text } from '../Text';
import { monospaceFamily } from '../../theme/category';
import { appendLog, emptyLog, type LogLine, type LogState } from './lines';
import { type SurfaceProps } from '../../internal/presentation';
type Source = { text?: string; chunks?: never } | { text?: never; chunks: readonly string[] };
export type OutputLogProps = Omit<SurfaceProps, 'children' | 'wrap'> &
  Source & {
    'aria-label': string;
    follow?: boolean;
    ansi?: boolean;
    wrap?: boolean;
    maxLines?: number;
    maxHeight?: number | string;
    copyable?: boolean;
    footer?: React.ReactNode;
    emptyLabel?: React.ReactNode;
  };
const light = [
  '#242424',
  '#982222',
  '#286033',
  '#705416',
  '#264995',
  '#803677',
  '#12616c',
  '#565656',
  '#4e4e4e',
  '#a32136',
  '#176e2d',
  '#795600',
  '#2c57a5',
  '#913180',
  '#006573',
  '#595959'
];
const dark = [
  '#bbbfc8',
  '#f3a0a0',
  '#92cda0',
  '#ddc279',
  '#a1baff',
  '#ddb0d9',
  '#91cdd6',
  '#d6d6d6',
  '#c1c1c1',
  '#ffada9',
  '#a6e19c',
  '#f3d888',
  '#b4caff',
  '#ffb9ec',
  '#a8e9ee',
  '#fafafa'
];
const Line = React.memo(function Line({ line }: { line: LogLine }) {
  return (
    <div>
      {line.runs.length
        ? line.runs.map((run, i) =>
            run.color === undefined ? (
              run.text
            ) : (
              <Box
                component="span"
                key={i}
                sx={(t) => ({ color: light[run.color!], ...t.applyStyles('dark', { color: dark[run.color!] }) })}
              >
                {run.text}
              </Box>
            )
          )
        : '\u200b'}
    </div>
  );
});
export function OutputLog({
  text = '',
  chunks,
  ansi = true,
  follow = true,
  wrap,
  maxLines = Infinity,
  maxHeight = 360,
  copyable,
  footer,
  emptyLabel = 'No output',
  'aria-label': label,
  sx,
  density,
  ...props
}: OutputLogProps) {
  const cache = React.useRef<{
    text: string;
    chunks?: readonly string[];
    result: LogState;
    ansi: boolean;
    limit: number;
  }>(undefined);
  const limit = Math.max(1, Math.floor(maxLines) || 1);
  const result = React.useMemo(() => {
    const old = cache.current;
    const same = old && old.ansi === ansi && old.limit === limit;
    if (
      same &&
      chunks &&
      old.chunks &&
      chunks.length >= old.chunks.length &&
      old.chunks.every((p, i) => p === chunks[i])
    )
      return appendLog(old.result, chunks.slice(old.chunks.length), ansi, limit);
    if (same && !chunks && !old.chunks && text.startsWith(old.text))
      return appendLog(old.result, [text.slice(old.text.length)], ansi, limit);
    return appendLog(emptyLog(), chunks ?? [text], ansi, limit);
  }, [text, chunks, ansi, limit]);
  const scroll = React.useRef<ScrollAreaHandle>(null),
    pinned = React.useRef(true);
  React.useLayoutEffect(() => {
    cache.current = { text, chunks, result, ansi, limit };
    if (follow && pinned.current) scroll.current?.scrollToBottom();
  }, [result, follow]);
  return (
    <Stack {...props} density={density} sx={sx}>
      {copyable && (
        <CopyButton
          aria-label="Copy output"
          value={result.lines.map((l) => l.runs.map((r) => r.text).join('')).join('\n')}
        />
      )}
      <ScrollArea
        ref={scroll}
        aria-label={label}
        role="log"
        aria-live={props['aria-live'] ?? 'off'}
        axis={wrap ? 'y' : 'both'}
        maxHeight={maxHeight}
        onScroll={() => {
          pinned.current = scroll.current?.isAtBottom() ?? true;
        }}
        sx={{
          p: density === 'comfortable' ? 3 : 2,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider'
        }}
      >
        {result.hidden > 0 && <Text variant="caption">{result.hidden} earlier lines hidden</Text>}
        {result.lines.length === 1 && !result.lines[0].runs.length && !result.hidden ? (
          <Text>{emptyLabel}</Text>
        ) : (
          <Box
            sx={{
              whiteSpace: wrap ? 'pre-wrap' : 'pre',
              overflowWrap: 'anywhere',
              tabSize: 2,
              fontFamily: (t) => t.identity?.monospaceFamily ?? monospaceFamily,
              fontSize: '0.8125rem'
            }}
          >
            {result.lines.map((line) => (
              <Line key={line.id} line={line} />
            ))}
          </Box>
        )}
      </ScrollArea>
      {footer}
    </Stack>
  );
}
