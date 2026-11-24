import * as React from 'react';
import { Box, Paper } from '@mui/material';
import { useHighlighter, codeColors } from './highlight';
import { CopyButton } from '../CopyButton';
import { ActionButton } from '../ActionButton';
import { ScrollArea } from '../ScrollArea';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { styles, type SurfaceProps } from '../../internal/presentation';
import { themeMonospace } from '../../theme/category';
import { useControllableValue } from '../../internal/useControllableValue';
export type TokenKind = 'comment' | 'keyword' | 'string' | 'number';
export type HighlightTokens = readonly { text: string; kind?: TokenKind }[];
export interface InlineCodeProps extends Omit<SurfaceProps, 'ref'> {
  ref?: React.Ref<HTMLElement>;
}
export function InlineCode({ children, density, sx, ...props }: InlineCodeProps) {
  return (
    <Text
      as="code"
      variant="code"
      {...props}
      sx={styles(
        {
          bgcolor: 'action.hover',
          borderRadius: 0.5,
          px: density === 'comfortable' ? 1 : 0.5,
          overflowWrap: 'anywhere'
        },
        sx
      )}
    >
      {children}
    </Text>
  );
}
export interface CodeBlockProps extends Omit<SurfaceProps, 'children' | 'wrap'> {
  code: string;
  language?: string;
  title?: React.ReactNode;
  showLineNumbers?: boolean;
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  highlightLines?: readonly number[];
  maxHeight?: number | string;
  collapsedLines?: number;
  copyable?: boolean;
  actions?: React.ReactNode;
  highlight?: (code: string, language: string) => HighlightTokens;
  streaming?: boolean;
}
const CodeLine = React.memo(function CodeLine({
  number,
  digits,
  marked,
  children
}: {
  number?: number;
  digits: number;
  marked: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="span"
      sx={{ display: 'block', minHeight: '1lh', bgcolor: marked ? 'action.selected' : undefined }}
    >
      {number !== undefined && (
        <Box
          component="span"
          aria-hidden
          sx={{
            display: 'inline-block',
            minWidth: digits + 'ch',
            paddingInlineEnd: (t) => t.spacing(1),
            color: 'text.secondary',
            userSelect: 'none'
          }}
        >
          {number}{' '}
        </Box>
      )}
      {children}
    </Box>
  );
});
export function CodeBlock({
  code,
  language,
  title,
  showLineNumbers,
  wrap,
  defaultWrap = false,
  onWrapChange,
  highlightLines,
  maxHeight = 400,
  collapsedLines,
  copyable = true,
  actions,
  highlight,
  streaming,
  density,
  sx,
  ...props
}: CodeBlockProps) {
  const [wrapped, setWrap] = useControllableValue(wrap, defaultWrap),
    [expanded, setExpanded] = React.useState(false);
  const highlightCode = useHighlighter(streaming && !highlight ? '' : language, highlight);
  const lines = React.useMemo(() => highlightCode(code), [highlightCode, code]);
  const limit = collapsedLines == null ? lines.length : Math.max(1, collapsedLines);
  const marks = new Set(highlightLines);
  return (
    <Paper {...props} variant="outlined" sx={styles({ minWidth: 0, overflow: 'hidden' }, sx)}>
      <Stack
        direction="row"
        align="center"
        wrap
        gap={1}
        sx={{ p: density === 'comfortable' ? 2 : 1, bgcolor: 'action.hover' }}
      >
        <Text variant="caption" sx={{ flex: 1 }}>
          {title ?? language ?? 'Code'}
        </Text>
        {actions}
        <ActionButton
          color="inherit"
          aria-pressed={wrapped}
          onClick={() => {
            setWrap(!wrapped);
            onWrapChange?.(!wrapped);
          }}
        >
          Wrap
        </ActionButton>
        {copyable && <CopyButton value={code} aria-label="Copy code" />}
      </Stack>
      <ScrollArea
        axis={wrapped ? 'y' : 'both'}
        aria-label={props['aria-label'] ?? (typeof title === 'string' ? title : 'Code')}
        tabIndex={0}
        maxHeight={maxHeight}
      >
        <Box
          component="pre"
          sx={(t) => ({
            m: 0,
            p: density === 'comfortable' ? 3 : 2,
            tabSize: 2,
            typography: 'body2',
            fontFamily: themeMonospace(t),
            whiteSpace: wrapped ? 'pre-wrap' : 'pre',
            overflowWrap: wrapped ? 'anywhere' : undefined,
            ...codeColors(t)
          })}
        >
          <code>
            {(expanded ? lines : lines.slice(0, limit)).map((line, i) => (
              <CodeLine
                key={i}
                number={showLineNumbers ? i + 1 : undefined}
                digits={String(lines.length).length}
                marked={marks.has(i + 1)}
              >
                {line}
              </CodeLine>
            ))}
          </code>
        </Box>
      </ScrollArea>
      {limit < lines.length && (
        <ActionButton aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer lines' : 'Show all ' + lines.length + ' lines'}
        </ActionButton>
      )}
    </Paper>
  );
}
