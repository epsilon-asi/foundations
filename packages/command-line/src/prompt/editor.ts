import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isatty } from 'node:tty';
import { PromptCancelledError } from '../errors.js';
import type { EditorOptions, Writer } from '../types.js';
import { editedText, extensionOf } from './shared.js';

export interface EditorSetup {
  readonly env: NodeJS.ProcessEnv;
  /** Checked before VISUAL and EDITOR. */
  readonly editorEnv: string | undefined;
  /** Where the hint shown while the editor is open goes. */
  readonly write: Writer;
}

/**
 * The editor command to run, as git chooses one: the CLI's own variable, then
 * `VISUAL`, then `EDITOR`, then `vi`.
 */
export function resolveEditor(env: NodeJS.ProcessEnv, editorEnv: string | undefined): string {
  for (const name of [editorEnv, 'VISUAL', 'EDITOR']) {
    if (name === undefined) continue;
    const value = env[name]?.trim();
    if (value !== undefined && value !== '') return value;
  }
  return 'vi';
}

/**
 * Writes `initial` to a private temporary file, opens it in the editor, waits
 * for the editor to exit and resolves to what was left in the file. The file
 * and its directory are removed afterwards, whatever happened.
 */
export async function editInEditor(setup: EditorSetup, options: EditorOptions): Promise<string> {
  const command = resolveEditor(setup.env, setup.editorEnv);
  const extension = extensionOf(options.extension);
  // mkdtemp makes the directory readable by its owner only, and the file is too.
  const directory = await mkdtemp(join(tmpdir(), 'prompt-'));

  try {
    const file = join(directory, `edit${extension}`);
    await writeFile(file, options.initial ?? '', { mode: 0o600 });

    // Shown for editors that open a window, like `code --wait`; full-screen editors draw over it.
    setup.write('Waiting for your editor to close the file…');
    try {
      await runEditor(command, file, setup.env);
    } finally {
      setup.write('\r\x1b[K');
    }

    return editedText(await readFile(file, 'utf8'), options);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runEditor(command: string, file: string, env: NodeJS.ProcessEnv): Promise<void> {
  // Ctrl+C reaches the editor too. Ignoring it here keeps this process waiting
  // for the editor instead of exiting and leaving it running on the terminal.
  const ignore = (): void => {};
  process.on('SIGINT', ignore);

  try {
    // The editor draws on the terminal, so when stdout is redirected it draws on stderr instead.
    const stdio = ['inherit', isatty(1) ? 'inherit' : 2, 'inherit'] as const;
    // As git does: the shell splits the command, so `code --wait` works, and
    // the path is passed as an argument, never parsed as shell code.
    const child = spawn('/bin/sh', ['-c', `${command} "$@"`, command, file], { stdio: [...stdio], env });

    const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
    if (signal !== null) throw new PromptCancelledError();
    if (code === 127) {
      throw new Error(`could not run the editor "${command}"; set VISUAL or EDITOR to an editor that is installed.`);
    }
    if (code !== 0) throw new Error(`the editor "${command}" exited with code ${String(code)}.`);
  } finally {
    process.removeListener('SIGINT', ignore);
  }
}
