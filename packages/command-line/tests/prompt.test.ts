import { describe, expect, it, vi } from 'vitest';
import {
  Command,
  Option,
  PromptCancelledError,
  PromptUnavailableError,
  buildCli,
  defineMiddleware,
  describeCommand,
  runCli,
  scriptedPrompter,
  type CommandContext,
  type CommandResult,
  type Prompter,
  type RunnableCommand,
} from '../src/index.js';
import { captureIO } from './helpers/captureIO.js';
import { captureTerminal } from './helpers/captureTerminal.js';

/** A root command named `tool` whose run() hands its context to `body`. */
function tool(body: (context: CommandContext) => unknown) {
  @Command({ name: 'tool' })
  class Tool implements RunnableCommand {
    async run(context: CommandContext): Promise<CommandResult> {
      const result = await body(context);
      return typeof result === 'number' ? result : undefined;
    }
  }
  return Tool;
}

/** A prompter whose every method fails unless given in `methods`. */
function prompterWith(methods: Partial<Prompter>): Prompter {
  const unexpected = (kind: string) => () => Promise.reject(new Error(`unexpected ${kind} prompt`));
  return {
    confirm: unexpected('confirm'),
    text: unexpected('text'),
    secret: unexpected('secret'),
    editor: unexpected('editor'),
    select: unexpected('select'),
    multiselect: unexpected('multiselect'),
    ...methods,
  };
}

