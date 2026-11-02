import { describe, expect, it, vi } from 'vitest';
import { detectTerminal, processIO } from '../src/index.js';

describe('detectTerminal', () => {
  it('describes an interactive stderr and follows its width', () => {
    const stderr = { isTTY: true, columns: 120 };
    const terminal = detectTerminal(stderr, { isTTY: true }, { TERM: 'xterm-256color' });
    expect(terminal).toEqual({ columns: 120, stdout: true });

    stderr.columns = 80;
    expect(terminal?.columns).toBe(80);
  });

  it('notes when stdout writes somewhere else', () => {
    expect(detectTerminal({ isTTY: true }, {}, {})?.stdout).toBe(false);
  });

  it('finds none when stderr is not a TTY, TERM is dumb or CI is set', () => {
    expect(detectTerminal({}, { isTTY: true }, {})).toBeUndefined();
    expect(detectTerminal({ isTTY: false }, { isTTY: true }, {})).toBeUndefined();
    expect(detectTerminal({ isTTY: true }, { isTTY: true }, { TERM: 'dumb' })).toBeUndefined();
    expect(detectTerminal({ isTTY: true }, { isTTY: true }, { CI: 'true' })).toBeUndefined();
  });

  it('reads process.env by default', () => {
    vi.stubEnv('CI', 'true');

    expect(detectTerminal({ isTTY: true }, { isTTY: true })).toBeUndefined();
  });
});

describe('processIO', () => {
  it('writes to the process streams', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    processIO.stdout('out');
    processIO.stderr('err');

    expect(stdout).toHaveBeenCalledWith('out');
    expect(stderr).toHaveBeenCalledWith('err');
  });

  it("describes the process's stderr", () => {
    vi.stubEnv('TERM', 'dumb');
    expect(processIO.terminal).toBeUndefined();

    vi.stubEnv('TERM', 'xterm-256color');
    vi.stubEnv('CI', undefined);
    expect(processIO.terminal?.columns).toBe(process.stderr.isTTY ? process.stderr.columns : undefined);
  });
});
