import { runCli } from '../../src/index.js';
import { AgentEngineer } from './cli.js';

process.exitCode = await runCli(AgentEngineer, process.argv.slice(2));
