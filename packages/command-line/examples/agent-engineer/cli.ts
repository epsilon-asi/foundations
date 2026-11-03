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
 * Nothing declares a log level or an output format: every root gets
 * `-l, --log-level <level>` and an `AGENT_ENGINEER_LOG_LEVEL` variable, and
 * every command extending CliCommand gets `-f, --format` and `render()`.
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

@Command({
  name: 'agent-engineer',
  description: 'Agent Engineer command-line interface.',
  package: import.meta.url,
  commands: [InfoCommand, GreetCommand],
})
export class AgentEngineer {}
