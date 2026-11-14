import { Argument, CliCommand, Command, Option, type CommandContext } from '../../src/index.js';

/**
 * The agent-engineer CLI (packages/agent-engineer) rebuilt on the CLI system.
 * Every declaration lives on the classes; nothing here touches commander.
 *
 * The root reads its version from the nearest package.json. Because this
 * example lives inside the command-line package, that is the library's own
 * package.json, so the name and description are given explicitly; a real CLI
 * package leaves them to its package.json and `bin` too.
 *
 * Nothing declares a log level, prompt options or an output format: every
 * root gets `-l, --log-level <level>` and an `AGENT_ENGINEER_LOG_LEVEL`
 * variable, `-y, --yes` and `--no-input`, and every command extending
 * CliCommand gets `-f, --format` and `render()`.
 */

@Command({ description: 'Print CLI and runtime information.' })
export class InfoCommand extends CliCommand<AgentEngineer> {
  run({ io, cli, logger }: CommandContext<AgentEngineer>): void {
    logger.debug(`rendering info as ${this.format}`);

    io.stdout(this.render(this.runtimeInfo(cli)));
  }
}

@Command({ description: 'Greet someone, to show arguments and typed options.' })
export class GreetCommand extends CliCommand<AgentEngineer> {
  @Argument.string({ description: 'who to greet' })
  name!: string;

  @Option.number({ short: 'n', default: 1, integer: true, min: 1, description: 'how many times' })
  times!: number;

  @Option.boolean({ description: 'greet in upper case' })
  loud?: boolean;

  run({ io }: CommandContext<AgentEngineer>): void {
    const greeting = `Hello, ${this.name}!\n`;
    io.stdout((this.loud === true ? greeting.toUpperCase() : greeting).repeat(this.times));
  }
}

/** Where configure can point the CLI. */
const REGIONS = [
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
] as const;

@Command({ description: 'Ask for settings, to show the select, multiselect, secret and confirm prompts.' })
export class ConfigureCommand extends CliCommand<AgentEngineer> {
  @Option.string({ env: 'AGENT_ENGINEER_API_KEY', description: 'API key; asked for when not given' })
  apiKey?: string;

  async run({ io, prompt }: CommandContext<AgentEngineer>): Promise<number | undefined> {
    const region = await prompt.select('Region', { choices: REGIONS, default: 'us-east-1' });
    const services = await prompt.multiselect('Services to enable', {
      choices: ['api', 'worker', 'scheduler'],
      default: ['api'],
      min: 1,
    });
    const apiKey =
      this.apiKey ?? (await prompt.secret('API key', { validate: (key) => key.trim() !== '' || 'An API key is needed.' }));

    // --yes answers this without asking; without a terminal it takes the default.
    if (!(await prompt.confirm(`Save settings for ${region}?`, { default: true }))) return 1;

    io.stdout(this.render({ region, services: services.join(', '), apiKey: `…${apiKey.slice(-4)}` }));
    return undefined;
  }
}

@Command({ description: 'Write a note in your editor, to show the editor prompt.' })
export class NoteCommand extends CliCommand<AgentEngineer> {
  async run({ io, prompt }: CommandContext<AgentEngineer>): Promise<void> {
    // Opens $VISUAL or $EDITOR (vi by default), like git commit.
    const note = await prompt.editor({
      initial: '\n# Write your note above. Lines starting with # are removed,\n# and an empty note cancels.\n',
      extension: 'md',
      comment: '#',
    });

    io.stdout(this.render({ note }));
  }
}

@Command({
  name: 'agent-engineer',
  description: 'Agent Engineer command-line interface.',
  package: import.meta.url,
  commands: [InfoCommand, GreetCommand, ConfigureCommand, NoteCommand],
})
export class AgentEngineer {}
