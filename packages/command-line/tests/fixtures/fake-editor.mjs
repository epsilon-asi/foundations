// Stands in for an editor in tests: records the file it was given, then
// replaces its text and exits, or is killed by a signal, as the environment says.
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const file = process.argv[process.argv.length - 1];
const { FAKE_EDITOR_SEEN: seen, FAKE_EDITOR_TEXT: text, FAKE_EDITOR_EXIT: exit, FAKE_EDITOR_SIGNAL: signal } = process.env;

if (seen !== undefined) {
  const mode = (statSync(file).mode & 0o777).toString(8);
  writeFileSync(seen, JSON.stringify({ file, mode, text: readFileSync(file, 'utf8') }));
}
if (text !== undefined) writeFileSync(file, text);
if (signal !== undefined) process.kill(process.pid, signal);
else process.exit(Number(exit ?? 0));
