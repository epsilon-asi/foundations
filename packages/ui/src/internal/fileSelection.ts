export type FileRejectionCode = 'file-invalid-type' | 'file-too-large' | 'file-too-small' | 'too-many-files' | 'duplicate-file';
export interface FileRejection { file: File; errors: { code: FileRejectionCode; message: string }[] }
export type FileAccept = string | readonly string[];
export const fileKey = (file: File) => JSON.stringify([file.name, file.size, file.type, file.lastModified]);
export function acceptTokens(accept?: FileAccept) { return (typeof accept === 'string' ? accept.split(',') : accept ?? []).map((token) => token.trim().toLowerCase()).filter(Boolean); }
export function selectFiles(incoming: readonly File[], existing: readonly File[], { accept, minSize = 0, maxSize = Infinity, maxFiles = Infinity, multiple = true }:
  { accept?: FileAccept; minSize?: number; maxSize?: number; maxFiles?: number; multiple?: boolean }) {
  const tokens = acceptTokens(accept); const accepted: File[] = []; const rejected: FileRejection[] = [];
  const previous = multiple ? existing : []; const seen = new Set(previous.map(fileKey));
  const capacity = Math.max(0, Math.floor(Math.min(multiple ? maxFiles : 1, maxFiles)) - previous.length);
  for (const file of incoming) {
    const errors: FileRejection['errors'] = [];
    const type = file.type.toLowerCase(); const name = file.name.toLowerCase();
    if (tokens.length && !tokens.some((token) => token === '*/*' || (token.startsWith('.') ? name.endsWith(token) : token.endsWith('/*') ? type.startsWith(token.slice(0, -1)) : type === token))) errors.push({ code: 'file-invalid-type', message: 'File type is not accepted.' });
    if (file.size > maxSize) errors.push({ code: 'file-too-large', message: `File exceeds the ${maxSize}-byte limit.` });
    if (file.size < minSize) errors.push({ code: 'file-too-small', message: `File must contain at least ${minSize} bytes.` });
    if (seen.has(fileKey(file))) errors.push({ code: 'duplicate-file', message: 'File is already selected.' });
    if (!errors.length && accepted.length >= capacity) errors.push({ code: 'too-many-files', message: 'The file count limit has been reached.' });
    if (errors.length) rejected.push({ file, errors }); else { accepted.push(file); seen.add(fileKey(file)); }
  }
  return { accepted, rejected, files: accepted.length ? [...previous, ...accepted] : [...existing] };
}
