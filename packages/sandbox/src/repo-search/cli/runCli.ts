import { parseArgs } from 'node:util';
import { LocalRepoSearch } from '../core/repoSearch.js';
import { RepoSearchError } from '../errors.js';
import type { QuerySearchMethod, SearchResult } from '../types.js';

/** Where the CLI writes; defaults to the process streams. */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

type CliAction = QuerySearchMethod | 'hybrid' | 'stats' | 'help';

interface CommandSpec {
  readonly names: readonly string[];
  readonly action: CliAction;
  readonly description: string;
}

/** Every command and alias; drives both dispatch and the help text. */
const COMMANDS: readonly CommandSpec[] = [
  {
    names: ['search', 'hybrid'],
    action: 'hybrid',
    description: 'Hybrid retrieval across exact, lexical, vector-like, path, symbol, deps',
  },
  { names: ['text', 'grep'], action: 'text', description: 'Literal text search' },
  { names: ['regex'], action: 'regex', description: 'Regular expression search' },
  { names: ['path', 'files'], action: 'path', description: 'Fuzzy path search' },
  { names: ['bm25'], action: 'bm25', description: 'BM25 lexical ranking' },
  { names: ['similar', 'similarity'], action: 'similarity', description: 'Local TF-IDF cosine similarity' },
  { names: ['symbol', 'symbols'], action: 'symbol', description: 'Symbol search' },
  { names: ['deps', 'dependency'], action: 'dependency', description: 'Import/dependency search' },
  { names: ['stats'], action: 'stats', description: 'Print index stats as JSON' },
  { names: ['help'], action: 'help', description: 'Show this help' },
];

const ACTION_BY_NAME: ReadonlyMap<string, CliAction> = new Map(
  COMMANDS.flatMap((command) => command.names.map((name) => [name, command.action] as const)),
);

const CLI_DEFAULTS = { maxResults: 20, context: 2 } as const;

const OPTIONS = {
  root: { type: 'string', short: 'r' },
  max: { type: 'string', short: 'n' },
  context: { type: 'string', short: 'C' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

const PROCESS_IO: CliIo = {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
};

/** Invalid command-line usage (exit code 2). */
class CliUsageError extends RepoSearchError {}

interface Invocation {
  action: CliAction;
  query: string;
  root: string;
  json: boolean;
  maxResults: number;
  context: number;
}

/**
 * Runs the `repo-search` command line and returns its exit code: 0 on success, 1 when the search fails, and 2
 * for invalid usage.
 */
export async function runCli(argv: readonly string[], io: CliIo = PROCESS_IO): Promise<number> {
  let invocation: Invocation;
  try {
    invocation = parseInvocation(argv);
  } catch (error) {
    io.stderr(`${errorMessage(error)}\n\n${usage()}`);
    return 2;
  }
  if (invocation.action === 'help') {
    io.stdout(usage());
    return 0;
  }

  try {
    const repo = await LocalRepoSearch.create({ root: invocation.root });
    if (invocation.action === 'stats') {
      io.stdout(toJson(repo.stats));
      return 0;
    }
    const results = await repo.search(invocation.action, invocation.query, {
      maxResults: invocation.maxResults,
      contextBefore: invocation.context,
      contextAfter: invocation.context,
    });
    io.stdout(invocation.json ? toJson(results) : formatResults(results));
    return 0;
  } catch (error) {
    io.stderr(`${errorMessage(error)}\n`);
    return 1;
  }
}

function parseInvocation(argv: readonly string[]): Invocation {
  const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true });
  const [command = 'help', ...queryParts] = positionals;
  const action = values.help ? 'help' : ACTION_BY_NAME.get(command);
  if (!action) throw new CliUsageError(`Unknown command: ${command}`);
  const query = queryParts.join(' ');
  if (!query && action !== 'help' && action !== 'stats') throw new CliUsageError(`Missing query for "${command}"`);
  return {
    action,
    query,
    root: values.root ?? process.cwd(),
    json: values.json ?? false,
    maxResults: parseCount(values.max, '--max', 1) ?? CLI_DEFAULTS.maxResults,
    context: parseCount(values.context, '--context', 0) ?? CLI_DEFAULTS.context,
  };
}

function parseCount(value: string | undefined, flag: string, min: number): number | undefined {
  if (value === undefined) return undefined;
  const count = Number(value);
  if (!Number.isInteger(count) || count < min) {
    throw new CliUsageError(`${flag} must be an integer of at least ${min}, got "${value}"`);
  }
  return count;
}

/** Human-readable results: location, method, score, and preview with context. */
export function formatResults(results: readonly SearchResult[]): string {
  if (results.length === 0) return 'No results.\n';
  return results
    .map((result) => {
      const location = result.column
        ? `${result.path}:${result.line}:${result.column}`
        : `${result.path}:${result.line}`;
      const channels = result.channels?.length ? ` [${result.channels.join(',')}]` : '';
      const lines = [
        `${location}  ${result.method}  score=${result.score.toFixed(4)}${channels}`,
        ...result.contextBefore.map((line) => `  ${line}`),
        `> ${result.preview.replace(/\n/g, '\n> ')}`,
        ...result.contextAfter.map((line) => `  ${line}`),
      ];
      return `\n${lines.join('\n')}\n`;
    })
    .join('');
}

function usage(): string {
  const width = Math.max(...COMMANDS.map((command) => command.names.join('|').length)) + 2;
  const commands = COMMANDS.map((command) => `  ${command.names.join('|').padEnd(width)}${command.description}`);
  return [
    'repo-search <command> <query> [options]',
    '',
    'Commands:',
    ...commands,
    '',
    'Options:',
    '  --root, -r <dir>    Local repository/directory root (default: cwd)',
    `  --max, -n <count>   Maximum results (default: ${CLI_DEFAULTS.maxResults})`,
    `  --context, -C <n>   Context lines for line-anchored results (default: ${CLI_DEFAULTS.context})`,
    '  --json              Emit JSON',
    '  --help, -h          Show this help',
    '',
    'Put "--" before a query that starts with "-".',
    '',
  ].join('\n');
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
