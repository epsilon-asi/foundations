import { constants as fsConstants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';

export interface CommandLookupOptions {
  /** Environment providing `PATH` (and `PATHEXT` on Windows). Default: `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Platform whose lookup rules apply. Default: `process.platform`. */
  readonly platform?: NodeJS.Platform;
}

const DEFAULT_WINDOWS_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * `true` when `command` resolves to an executable file. Scans `PATH` (plus `PATHEXT` extensions on Windows)
 * without spawning a shell; commands containing a path separator are checked directly.
 */
export async function commandExists(command: string, options: CommandLookupOptions = {}): Promise<boolean> {
  if (command.length === 0) {
    return false;
  }
  const env = options.env ?? process.env;
  const windows = (options.platform ?? process.platform) === 'win32';
  const extensions = windows ? ['', ...(env.PATHEXT ?? DEFAULT_WINDOWS_PATHEXT).split(';').filter(Boolean)] : [''];
  const hasSeparator = command.includes('/') || (windows && command.includes('\\'));
  const directories = hasSeparator ? [''] : (env.PATH ?? env.Path ?? '').split(windows ? ';' : ':').filter(Boolean);

  for (const directory of directories) {
    for (const extension of extensions) {
      if (await isExecutableFile(path.join(directory, command + extension), windows)) {
        return true;
      }
    }
  }
  return false;
}

async function isExecutableFile(file: string, windows: boolean): Promise<boolean> {
  try {
    // Windows has no execute bit; existence (with a PATHEXT extension) is what makes a file runnable.
    await access(file, windows ? fsConstants.F_OK : fsConstants.X_OK);
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}
