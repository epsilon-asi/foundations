import { Command } from '@epsilon-asi/command-line';
import { InfoCommand } from './commands/info.js';

/**
 * The root command. Its name, version and description come from package.json
 * (`bin`, `version` and `description`), so `--version` always matches the
 * release. Every root gets `-l, --log-level <level>` with an
 * AGENT_ENGINEER_LOG_LEVEL variable, and every command gets `context.logger`.
 * Subcommands are listed in `commands` in help order and must be imported
 * (and therefore defined) before this class.
 */
@Command({ package: import.meta.url, commands: [InfoCommand] })
export class AgentEngineer {}
