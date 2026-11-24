import * as React from 'react';
import { Box } from '@mui/material';
import { Text, type TextProps } from '../Text';
export interface HighlightedTextProps extends Omit<TextProps, 'children'> {
  text: string;
  query?: string | readonly string[];
  ranges?: ReadonlyArray<readonly [number, number]>;
  caseSensitive?: boolean;
  snippet?: { maxLength: number; around?: 'first-match' };
}
export function HighlightedText({ text, query, ranges, caseSensitive, snippet, ...props }: HighlightedTextProps) {
  const parts = React.useMemo(() => {
    const hits: [number, number][] = [];
    if (ranges) {
      for (const [a, b] of ranges)
        if (Number.isInteger(a) && Number.isInteger(b) && b > a && b > 0 && a < text.length)
          hits.push([Math.max(0, a), Math.min(text.length, b)]);
    } else
      for (const q of typeof query === 'string' ? [query] : (query ?? [])) {
        if (!q) continue;
        const escaped = Array.from(q, (c) => '\\u{' + c.codePointAt(0)!.toString(16) + '}').join('');
        for (const m of text.matchAll(new RegExp(escaped, caseSensitive ? 'gu' : 'giu')))
          hits.push([m.index!, m.index! + m[0].length]);
      }
    hits.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const span of hits) {
      const last = merged.at(-1);
      if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
      else merged.push(span);
    }
    const length = Math.min(text.length, Math.max(0, snippet?.maxLength ?? text.length));
    const first = merged[0] ?? [0, 0];
    const start = Math.min(
      text.length - length,
      Math.max(0, first[0] - Math.max(0, Math.floor((length - first[1] + first[0]) / 2)))
    );
    const end = start + length;
    const nodes: React.ReactNode[] = start ? ['…'] : [];
    let cursor = start;
    for (const [a, b] of merged) {
      if (b <= start || a >= end) continue;
      const left = Math.max(start, a),
        right = Math.min(b, end);
      nodes.push(
        text.slice(cursor, left),
        <Box component="mark" key={left} sx={{ bgcolor: 'warning.light', color: '#101010' }}>
          {text.slice(left, right)}
        </Box>
      );
      cursor = right;
    }
    nodes.push(text.slice(cursor, end));
    if (end < text.length) nodes.push('…');
    return nodes;
  }, [text, query, ranges, caseSensitive, snippet?.maxLength]);
  return <Text {...props}>{parts}</Text>;
}
