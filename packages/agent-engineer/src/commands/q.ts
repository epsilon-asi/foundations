import {CliCommand, Command, type CommandContext, type Provided} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';
import {config} from '../middleware/config.js';

type QueryContext = CommandContext<AgentEngineer, Provided<typeof config>>;

/** `agent-engineer query`: prints the merged config the `config` middleware loaded. */
@Command({
    name: "query",
    description: 'Query the agent.',
    commands: [],
    aliases: ["q"],
    use: [config],
})
export class QueryCommand extends CliCommand<AgentEngineer, Provided<typeof config>> {
    run({io, config}: QueryContext): void {

        io.stdout(`${JSON.stringify(config, undefined, 4)}\n`);
    }
}