describe('context.prompt with a scripted prompter', () => {
  it('answers each kind of prompt and records what was asked', async () => {
    const prompter = scriptedPrompter([
      { confirm: true, message: 'Delete 3 stale branches?' },
      { text: 'main', message: /branch/i },
      { secret: 'sk-test' },
      { editor: '# Describe the change.\n\nfix: the thing\n\n' },
    ]);
    const seen: unknown[] = [];

    const Tool = tool(async ({ prompt }) => {
      seen.push(await prompt.confirm('Delete 3 stale branches?'));
      seen.push(await prompt.text('Which branch?'));
      seen.push(await prompt.secret('API key'));
      seen.push(await prompt.editor({ comment: '#' }));
    });

    const { io } = captureIO();
    await expect(runCli(Tool, [], { io, prompter })).resolves.toBe(0);

    expect(seen).toEqual([true, 'main', 'sk-test', 'fix: the thing']);
    expect(prompter.asked).toEqual([
      { kind: 'confirm', message: 'Delete 3 stale branches?' },
      { kind: 'text', message: 'Which branch?' },
      { kind: 'secret', message: 'API key' },
      { kind: 'editor', message: undefined },
    ]);
    expect(prompter.remaining).toBe(0);
  });

  it('uses a text default for an empty answer', async () => {
    const prompter = scriptedPrompter([{ text: '' }, { text: '' }]);

    await expect(prompter.text('Branch', { default: 'main' })).resolves.toBe('main');
    await expect(prompter.text('Note')).resolves.toBe('');
  });

  it('answers list prompts with their choices, several in the order of the choices', async () => {
    const prompter = scriptedPrompter([
      { select: 'eu-west-1', message: 'Region' },
      { multiselect: ['test', 'lint', 'test'] },
    ]);

    await expect(prompter.select('Region', { choices: ['us-east-1', 'eu-west-1'] })).resolves.toBe('eu-west-1');
    await expect(
      prompter.multiselect('Checks', { choices: [{ value: 'lint', label: 'Lint' }, 'test', 'build'] }),
    ).resolves.toEqual(['lint', 'test']);
    expect(prompter.asked).toEqual([
      { kind: 'select', message: 'Region' },
      { kind: 'multiselect', message: 'Checks' },
    ]);
  });

  it('rejects a list answer that is not one of the choices, or picks fewer than min', async () => {
    const prompter = scriptedPrompter([{ select: 'mars' }, { multiselect: ['lint', 'nope'] }, { multiselect: [] }]);

    await expect(prompter.select('Region', { choices: ['us-east-1'] })).rejects.toThrow(
      'scripted answer "mars" to "Region" is not one of its choices: us-east-1.',
    );
    await expect(prompter.multiselect('Checks', { choices: ['lint'] })).rejects.toThrow(
      'scripted answer "nope" to "Checks" is not one of its choices: lint.',
    );
    await expect(prompter.multiselect('Checks', { choices: ['lint'], min: 1 })).rejects.toThrow(
      'scripted answer to "Checks" picks 0 choices, fewer than its min of 1.',
    );
  });

  it('fails the run when answers are left unused, naming them and what was asked', async () => {
    const Tool = tool(async ({ prompt }) => {
      await prompt.text('Region');
    });
    const prompter = scriptedPrompter([{ text: 'eu-west-1' }, { secret: 'sk-1' }, { confirm: true, message: 'Save?' }]);

    const { io } = captureIO();
    await expect(runCli(Tool, [], { io, prompter })).rejects.toThrow(
      'scripted prompter has 2 answers left that were never asked for: secret, confirm "Save?". ' +
        'It was asked for text "Region".',
    );
  });

  it('names what ended a failed run alongside the unused answers', async () => {
    const failure = new Error('the server said no.');
    const Tool = tool(() => {
      throw failure;
    });
    const prompter = scriptedPrompter([{ select: 'eu-west-1', message: /region/i }]);

    const { io, stderr } = captureIO();
    const run = buildCli(Tool, { io, prompter }).run([]);
    await expect(run).rejects.toThrow(
      'scripted prompter has 1 answer left that was never asked for: select /region/i. It was asked nothing. ' +
        'The run exited with code 1: the server said no.',
    );
    await expect(run).rejects.toMatchObject({ cause: failure });
    expect(stderr()).toBe('error: the server said no.\n');
  });

  it('leaves runs with other prompters alone', async () => {
    const Tool = tool(() => undefined);

    const { io } = captureIO();
    await expect(runCli(Tool, [], { io, prompter: prompterWith({}) })).resolves.toBe(0);
  });

  it('fails the run where the conversation goes differently', async () => {
    const Tool = tool(async ({ prompt }) => {
      await prompt.text('Name');
    });

    const cases = [
      { answers: [{ confirm: true }], error: 'has a confirm answer next, but was asked text "Name"' },
      { answers: [{ text: 'x', message: 'Age' }], error: 'expected to be asked "Age", but was asked text "Name"' },
      { answers: [{ text: 'x', message: /age/ }], error: 'expected to be asked /age/, but was asked text "Name"' },
      { answers: [], error: 'has no answer left for text "Name"' },
    ];

    for (const { answers, error } of cases) {
      const { io, stderr } = captureIO();
      await expect(runCli(Tool, [], { io, prompter: scriptedPrompter(answers) })).resolves.toBe(1);
      expect(stderr()).toContain(error);
    }
  });

  it('rejects an answer validate rejects, leaving a secret out of the message', async () => {
    const prompter = scriptedPrompter([{ text: '' }, { secret: 'not-a-key' }]);
    const validate = (value: string) => value.startsWith('sk-') || 'keys start with sk-';

    await expect(prompter.text('Name', { validate: (value) => value !== '' })).rejects.toThrow(
      'scripted answer "" to "Name" was rejected: That answer is not valid.',
    );
    const rejected = prompter.secret('API key', { validate });
    await expect(rejected).rejects.toThrow('scripted answer to secret "API key" was rejected: keys start with sk-');
    await expect(rejected).rejects.not.toThrow('not-a-key');
  });

  it('cancels with { cancel: true }, ending the run with exit code 130', async () => {
    const Tool = tool(async ({ prompt, io }) => {
      await prompt.confirm('Go?');
      io.stdout('went\n');
    });

    const { io, stdout, stderr } = captureIO();
    await expect(runCli(Tool, [], { io, prompter: scriptedPrompter([{ cancel: true }]) })).resolves.toBe(130);
    expect(stdout()).toBe('');
    expect(stderr()).toBe('Cancelled.\n');
  });

  it('lets a command catch a cancelled prompt', async () => {
    const Tool = tool(async ({ prompt, io }) => {
      try {
        await prompt.secret('API key');
      } catch (error: unknown) {
        if (!(error instanceof PromptCancelledError)) throw error;
        io.stdout('skipped\n');
      }
    });

    const { io, stdout } = captureIO();
    await expect(runCli(Tool, [], { io, prompter: scriptedPrompter([{ cancel: true }]) })).resolves.toBe(0);
    expect(stdout()).toBe('skipped\n');
  });

  it('cancels an editor left empty, unless empty is allowed', async () => {
    const prompter = scriptedPrompter([{ editor: '# only comments\n' }, { editor: '\n\n' }]);

    await expect(prompter.editor({ comment: '#' })).rejects.toThrow(
      new PromptCancelledError('Cancelled: nothing was left in the editor.'),
    );
    await expect(prompter.editor({ allowEmpty: true })).resolves.toBe('');
  });

  it('keeps comment lines when no comment prefix is given, and trims blank lines around the text', async () => {
    const prompter = scriptedPrompter([{ editor: '\n\n  # kept\r\nsecond line  \n\n' }]);

    await expect(prompter.editor()).resolves.toBe('  # kept\nsecond line');
  });

  it('is available to middleware, which can ask before the command runs', async () => {
    const auth = defineMiddleware({
      name: 'auth',
      handle: async ({ prompt }, next) => next({ apiKey: await prompt.secret('API key') }),
    });

    @Command({ name: 'tool', use: [auth] })
    class Tool implements RunnableCommand {
      run({ io, apiKey }: CommandContext<object, { apiKey: string }>): void {
        io.stdout(`${apiKey.length}\n`);
      }
    }

    const { io, stdout } = captureIO();
    await expect(runCli(Tool, [], { io, prompter: scriptedPrompter([{ secret: 'sk-1234' }]) })).resolves.toBe(0);
    expect(stdout()).toBe('7\n');
  });

  it('cannot be replaced by a middleware', async () => {
    const shadow = defineMiddleware({
      name: 'shadow',
      handle: (_context, next) => next({ prompt: 'nope' } as never),
    });
    const Tool = tool(() => {});

    const { io, stderr } = captureIO();
    await expect(runCli(Tool, [], { io, use: [shadow] })).resolves.toBe(1);
    expect(stderr()).toContain('cannot provide "prompt": the command context already has it');
  });
});

