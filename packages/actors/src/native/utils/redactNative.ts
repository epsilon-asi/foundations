import path from 'node:path';

export function redactPath(filePath: string, reveal = false): string {
  if (reveal) return filePath;
  return path.basename(filePath) === '' ? '<path>' : `<path:${path.basename(filePath)}>`;
}
