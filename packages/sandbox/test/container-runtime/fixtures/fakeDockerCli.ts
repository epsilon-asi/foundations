import type { CommandResponder, ScriptedResult } from './recordingCommandExecutor.js';

export interface FakeDockerCliOptions {
  containerId?: string;
  /** Result per exec'd command line (tokens joined by spaces). Unlisted commands succeed with empty output. */
  exec?: Record<string, ScriptedResult>;
  health?: string;
}

/** Answers Docker CLI invocations the way a healthy daemon with one coding-agent container would. */
export function fakeDockerCli(options: FakeDockerCliOptions = {}): CommandResponder {
  const containerId = options.containerId ?? 'ctr-1';
  const inspection = {
    Id: containerId,
    Name: `/${containerId}`,
    Config: { Image: 'node:24.15.0-bookworm-slim', Labels: { 'sandbox.kind': 'coding-agent' } },
    State: {
      Status: 'running',
      Running: true,
      ...(options.health !== undefined ? { Health: { Status: options.health } } : {}),
    },
    Mounts: [],
  };

  return (args) => {
    switch (args.slice(0, 2).join(' ')) {
      case 'info --format':
        return { stdout: JSON.stringify({ ID: 'fake-daemon', ServerVersion: '28.0.0' }) };
      case 'container create':
        return { stdout: `${containerId}\n` };
      case 'container exec':
        return options.exec?.[args.slice(args.indexOf(containerId) + 1).join(' ')] ?? {};
      case 'container inspect':
        return { stdout: JSON.stringify([inspection]) };
      case 'container ls':
        return { stdout: `${JSON.stringify({ ID: containerId })}\n` };
      case 'container logs':
        return { stdout: 'ready\n' };
      case 'container diff':
        return { stdout: 'A /workspace/example-output.txt\n' };
      case 'container wait':
        return { stdout: '0\n' };
      default:
        return {};
    }
  };
}
