import * as React from 'react';
import MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import { Checkbox, Link, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { CodeBlock, InlineCode, type CodeBlockProps } from '../CodeBlock';
import { CompactTable } from '../../internal/CompactTable';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { Divider } from '../Divider';
import type { LinkRenderer } from '../../internal/links';
import { styles, type SurfaceProps } from '../../internal/presentation';

export interface MarkdownProps extends Omit<SurfaceProps, 'content' | 'children'> {
  content: string;
  streaming?: boolean;
  renderLink?: LinkRenderer;
  onLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
  allowedProtocols?: readonly string[];
  renderImage?: (image: { src: string; alt: string; title?: string }) => React.ReactNode;
  codeBlockProps?: Omit<CodeBlockProps, 'code' | 'language'>;
  headingLevelOffset?: number;
}
const parser = new MarkdownIt({ html: false, linkify: true }).disable('replacements');
// Let the parser identify eligible delimiters. Escaped marks, inline code,
// intraword underscores and completed links retain their CommonMark meaning.
parser.core.ruler.before('inline', 'streaming_tail', (state) => {
  if (!state.env.streaming || /\n\s*\n$/.test(state.src)) return;
  let index = state.tokens.length - 1;
  while (index >= 0 && state.tokens[index].nesting === -1) index--;
  const tail = state.tokens[index];
  if (tail?.type === 'inline') state.env.tailTokens = tail.children;
});
parser.inline.ruler2.after('balance_pairs', 'streaming_emphasis', (state) => {
  if (state.tokens !== state.env.tailTokens) return false;
  const unmatched = [];
  let pairedUntil = -1;
  for (const [index, mark] of state.delimiters.entries()) {
    if (mark.end !== -1) pairedUntil = Math.max(pairedUntil, mark.end);
    else if (index > pairedUntil && mark.open && !mark.close && (mark.marker === 42 || mark.marker === 95))
      unmatched.push(mark);
  }
  for (const mark of unmatched.reverse()) {
    const token = state.push('text', '', 0);
    token.content = String.fromCharCode(mark.marker);
    mark.end = state.delimiters.length;
    state.delimiters.push({ ...mark, token: state.tokens.length - 1, open: false, close: true, end: -1 });
  }
  return unmatched.length > 0;
});
const protocols = ['http', 'https', 'mailto'];
function safeUrl(value: string, allowed: readonly string[]) {
  try {
    const url = new URL(value);
    const scheme = url.protocol.slice(0, -1);
    if (
      !['javascript', 'data', 'vbscript', 'file', 'blob'].includes(scheme) &&
      allowed.some((p) => p.replace(/:$/, '').toLowerCase() === scheme)
    )
      return url.href;
  } catch {
    /* Relative URLs have no allowed protocol. */
  }
}
type Options = Pick<
  MarkdownProps,
  | 'renderLink'
  | 'renderImage'
  | 'onLinkClick'
  | 'codeBlockProps'
  | 'headingLevelOffset'
  | 'allowedProtocols'
  | 'density'
>;
function nodes(tokens: Token[], options: Options) {
  type Frame = { token: Token; children: React.ReactNode[] };
  const root: React.ReactNode[] = [],
    stack: Frame[] = [];
  const append = (node: React.ReactNode) => (stack.at(-1)?.children ?? root).push(node);
  function close(token: Token, children: React.ReactNode[], key: number) {
    if (token.hidden) return <React.Fragment key={key}>{children}</React.Fragment>;
    if (token.type === 'link_open') {
      const href = safeUrl(token.attrGet('href') ?? '', options.allowedProtocols ?? protocols);
      if (!href) return <React.Fragment key={key}>{children}</React.Fragment>;
      const props = {
        href,
        title: token.attrGet('title') ?? undefined,
        children,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => options.onLinkClick?.(href, e)
      };
      return (
        <React.Fragment key={key}>
          {options.renderLink ? options.renderLink(props) : <Link color="inherit" {...props} />}
        </React.Fragment>
      );
    }
    if (token.tag === 'table')
      return (
        <CompactTable key={key} aria-label="Markdown table" density={options.density} axis="x" focusable>
          {children}
        </CompactTable>
      );
    if (token.tag === 'td' || token.tag === 'th') {
      const align = token.attrGet('style')?.replace('text-align:', '');
      return (
        <TableCell
          key={key}
          align={align === 'left' || align === 'center' || align === 'right' ? align : undefined}
        >
          {children}
        </TableCell>
      );
    }
    if (token.tag === 'thead') return <TableHead key={key}>{children}</TableHead>;
    if (token.tag === 'tbody') return <TableBody key={key}>{children}</TableBody>;
    if (token.tag === 'tr') return <TableRow key={key}>{children}</TableRow>;
    if (token.tag === 'p')
      return (
        <Text key={key} as="p" variant="bodySmall">
          {children}
        </Text>
      );
    if (token.type === 'heading_open') {
      const level = Math.max(1, Math.min(6, Number(token.tag[1]) + (options.headingLevelOffset ?? 0)));
      return (
        <Text key={key} as={`h${level}` as React.ElementType} variant="subtitle" sx={{ fontWeight: 700 }}>
          {children}
        </Text>
      );
    }
    const attrs = token.tag === 'ol' ? { start: Number(token.attrGet('start') ?? 1) } : {};
    return React.createElement(token.tag, { key, ...attrs }, children);
  }
  for (const [key, t] of tokens.entries()) {
    if (t.nesting === 1) {
      stack.push({ token: t, children: [] });
      continue;
    }
    if (t.nesting === -1) {
      const f = stack.pop()!;
      append(close(f.token, f.children, key));
      continue;
    }
    switch (t.type) {
      case 'inline': {
        let inline = t.children ?? [];
        const first = inline[0];
        if (
          stack.at(-2)?.token.type === 'list_item_open' &&
          first?.type === 'text' &&
          /^\[([ xX])\]\s/.test(first.content)
        ) {
          append(
            <Checkbox
              key={'task' + key}
              size="small"
              sx={{ p: 0, verticalAlign: 'text-bottom' }}
              disabled
              checked={first.content[1] !== ' '}
              slotProps={{ input: { 'aria-label': 'Task' } }}
            />
          );
          inline = [
            Object.assign(Object.create(Object.getPrototypeOf(first)), first, { content: first.content.slice(4) }),
            ...inline.slice(1)
          ];
        }
        append(<React.Fragment key={key}>{nodes(inline, options)}</React.Fragment>);
        break;
      }
      case 'text':
        append(t.content);
        break;
      case 'softbreak':
        append('\n');
        break;
      case 'hardbreak':
        append(<br key={key} />);
        break;
      case 'hr':
        append(<Divider key={key} />);
        break;
      case 'code_inline':
        append(<InlineCode key={key}>{t.content}</InlineCode>);
        break;
      case 'fence':
      case 'code_block':
        append(
          <CodeBlock
            key={key}
            density={options.density}
            {...options.codeBlockProps}
            code={t.content.replace(/\n$/, '')}
            language={t.info.trim().split(/\s+/)[0]}
          />
        );
        break;
      case 'image': {
        const src = safeUrl(t.attrGet('src') ?? '', options.allowedProtocols ?? protocols);
        append(
          <React.Fragment key={key}>
            {src && options.renderImage
              ? options.renderImage({ src, alt: t.content, title: t.attrGet('title') ?? undefined })
              : t.content}
          </React.Fragment>
        );
        break;
      }
    }
  }
  return root;
}
const Block = React.memo(
  function Block({ tokens, options }: { tokens: Token[]; signature: string; options: Options }) {
    return <>{nodes(tokens, options)}</>;
  },
  (a, b) => a.signature === b.signature && a.options === b.options
);
export function Markdown({
  content,
  streaming,
  renderLink,
  renderImage,
  onLinkClick,
  allowedProtocols,
  codeBlockProps,
  headingLevelOffset,
  density,
  sx,
  ...props
}: MarkdownProps) {
  const options = React.useMemo(
    () => ({
      renderLink,
      renderImage,
      onLinkClick,
      allowedProtocols,
      codeBlockProps,
      headingLevelOffset,
      density
    }),
    [renderLink, renderImage, onLinkClick, allowedProtocols, codeBlockProps, headingLevelOffset, density]
  );
  const tailOptions = React.useMemo(
    () => ({ ...options, codeBlockProps: { streaming: true, ...codeBlockProps } }),
    [options, codeBlockProps]
  );
  const previous = React.useRef<{
    source: string;
    blocks: { tokens: Token[]; signature: string; offset: number }[];
  }>(undefined);
  const blocks = React.useMemo(() => {
    const old = previous.current;
    // A reference definition can change links anywhere in the document. In that
    // case reparse the document and let the token signature retain unaffected blocks.
    const append =
      streaming && old && content.startsWith(old.source) && !content.includes(']:') && !content.includes('\r');
    const offset = append ? (old.blocks.at(-1)?.offset ?? 0) : 0;
    const prefix = append ? old.blocks.slice(0, -1) : [];
    const tail = content.slice(offset),
      starts = [offset];
    for (let i = tail.indexOf('\n'); i >= 0; i = tail.indexOf('\n', i + 1)) starts.push(offset + i + 1);
    const groups: Token[][] = [];
    for (const token of parser.parse(tail, { streaming })) {
      if (token.level === 0 && token.nesting >= 0) groups.push([]);
      groups[groups.length - 1].push(token);
    }
    return prefix.concat(
      groups.map((tokens) => ({
        tokens,
        offset: starts[tokens[0].map?.[0] ?? 0],
        signature: JSON.stringify(tokens, (key, value) => (key === 'map' ? undefined : value))
      }))
    );
  }, [content, streaming]);
  React.useLayoutEffect(() => {
    previous.current = { source: content, blocks };
  }, [content, blocks]);
  return (
    <Stack
      {...props}
      density={density}
      sx={styles(
        {
          typography: 'body2',
          overflowWrap: 'anywhere',
          '& :is(blockquote,ul,ol)': { m: 0 },
          '& :is(ul,ol,blockquote)': { paddingInlineStart: (t) => t.spacing(4) },
          '& blockquote': { borderInlineStart: '2px solid', borderColor: 'divider' }
        },
        sx
      )}
    >
      {blocks.map((block, i) => (
        <Block
          key={i}
          {...block}
          options={
            streaming && i === blocks.length - 1 && block.tokens[0].type === 'fence' ? tailOptions : options
          }
        />
      ))}
    </Stack>
  );
}
