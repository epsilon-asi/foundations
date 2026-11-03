import {CliCommand, Command, type CommandContext} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';

/** `agent-engineer info`: the command name is derived from the class name. */
@Command({
    description: 'Print CLI and runtime information.',
})
export class InfoCommand extends CliCommand<AgentEngineer> {
    run({io, cli, logger}: CommandContext<AgentEngineer>): void {
        logger.debug(`rendering info as ${this.format}`);

        io.stdout(this.render(this.runtimeInfo(cli)));
    }
}
