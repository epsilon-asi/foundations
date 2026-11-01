import { LocalLspClient } from '../../src/repo-search/lsp/index.js';

const root = process.argv[2] ?? process.cwd();
const file = process.argv[3];

if (!file) {
  throw new Error('Usage: tsx examples/repo-search/local-lsp.ts <repo-root> <file>');
}

const lsp = new LocalLspClient({
  command: 'typescript-language-server',
  args: ['--stdio'],
  cwd: root,
});

try {
  await lsp.openDocument(file, 'typescript');
  const symbols = await lsp.documentSymbols(file);
  console.log(JSON.stringify(symbols, null, 2));
} finally {
  await lsp.shutdown();
}
