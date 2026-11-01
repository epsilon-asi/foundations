import type { CliIO } from '../../src/index.js';

export interface CapturedIO {
  readonly io: CliIO;
  readonly stdout: () => string;
  readonly stderr: () => string;
}

/** A `CliIO` that records everything written to it. */
export function captureIO(): CapturedIO {
  const out: string[] = [];
  const err: string[] = [];

  return {
    io: {
      stdout: (text) => {
        out.push(text);
      },
      stderr: (text) => {
        err.push(text);
      },
    },
    stdout: () => out.join(''),
    stderr: () => err.join(''),
  };
}
