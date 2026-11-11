import {Argument, CliCommand, Command, type CommandContext} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';
import {buildParseIntentGraph} from '../graphs/router.js';

/**
 * `agent-engineer query <query...>`: runs the query through the parse-intent
 * graph and prints the intent it chose and why. The words of the query are
 * joined with spaces, so it does not need quoting.
 */
@Command({
    name: 'query',
    description: 'Parse the intent of a query and print the chosen intent.',
    aliases: ['q'],
})
export class QueryCommand extends CliCommand<AgentEngineer> {
    @Argument.list({required: true, description: 'the query to parse'})
    query!: string[];

    async run({io, logger}: CommandContext<AgentEngineer>): Promise<void> {
        const query = this.query.join(' ').trim();
        if (query === '') {
            throw new Error('Missing query: agent-engineer query <query>');
        }

        logger.debug(`parsing intent of: ${query}`);
        const {choice, reasoning} = await buildParseIntentGraph().invoke({
            messages: [{role: 'user', content: query}],
        });

        if (this.format === 'json') {
            io.stdout(this.render({query, intent: choice, reasoning}));
            return;
        }
        io.stdout(`intent: ${choice}\nreasoning: ${reasoning}\n`);
    }
}
