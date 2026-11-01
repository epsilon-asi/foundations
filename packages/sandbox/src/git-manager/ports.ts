/** Filesystem effects used when creating worktrees and copying untracked files into them. */
export interface FilesystemPort {
  /** Creates `path` and any missing parent directories. */
  mkdir(path: string): Promise<void>;
  /**
   * Copies a regular file (preserving its mode) or recreates a symlink at `destinationPath`, creating parent
   * directories and replacing any existing entry.
   */
  copyFileOrSymlink(sourcePath: string, destinationPath: string): Promise<void>;
}
