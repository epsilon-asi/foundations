import { chmod, copyFile, lstat, mkdir, readlink, rm, symlink } from 'node:fs/promises';
import { dirname } from 'node:path';

import { GitError } from '../errors.js';
import type { FilesystemPort } from '../ports.js';

/** The default `FilesystemPort`, backed by `node:fs/promises`. */
export const nodeFilesystem: FilesystemPort = {
  async mkdir(path) {
    await mkdir(path, { recursive: true });
  },

  async copyFileOrSymlink(sourcePath, destinationPath) {
    const sourceStats = await lstat(sourcePath);

    if (!sourceStats.isFile() && !sourceStats.isSymbolicLink()) {
      throw new GitError(`Only regular files and symlinks can be copied: ${sourcePath}`);
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await rm(destinationPath, { force: true, recursive: true });

    if (sourceStats.isSymbolicLink()) {
      await symlink(await readlink(sourcePath), destinationPath);
      return;
    }

    await copyFile(sourcePath, destinationPath);
    await chmod(destinationPath, sourceStats.mode);
  },
};
