import { Command, Option, type CliCommand, type CommandContext } from '@epsilon-asi/command-line';
import type { AgentEngineer } from '../cli.js';

export const OUTPUT_FORMATS = ['text', 'json'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface RuntimeInfo {
  readonly name: string;
  readonly version: string;
  readonly node: string;
  readonly platform: string;
}

/** `agent-engineer info`: the command name is derived from the class name. */
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

    io.stdout(render(info, this.format));
  }
}

function render(info: RuntimeInfo, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return `${JSON.stringify(info, null, 2)}\n`;
    case 'text':
      return `${Object.entries(info)
        .map(([key, value]) => `${key.padEnd(10)}${value}`)
        .join('\n')}\n`;
  }
}