describe('context.prompt without a terminal', () => {
  it('resolves to the defaults', async () => {
    const seen: unknown[] = [];
    const Tool = tool(async ({ prompt }) => {
      seen.push(await prompt.confirm('Go?', { default: false }));
      seen.push(await prompt.text('Branch', { default: 'main' }));
      seen.push(await prompt.editor({ default: 'a message' }));
      seen.push(await prompt.select('Region', { choices: ['us-east-1', 'eu-west-1'], default: 'eu-west-1' }));
      seen.push(await prompt.multiselect('Checks', { choices: ['lint', 'test', 'build'], default: ['test', 'lint'] }));
    });

    const { io } = captureIO();
    await expect(runCli(Tool, [], { io })).resolves.toBe(0);
    expect(seen).toEqual([false, 'main', 'a message', 'eu-west-1', ['lint', 'test']]);
  });

  it('fails a prompt without a default, naming the question', async () => {
    const cases: [(prompt: Prompter) => Promise<unknown>, string][] = [
      [(prompt) => prompt.confirm('Delete?'), 'cannot ask "Delete?": there is no terminal to ask on. Pass --yes to answer yes.'],
      [(prompt) => prompt.text('Name'), 'cannot ask "Name": there is no terminal to ask on.'],
      [(prompt) => prompt.secret('API key'), 'cannot ask "API key": there is no terminal to ask on.'],
      [(prompt) => prompt.editor(), 'cannot open an editor: there is no terminal to ask on.'],
      [(prompt) => prompt.select('Region', { choices: ['us-east-1'] }), 'cannot ask "Region": there is no terminal to ask on.'],
      [(prompt) => prompt.multiselect('Checks', { choices: ['lint'] }), 'cannot ask "Checks": there is no terminal to ask on.'],
    ];

    for (const [ask, message] of cases) {
      const { io, stderr } = captureIO();
      await expect(runCli(tool(({ prompt }) => ask(prompt)), [], { io })).resolves.toBe(1);
      expect(stderr()).toBe(`error: ${message}\n`);
    }
  });

  it('fails list prompts whose choices are a mistake, whether or not anyone could be asked', async () => {
    const cases: [(prompt: Prompter) => Promise<unknown>, string][] = [
      [(prompt) => prompt.select('Pick', { choices: [] }), 'select "Pick" has no choices to pick from.'],
      [(prompt) => prompt.select('Pick', { choices: ['a', { value: 'a' }] }), 'select "Pick" has the choice "a" more than once.'],
      [
        (prompt) => prompt.select<string>('Pick', { choices: ['a'], default: 'b' }),
        'select "Pick" has the default "b", which is not one of its choices.',
      ],
      [
        (prompt) => prompt.multiselect('Pick', { choices: ['a', 'b'], min: 3 }),
        'multiselect "Pick" has a min of 3; it must be a whole number from 0 to 2, the number of choices.',
      ],
      [
        (prompt) => prompt.multiselect('Pick', { choices: ['a', 'b'], default: ['a'], min: 2 }),
        'multiselect "Pick" has 1 default, fewer than its min of 2.',
      ],
    ];

    for (const [ask, message] of cases) {
      for (const prompter of [undefined, scriptedPrompter([])]) {
        const { io, stderr } = captureIO();
        const options = prompter === undefined ? { io } : { io, prompter };
        await expect(runCli(tool(({ prompt }) => ask(prompt)), [], options)).resolves.toBe(1);
        expect(stderr()).toBe(`error: ${message}\n`);
      }
    }
  });

  it('throws PromptUnavailableError, saying what and why', async () => {
    let caught: unknown;
    const Tool = tool(async ({ prompt }) => {
      caught = await prompt.secret('API key').catch((error: unknown) => error);
    });

    const { io } = captureIO();
    await runCli(Tool, [], { io });

    expect(caught).toBeInstanceOf(PromptUnavailableError);
    expect(caught).toMatchObject({ kind: 'secret', prompt: 'API key', reason: 'no-terminal' });
  });
});

