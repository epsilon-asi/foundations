import { Argument, Command, Option, type CliCommand, type CommandContext } from '../../src/index.js';

/**
 * The agent-engineer CLI (packages/agent-engineer) rebuilt on the CLI system.
 * Every declaration lives on the classes; nothing here touches commander.
 */

export const CLI_NAME = 'agent-engineer';
export const CLI_VERSION = '1.0.0';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

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

  run({ io, root }: CommandContext<AgentEngineer>): void {
    if (root.logLevel === 'debug') io.stderr(`[debug] rendering info as ${this.format}\n`);

    const info: RuntimeInfo = {
      name: CLI_NAME,
      version: CLI_VERSION,
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
  name: CLI_NAME,
  description: 'Agent Engineer command-line interface.',
  version: CLI_VERSION,
  commands: [InfoCommand, GreetCommand],
})
export class AgentEngineer {
  @Option.choice({
    short: 'l',
    choices: LOG_LEVELS,
    default: 'info',
    env: 'AGENT_ENGINEER_LOG_LEVEL',
    description: 'minimum severity of log output',
  })
  logLevel!: LogLevel;
}

function renderText(info: RuntimeInfo): string {
  return `${Object.entries(info)
    .map(([key, value]) => `${key.padEnd(10)}${value}`)
    .join('\n')}\n`;
}
