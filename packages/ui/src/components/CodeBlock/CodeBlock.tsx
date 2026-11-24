import * as React from 'react';
import { Box } from '@mui/material';
import { CopyButton } from '../CopyButton';
import { ActionButton } from '../ActionButton';
import { ScrollArea } from '../ScrollArea';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { styles, type SurfaceProps } from '../../internal/presentation';
import { monospaceFamily } from '../../theme/category';
import { useControllableValue } from '../../internal/useControllableValue';
export type TokenKind = 'comment' | 'keyword' | 'string' | 'number';
export type HighlightTokens = readonly { text: string; kind?: TokenKind }[];
export interface InlineCodeProps extends Omit<SurfaceProps, 'ref'> {
  ref?: React.Ref<HTMLElement>;
}
export function InlineCode({ children, density, sx, ...props }: InlineCodeProps) {
  return (
    <Box
      component="code"
      {...props}
      sx={styles(
        {
          fontFamily: (t) => t.identity?.monospaceFamily ?? monospaceFamily,
          bgcolor: 'action.hover',
          borderRadius: 0.5,
          px: density === 'comfortable' ? 1 : 0.5,
          overflowWrap: 'anywhere'
        },
        sx
      )}
    >
      {children}
    </Box>
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
type Grammar = typeof import('./grammar');
export function useHighlight(code: string, language = '', highlight?: CodeBlockProps['highlight']) {
  const [grammar, setGrammar] = React.useState<Grammar>();
  React.useEffect(() => {
    let active = true;
    if (language && !highlight)
      import('./grammar')
        .then((result) => {
          if (active) setGrammar(result);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [language, highlight]);
  return React.useMemo(() => {
    const lang = language.toLowerCase();
    const tokens =
      highlight?.(code, lang) ?? (grammar?.languages.includes(lang) ? grammar.tokenize(code, lang) : undefined);
    if (!tokens || tokens.map((t) => t.text).join('') !== code) return code.split('\n');
    const lines: React.ReactNode[][] = [[]];
    tokens.forEach((token, i) =>
      token.text.split('\n').forEach((part, n) => {
        if (n) lines.push([]);
        if (part)
          lines[lines.length - 1].push(
            token.kind ? (
              <span key={i} data-token={token.kind}>
                {part}
              </span>
            ) : (
              part
            )
          );
      })
    );
    return lines;
  }, [code, language, highlight, grammar]);
}
export const codeColors = {
  '& [data-token="keyword"]': { color: 'secondary.dark' },
  '& [data-token="comment"]': { color: 'text.secondary' },
  '& [data-token="string"]': { color: 'success.dark' },
  '& [data-token="number"]': { color: 'primary.dark' }
};
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
  const lines = useHighlight(code, streaming && !highlight ? '' : language, highlight);
  const limit = collapsedLines == null ? lines.length : Math.max(1, collapsedLines);
  const marks = new Set(highlightLines);
  return (
    <Box
      {...props}
      sx={styles({ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }, sx)}
    >
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
            fontFamily: t.identity?.monospaceFamily ?? monospaceFamily,
            whiteSpace: wrapped ? 'pre-wrap' : 'pre',
            overflowWrap: wrapped ? 'anywhere' : undefined,
            ...codeColors,
            ...t.applyStyles('dark', {
              '& [data-token="keyword"]': { color: 'secondary.light' },
              '& [data-token="string"]': { color: 'success.light' },
              '& [data-token="number"]': { color: 'primary.light' }
            })
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
    </Box>
  );
}
