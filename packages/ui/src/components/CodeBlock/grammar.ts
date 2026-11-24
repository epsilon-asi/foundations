import type { HighlightTokens, TokenKind } from './CodeBlock';
// Small local lexical grammars. Each match consumes source text verbatim.
const script =
  /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\\n])*"?|'(?:\\[\s\S]|[^'\\\n])*'?|\b(?:const|let|var|function|return|import|export|from|if|else|type|interface|class|async|await|true|false|null|new|throw)\b|\b\d+(?:\.\d+)?\b/g;
const shell =
  /#[^\n]*|"(?:\\[\s\S]|[^"\\\n])*"?|'[^'\n]*'?|\b(?:if|then|fi|else|for|while|do|done|def|return|import|class|True|False|None)\b|\b\d+(?:\.\d+)?\b/g;
export const languages = [
  'js',
  'jsx',
  'javascript',
  'ts',
  'tsx',
  'typescript',
  'json',
  'bash',
  'sh',
  'shell',
  'py',
  'python'
];
export function tokenize(code: string, language: string): HighlightTokens {
  const grammar = languages.indexOf(language) < 7 ? script : shell;
  const result: HighlightTokens[number][] = [];
  let end = 0;
  for (const match of code.matchAll(grammar)) {
    const start = match.index!,
      value = match[0],
      first = value[0];
    if (start > end) result.push({ text: code.slice(end, start) });
    const kind: TokenKind =
      first === '/' || first === '#'
        ? 'comment'
        : first === '"' || first === "'"
          ? 'string'
          : /\d/.test(first)
            ? 'number'
            : 'keyword';
    result.push({ text: value, kind });
    end = start + value.length;
  }
  if (end < code.length) result.push({ text: code.slice(end) });
  return result;
}
