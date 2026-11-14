import {Command} from '@epsilon-asi/command-line';
import {withWorkspace} from '../agents/workspace.js';
import {buildAnswerQuestionGraph} from '../graphs/answer-question/index.js';
import {config} from '../middleware/config.js';
import {models} from '../middleware/models.js';
import {EngineerCommand} from './engineer.js';

/**
 * `agent-engineer query <question...>`: answers a question about the repository. The agent searches and reads a
 * sandboxed snapshot of it and changes nothing. Use `do` to have the intent parsed and routed instead.
 */
@Command({
    name: 'query',
    description: 'Ask a question about the repository; the agent reads the code to answer it.',
    aliases: ['q'],
    use: [config, models],
})
export class QueryCommand extends EngineerCommand {
    protected graph() {
        return withWorkspace(buildAnswerQuestionGraph());
    }
}
