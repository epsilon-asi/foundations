import * as React from 'react';
import type { SystemStyleObject } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import type { CodeBlockProps } from './CodeBlock';

type Grammar = typeof import('./grammar');
export function useHighlighter(language = '', highlight?: CodeBlockProps['highlight']) {
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
  return React.useCallback(
    (code: string) => {
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
    },
    [language, highlight, grammar]
  );
}
export function codeColors(theme: Theme): SystemStyleObject<Theme> {
  return {
    '& [data-token="comment"]': { color: 'text.secondary' },
    '& [data-token="keyword"]': { color: 'secondary.dark' },
    '& [data-token="string"]': { color: 'success.dark' },
    '& [data-token="number"]': { color: 'primary.dark' },
    ...theme.applyStyles('dark', {
      '& [data-token="keyword"]': { color: 'secondary.light' },
      '& [data-token="string"]': { color: 'success.light' },
      '& [data-token="number"]': { color: 'primary.light' }
    })
  };
}
