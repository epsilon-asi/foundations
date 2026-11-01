import { CLI, type InfoOptions, type OutputFormat } from '../config.js';
import type { CommandContext } from '../context.js';

export interface RuntimeInfo {
  readonly name: string;
  readonly version: string;
  readonly node: string;
  readonly platform: string;
}

export function runInfo(options: InfoOptions, { io, logger }: CommandContext): void {
  logger.debug(`rendering info as ${options.format}`);

  const info: RuntimeInfo = {
    name: CLI.name,
    version: CLI.version,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  };

  io.stdout(render(info, options.format));
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