describe('--yes and --no-input', () => {
  it('answers yes to confirmations without asking, with --yes or -y', async () => {
    for (const flag of ['--yes', '-y']) {
      const prompter = scriptedPrompter([]);
      let answer: boolean | undefined;
      const Tool = tool(async ({ prompt }) => {
        answer = await prompt.confirm('Delete?', { default: false });
      });

      const { io } = captureIO();
      await expect(runCli(Tool, [flag], { io, prompter })).resolves.toBe(0);
      expect(answer).toBe(true);
      expect(prompter.asked).toEqual([]);
    }
  });

  it('leaves other prompts to the prompter with --yes', async () => {
    let name: string | undefined;
    const Tool = tool(async ({ prompt }) => {
      name = await prompt.text('Name');
    });

    const { io } = captureIO();
    await runCli(Tool, ['--yes'], { io, prompter: scriptedPrompter([{ text: 'Ada' }]) });
    expect(name).toBe('Ada');
  });

  it('turns prompts off with --no-input, even with a prompter', async () => {
    const prompter = scriptedPrompter([]);
    const seen: unknown[] = [];
    const Tool = tool(async ({ prompt }) => {
      seen.push(await prompt.confirm('Go?', { default: false }));
      seen.push(await prompt.text('Name').catch((error: unknown) => error));
    });

    const { io } = captureIO();
    await expect(runCli(Tool, ['--no-input'], { io, prompter })).resolves.toBe(0);

    expect(prompter.asked).toEqual([]);
    expect(seen[0]).toBe(false);
    expect(seen[1]).toBeInstanceOf(PromptUnavailableError);
    expect((seen[1] as Error).message).toBe('cannot ask "Name": prompts are turned off.');
    expect(seen[1]).toMatchObject({ reason: 'disabled' });
  });

  it('turns prompts off with the <NAME>_NO_INPUT environment variable', async () => {
    const prompter = scriptedPrompter([]);
    let answer: boolean | undefined;
    const Tool = tool(async ({ prompt }) => {
      answer = await prompt.confirm('Go?', { default: false });
    });

    vi.stubEnv('TOOL_NO_INPUT', '1');
    const { io } = captureIO();
    await runCli(Tool, [], { io, prompter });

    expect(answer).toBe(false);
    expect(prompter.asked).toEqual([]);
  });

  it('lives on the root but is accepted after a subcommand too', async () => {
    let answer: boolean | undefined;

    @Command()
    class Child implements RunnableCommand {
      async run({ prompt }: CommandContext): Promise<void> {
        answer = await prompt.confirm('Go?');
      }
    }
    @Command({ commands: [Child] })
    class Root {}

    expect(describeCommand(Root).commands[0]?.prompts).toBeUndefined();

    const { io } = captureIO();
    await expect(runCli(Root, ['child', '-y'], { io })).resolves.toBe(0);
    expect(answer).toBe(true);
  });

  it('logs answers it gave without asking at debug level', async () => {
    const Tool = tool(async ({ prompt }) => {
      await prompt.confirm('Delete?');
      await prompt.text('Branch', { default: 'main' });
    });

    const { io, stderr } = captureIO();
    await runCli(Tool, ['--yes', '-l', 'debug'], { io });

    expect(stderr()).toBe(
      '[debug] answered yes to "Delete?" (--yes)\n' +
        '[debug] using the default for "Branch": there is no terminal to ask on\n',
    );
  });

  it('are listed in help after the log level option, with the environment variable', async () => {
    const { io, stdout } = captureIO();
    await runCli(tool(() => {}), ['--help'], { io });

    const help = stdout();
    expect(help).toMatch(/-y, --yes\s+answer yes to every confirmation/);
    expect(help).toMatch(/--no-input\s+never prompt: use defaults, or fail where there are\s+none \(env: TOOL_NO_INPUT\)/);
    expect(help.indexOf('--log-level')).toBeLessThan(help.indexOf('--yes'));
    expect(help.indexOf('--no-input')).toBeLessThan(help.indexOf('--help'));
  });

  it('are described on the root definition', () => {
    expect(describeCommand(tool(() => {})).prompts).toEqual({
      yes: '-y, --yes',
      noInput: '--no-input',
      noInputEnv: 'TOOL_NO_INPUT',
      editorEnv: 'TOOL_EDITOR',
    });
  });
});

