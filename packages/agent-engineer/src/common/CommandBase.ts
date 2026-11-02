import {type CliCommand, type CliInfo, type CommandContext, type CommandResult, Option} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';

export const OUTPUT_FORMATS = ['text', 'json'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface RuntimeInfo {
    readonly name: string;
    readonly version: string;
    readonly node: string;
    readonly platform: string;
}

/**
 * The base every agent-engineer command extends. It carries the shared
 * `-f, --format` option and the rendering that goes with it.
 *
 * @Option is inherited, so a subclass declares only its own options and must
 * not re-declare `format`; a property decorated on both classes is rejected.
 * @Command is not inherited: every concrete command declares its own. This
 * class is abstract, so it can never be listed in `commands` itself.
 */
export abstract class AgentEngineerCommand implements CliCommand<AgentEngineer> {
    @Option.choice({
        short: 'f',
        choices: OUTPUT_FORMATS,
        default: 'text',
        description: 'output format'
    })
    format!: OutputFormat;

    abstract run(context: CommandContext<AgentEngineer>): CommandResult | Promise<CommandResult>;

    /** The runtime facts a command reports. A root without a version reads as 0.0.0. */
    protected runtimeInfo(cli: CliInfo): RuntimeInfo {
        return {
            name: cli.name,
            version: cli.version ?? '0.0.0',
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
        };
    }

    protected render(info: RuntimeInfo): string {
        switch (this.format) {
            case 'json':
                return `${JSON.stringify(info, null, 2)}\n`;
            case 'text':
                return `${Object.entries(info)
                    .map(([key, value]) => `${key.padEnd(10)}${value}`)
                    .join('\n')}\n`;
        }
    }
}
