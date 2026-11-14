import {CliCommand, Command, type CommandContext, type Provided} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';
import {config} from '../middleware/config.js';

type AnswerContext = CommandContext<AgentEngineer, Provided<typeof config>>;

/** `agent-engineer answer`: prints the merged config the `config` middleware loaded. */
@Command({
    name: "answer",
    description: 'Print the merged config.',
    commands: [],
    aliases: ["a"],
    use: [config],
})
export class AnswerCommand extends CliCommand<AgentEngineer, Provided<typeof config>> {
    run({io, config}: AnswerContext): void {

        io.stdout(`${JSON.stringify(config, undefined, 4)}\n`);
    }
}
