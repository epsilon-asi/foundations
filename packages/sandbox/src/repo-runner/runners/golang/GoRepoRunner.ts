import { devNull } from 'node:os';

import type { TaskTable } from '../../contracts/runner.js';
import { readConfigFile } from '../../filesystem/configReaders.js';
import { AbstractRepoRunner } from '../AbstractRepoRunner.js';
import type { GoInstallPlan, GoRepoConfig } from './golang.contracts.js';
import { parseGoMod } from './goModParser.js';

const GO_BINARY = 'go';
const GO_MOD = 'go.mod';
const GO_SUM = 'go.sum';
/** Package pattern for "every package in the module". Flags must precede it, so forwarded args go before it. */
const ALL_PACKAGES = ['./...'];

const GO_INSTALL_PLAN: GoInstallPlan = { binary: GO_BINARY, args: ['mod', 'download'], mode: 'download' };

const GO_TASKS: TaskTable = new Map([
  ['test', { binary: GO_BINARY, args: ['test'], trailingArgs: ALL_PACKAGES }],
  // `-o <devNull>` compiles every package but never writes a binary into the sandbox (plain `go build ./...` does
  // when the module has exactly one main package).
  ['build', { binary: GO_BINARY, args: ['build', '-o', devNull], trailingArgs: ALL_PACKAGES }],
  ['vet', { binary: GO_BINARY, args: ['vet'], trailingArgs: ALL_PACKAGES }],
  ['generate', { binary: GO_BINARY, args: ['generate'], trailingArgs: ALL_PACKAGES }],
  ['tidy', { binary: GO_BINARY, args: ['mod', 'tidy'] }],
]);

/**
 * Runner for Go modules (detected by `go.mod`). Install is `go mod download`; tasks are `test`, `build` (output
 * discarded), `vet`, `generate` (each over `./...`, with forwarded args placed before the pattern) and `tidy`.
 */
export class GoRepoRunner extends AbstractRepoRunner<GoRepoConfig, GoInstallPlan> {
  public readonly kind = 'golang';

  public detect(): Promise<boolean> {
    return this.hasFile(GO_MOD);
  }

  protected async loadRepoConfig(): Promise<GoRepoConfig> {
    const goModPath = this.resolvePath(GO_MOD);
    return {
      kind: this.kind,
      goModPath,
      goMod: await readConfigFile(goModPath, parseGoMod),
      lockfile: (await this.hasFile(GO_SUM)) ? GO_SUM : null,
    };
  }

  protected resolveTasks(): TaskTable {
    return GO_TASKS;
  }

  protected resolveInstallPlan(): GoInstallPlan {
    return GO_INSTALL_PLAN;
  }
}