describe('@Command({ prompts })', () => {
  it('takes other flags and environment variable names', async () => {
    @Command({
      name: 'tool',
      prompts: { yes: '--assume-yes', noInput: '--non-interactive', noInputEnv: 'TOOL_BATCH', editorEnv: 'TOOL_VISUAL' },
    })
    class Tool implements RunnableCommand {
      async run({ prompt, io }: CommandContext): Promise<void> {
        io.stdout(`${String(await prompt.confirm('Go?', { default: false }))}\n`);
      }
    }

    expect(describeCommand(Tool).prompts).toEqual({
      yes: '--assume-yes',
      noInput: '--non-interactive',
      noInputEnv: 'TOOL_BATCH',
      editorEnv: 'TOOL_VISUAL',
    });

    // Only the run without either flag gets as far as asking.
    const runs = [
      { argv: ['--assume-yes'], answers: [], out: 'true\n' },
      { argv: ['--non-interactive'], answers: [], out: 'false\n' },
      { argv: [], answers: [{ confirm: true }], out: 'true\n' },
    ];
    for (const { argv, answers, out } of runs) {
      const { io, stdout } = captureIO();
      await runCli(Tool, argv, { io, prompter: scriptedPrompter(answers) });
      expect(stdout()).toBe(out);
    }
  });

  it('removes the options and environment variables with prompts: false', async () => {
    @Command({ name: 'tool', prompts: false })
    class Tool implements RunnableCommand {
      async run({ prompt }: CommandContext): Promise<void> {
        await prompt.confirm('Go?', { default: true });
      }
    }

    expect(describeCommand(Tool).prompts).toEqual({
      yes: undefined,
      noInput: undefined,
      noInputEnv: undefined,
      editorEnv: undefined,
    });

    const { io, stdout, stderr } = captureIO();
    await runCli(Tool, ['--help'], { io });
    expect(stdout()).not.toContain('--yes');
    expect(stdout()).not.toContain('--no-input');

    await expect(runCli(Tool, ['--yes'], { io })).resolves.toBe(1);
    expect(stderr()).toContain("unknown option '--yes'");
  });

  it('suggests no flag when a confirmation fails without the yes option', async () => {
    @Command({ name: 'tool', prompts: { yes: false } })
    class Tool implements RunnableCommand {
      async run({ prompt }: CommandContext): Promise<void> {
        await prompt.confirm('Go?');
      }
    }

    const { io, stderr } = captureIO();
    await runCli(Tool, [], { io });
    expect(stderr()).toBe('error: cannot ask "Go?": there is no terminal to ask on.\n');
  });

  it('can only be set on the root', () => {
    @Command({ prompts: false })
    class Child implements RunnableCommand {
      run(): void {}
    }
    @Command({ commands: [Child] })
    class Root {}

    expect(() => describeCommand(Root)).toThrow('Child: "prompts" can only be set on the root command.');
  });

  it('rejects flags that take a value, and an environment variable without its option', () => {
    @Command({ prompts: { yes: '--yes <answer>' } })
    class Valued implements RunnableCommand {
      run(): void {}
    }
    @Command({ prompts: { noInput: false, noInputEnv: 'X' } })
    class Orphaned implements RunnableCommand {
      run(): void {}
    }

    expect(() => describeCommand(Valued)).toThrow('prompts.yes must be flags without a value, like "-y, --yes", not "--yes <answer>".');
    expect(() => describeCommand(Orphaned)).toThrow('prompts.noInputEnv needs the no-input option');
  });

  it('rejects a root option that clashes with the built-in options', () => {
    @Command()
    class Short implements RunnableCommand {
      @Option.string({ short: 'y' })
      year: string | undefined;

      run(): void {}
    }
    @Command()
    class Input implements RunnableCommand {
      @Option.string()
      input: string | undefined;

      run(): void {}
    }

    expect(() => describeCommand(Short)).toThrow(
      'Short: option "year" uses -y, which the built-in yes option already uses; set prompts.yes: false or change the flags of one of them.',
    );
    expect(() => describeCommand(Input)).toThrow(
      'Input: option "input" (--input <input>) would be stored as "input", like the built-in no-input option (--no-input); ' +
        'set prompts.noInput: false or change the flags of one of them.',
    );
  });

  it('rejects a middleware flag that clashes with the built-in options', () => {
    const answers = defineMiddleware({
      name: 'answers',
      options: { yes: { type: 'boolean' } },
      handle: (_context, next) => next(),
    });

    @Command({ use: [answers] })
    class Root implements RunnableCommand {
      run(): void {}
    }

    expect(() => buildCli(Root)).toThrow('which the built-in yes option (-y, --yes) already uses');
  });
});

