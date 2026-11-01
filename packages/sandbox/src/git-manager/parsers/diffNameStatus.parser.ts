import type { GitDiffNameStatusEntry } from '../contracts/index.js';
import { splitNulFields, takeField } from './nulFields.js';

/** Renames (`R<score>`) and copies (`C<score>`) are followed by two paths: source, then destination. */
function hasSourcePath(status: string): boolean {
  return status.startsWith('R') || status.startsWith('C');
}

/** Parses `git diff --name-status -z` output. */
export function parseDiffNameStatus(output: string): GitDiffNameStatusEntry[] {
  const fields = splitNulFields(output).values();
  const entries: GitDiffNameStatusEntry[] = [];

  for (const status of fields) {
    const firstPath = takeField(fields, output, `a path after status ${JSON.stringify(status)}`);

    entries.push(
      hasSourcePath(status)
        ? { status, oldPath: firstPath, path: takeField(fields, output, `the destination path of ${firstPath}`) }
        : { status, path: firstPath },
    );
  }

  return entries;
}
