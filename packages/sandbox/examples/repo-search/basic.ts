import { ChildProcessCommandExecutor, LocalRepoSearch, type CommandExecutor } from '../../src/repo-search/index.js';

const root = process.argv[2] ?? process.cwd();
const query = process.argv.slice(3).join(' ') || 'permission validation';

// Optional: every `git` / `rg` invocation goes through one executor. This one logs each command.
const local = new ChildProcessCommandExecutor();
const executor: CommandExecutor = {
  run: (binary, args, options) => {
    console.error(`$ ${binary} ${args.join(' ')}`);
    return local.run(binary, args, options);
  },
};

const repo = await LocalRepoSearch.create({ root, executor });
console.log('Index stats:', repo.stats);

const results = await repo.hybridSearch(query, { maxResults: 5 });

for (const result of results) {
  console.log('\n---');
  console.log(
    `${result.path}:${result.line} score=${result.score.toFixed(4)} channels=${result.channels?.join(',') ?? result.method}`,
  );
  const opened = await repo.openFile(result.path, {
    line: result.line,
    endLine: result.endLine,
    contextBefore: 3,
    contextAfter: 3,
  });
  console.log(opened.numberedText);
}