describe('prompting while a live line is shown', () => {
  it('takes the line off the screen and holds other output until the answer', async () => {
    const terminal = captureTerminal();
    let shownWhileAsking: string | undefined;
    let asked!: () => void;
    const whenAsked = new Promise<void>((resolve) => (asked = resolve));
    let answer!: (value: boolean) => void;
    const answered = new Promise<boolean>((resolve) => (answer = resolve));

    const prompter = prompterWith({
      confirm: () => {
        shownWhileAsking = terminal.screen();
        asked();
        return answered;
      },
    });

    const Tool = tool(async ({ liveLine, logger, prompt }) => {
      liveLine('Working');
      const confirmed = prompt.confirm('Go?');
      await whenAsked;
      logger.info('meanwhile');
      expect(terminal.screen()).toBe('');
      answer(true);
      await confirmed;
    });

    await expect(runCli(Tool, [], { io: terminal.io, prompter })).resolves.toBe(0);
    expect(shownWhileAsking).toBe('');
    expect(terminal.screen()).toBe('[info] meanwhile\nWorking\n');
  });

  it('asks one prompt at a time', async () => {
    const events: string[] = [];
    const prompter = prompterWith({
      text: async (message) => {
        events.push(`ask ${message}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(`answer ${message}`);
        return message;
      },
    });

    const Tool = tool(async ({ prompt }) => {
      await Promise.all([prompt.text('one'), prompt.text('two')]);
    });

    const { io } = captureIO();
    await runCli(Tool, [], { io, prompter });
    expect(events).toEqual(['ask one', 'answer one', 'ask two', 'answer two']);
  });
});
