import {Command} from '@epsilon-asi/command-line';
import {buildRouterGraph} from '../graphs/router.js';
import {config} from '../middleware/config.js';
import {models} from '../middleware/models.js';
import {EngineerCommand} from './engineer.js';

/**
 * `agent-engineer do <request...>`: parses the intent of the request and routes it to that intent's agent, which
 * answers it, writes a plan, or changes the repository on a branch of its own.
 */
@Command({
    name: 'do',
    description: 'Parse the intent of a request and hand it to the agent for that intent.',
    use: [config, models],
})
export class DoCommand extends EngineerCommand {
    protected graph() {
        return buildRouterGraph();
    }
}
