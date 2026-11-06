import {Command} from '@epsilon-asi/command-line';
import {InfoCommand} from './commands/info.js';
import {QueryCommand} from "./commands/q.js";
import {config} from './middleware/config.js';

/**
 * The root command. Its name, version and description come from package.json
 * (`bin`, `version` and `description`), so `--version` always matches the
 * release. Every root gets `-l, --log-level <level>` with an
 * AGENT_ENGINEER_LOG_LEVEL variable, and every command gets `context.logger`.
 * Subcommands are listed in `commands` in help order and must be imported
 * (and therefore defined) before this class. The `config` middleware runs
 * before every command, so each one starts with the merged config loaded.
 */
@Command({package: import.meta.url, use: [config], commands: [InfoCommand, QueryCommand]})
export class AgentEngineer {
}
