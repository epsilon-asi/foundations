import {Command, type CommandContext} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';
import {AgentEngineerCommand} from '../common/CommandBase.js';

export {OUTPUT_FORMATS, type OutputFormat, type RuntimeInfo} from '../common/CommandBase.js';

/** `agent-engineer info`: the command name is derived from the class name. */
@Command({
    description: 'Print CLI and runtime information.',
})
export class InfoCommand extends AgentEngineerCommand {
    run({io, cli, logger, }: CommandContext<AgentEngineer>): void {

        logger.debug(`rendering info as ${this.format}`);

        io.stdout(this.render(this.runtimeInfo(cli)));
    }
}
