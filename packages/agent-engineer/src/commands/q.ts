import {CliCommand, Command, type CommandContext} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';

/** `agent-engineer info`: the command name is derived from the class name. */
@Command({
    name: "query",
    description: 'Query the agent.',
    commands: [],
    aliases: ["q"],
})
export class QueryCommand extends CliCommand<AgentEngineer> {
    run({
            io,
            cli,
            root,
            logger,
            liveLine}: CommandContext<AgentEngineer>): void {
        logger.debug(`Starting Query Command`);
        liveLine().update(JSON.stringify(root, undefined, 4))

    }
}
