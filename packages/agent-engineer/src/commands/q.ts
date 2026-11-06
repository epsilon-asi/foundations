import os from 'node:os';
import path from 'node:path';
import {createLayeredFile} from '@epsilon-asi/foundation/files';
import {CliCommand, Command, type CommandContext} from '@epsilon-asi/command-line';
import type {AgentEngineer} from '../cli.js';
import {GlobalConfigSchema} from '../config/global-config.js';

/** Config file name looked for in the working directory and its ancestors. */
export const LOCAL_CONFIG_FILE = 'agent-engineer.yaml';

/** Directory under the user's home directory holding the user-level config. */
export const USER_CONFIG_DIR = '.easi';

/** The user-level config path: `~/.easi/agent-engineer.yaml`. */
export const USER_CONFIG_PATH = path.join(os.homedir(), USER_CONFIG_DIR, LOCAL_CONFIG_FILE);

/**
 * The agent-engineer config, merged by precedence (highest first):
 *  1. `./agent-engineer.yaml`
 *  2. `agent-engineer.yaml` in each parent directory, nearest first
 *  3. `~/.easi/agent-engineer.yaml`
 */
export const AgentEngineerConfig = createLayeredFile(GlobalConfigSchema, LOCAL_CONFIG_FILE, {
    fallbacks: [USER_CONFIG_PATH],
});

/** `agent-engineer query`: loads the merged config and prints it. */
@Command({
    name: "query",
    description: 'Query the agent.',
    commands: [],
    aliases: ["q"],
})
export class QueryCommand extends CliCommand<AgentEngineer> {
    async run({io, logger}: CommandContext<AgentEngineer>): Promise<void> {
        const {value: config, layers} = await AgentEngineerConfig.load();

        if (layers.length === 0) {
            logger.debug(`No ${LOCAL_CONFIG_FILE} found from ${process.cwd()} upwards or at ${USER_CONFIG_PATH}; using defaults.`);
        } else {
            const described = layers.map(({filePath, origin}) => `${filePath} (${origin})`).join(', ');
            logger.debug(`Merged config, highest precedence first: ${described}`);
        }

        io.stdout(`${JSON.stringify(config, undefined, 4)}\n`);
    }
}
