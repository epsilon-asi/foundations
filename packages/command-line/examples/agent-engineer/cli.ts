import { Argument, Command, Option, type CliCommand, type CommandContext } from '../../src/index.js';

/**
 * The agent-engineer CLI (packages/agent-engineer) rebuilt on the CLI system.
 * Every declaration lives on the classes; nothing here touches commander.
 *
 * The root reads its version from the nearest package.json. Because this
 * example lives inside the command-line package, that is the library's own
 * package.json, so the name and description are given explicitly; a real CLI
 * package leaves them to its package.json and `bin` too.
 *
 * Nothing declares a log level: every root gets `-l, --log-level <level>` and
 * an `AGENT_ENGINEER_LOG_LEVEL` variable, and every command gets a logger.
 */

export const OUTPUT_FORMATS = ['text', 'json'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface RuntimeInfo {
  readonly name: string;
  readonly version: string;
  readonly node: string;
  readonly platform: string;
}

@Command({ description: 'Print CLI and runtime information.' })
export class InfoCommand implements CliCommand<AgentEngineer> {
  @Option.choice({ short: 'f', choices: OUTPUT_FORMATS, default: 'text', description: 'output format' })
  format!: OutputFormat;

  run({ io, cli, logger }: CommandContext<AgentEngineer>): void {
    logger.debug(`rendering info as ${this.format}`);

    const info: RuntimeInfo = {
      name: cli.name,
      version: cli.version ?? 'unknown',
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    };

    io.stdout(this.format === 'json' ? `${JSON.stringify(info, null, 2)}\n` : renderText(info));
  }
}

@Command({ description: 'Greet someone, to show arguments and typed options.' })
export class GreetCommand implements CliCommand<AgentEngineer> {
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

@Command({
  name: 'agent-engineer',
  description: 'Agent Engineer command-line interface.',
  package: import.meta.url,
  commands: [InfoCommand, GreetCommand],
})
export class AgentEngineer {}

function renderText(info: RuntimeInfo): string {
  return `${Object.entries(info)
    .map(([key, value]) => `${key.padEnd(10)}${value}`)
    .join('\n')}\n`;
}
