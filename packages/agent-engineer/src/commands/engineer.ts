import {Argument, CliCommand, type CommandContext, type Provided} from '@epsilon-asi/command-line';
import type {EngineerRunContext} from '../agents/workspace.js';
import type {AgentEngineer} from '../cli.js';
import type {EngineerStateType} from '../graphs/state.js';
import type {config} from '../middleware/config.js';

export type EngineerCommandContext = CommandContext<AgentEngineer, Provided<typeof config>>;

/** A graph an engineer command runs: one wrapped with `withWorkspace`, so it takes an {@link EngineerRunContext}. */
export interface EngineerGraph {
    invoke(
        input: { messages: { role: 'user'; content: string }[] },
        options: { context: EngineerRunContext },
    ): Promise<Partial<EngineerStateType>>;
}

/**
 * Base class of the commands that hand the user's request to an engineer graph. It takes the request as the
 * command's words (no quoting needed), shows the agent's progress on a live line, and prints its reply, plus the
 * branch and files when it committed changes. Subclasses supply the graph.
 */
export abstract class EngineerCommand extends CliCommand<AgentEngineer, Provided<typeof config>> {
    @Argument.list({required: true, description: 'the request; its words are joined, so it needs no quoting'})
    request!: string[];

    /** The graph the request runs through. */
    protected abstract graph(): EngineerGraph;

    async run({io, logger, liveLine, config, command}: EngineerCommandContext): Promise<void> {
        const request = this.request.join(' ').trim();
        if (request === '') {
            throw new Error(`Missing request: agent-engineer ${command.name()} <request>`);
        }

        logger.debug(`running ${command.name()}: ${request}`);
        const line = liveLine('starting');
        const result = await this.graph().invoke(
            {messages: [{role: 'user', content: request}]},
            {context: {config, progress: (text) => line.update(text)}},
        );
        const answer = result.messages?.findLast((message) => message.role === 'assistant')?.content ?? '';
        const {choice: intent, reasoning, changes} = result;
        if (intent === undefined) {
            line.clear();
        } else {
            line.done(`intent: ${intent}${reasoning ? ` (${reasoning})` : ''}`);
        }

        if (this.format === 'json') {
            io.stdout(this.render({request, intent, reasoning, answer, changes}));
            return;
        }
        io.stdout(`${answer.trimEnd()}\n`);
        if (changes !== undefined) {
            io.stdout(`\ncommitted ${changes.commit.slice(0, 12)} to branch ${changes.branch}\n${changes.files.map((file) => `  ${file}\n`).join('')}`);
        }
    }
}
