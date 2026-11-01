import { describe, expect, it } from 'vitest';

import * as api from '../../../src/repo-runner/index.js';
import * as shared from '../../../src/shared/index.js';

describe('public API', () => {
  it('exports exactly the documented runtime values', () => {
    expect(Object.keys(api).sort()).toEqual([
      'AbstractRepoRunner',
      'ChildProcessCommandExecutor',
      'CommandExecutionError',
      'CommandFailedError',
      'DEFAULT_TASK_TIMEOUT_MS',
      'GoRepoRunner',
      'MissingTaskError',
      'NodeTypescriptRepoRunner',
      'PythonRepoRunner',
      'RepoConfigParseError',
      'RepoRunnerError',
      'RepoRunnerRegistry',
      'SandboxError',
      'TerraformRepoRunner',
      'UnsupportedRepositoryError',
      'createDefaultRepoRunnerRegistry',
      'ensureSuccess',
      'isSuccessfulResult',
    ]);
  });

  it('re-exports the shared bindings rather than copies', () => {
    expect(api.ChildProcessCommandExecutor).toBe(shared.ChildProcessCommandExecutor);
    expect(api.CommandFailedError).toBe(shared.CommandFailedError);
    expect(api.CommandExecutionError).toBe(shared.CommandExecutionError);
    expect(api.SandboxError).toBe(shared.SandboxError);
    expect(api.ensureSuccess).toBe(shared.ensureSuccess);
    expect(api.isSuccessfulResult).toBe(shared.isSuccessfulResult);
  });
});
