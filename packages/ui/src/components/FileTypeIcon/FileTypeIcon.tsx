import * as React from 'react';
import { SvgIcon, type SvgIconProps } from '@mui/material';
import { fileArtwork } from './artwork';

export type FileType = keyof typeof fileArtwork | 'image' | 'archive' | 'audio' | 'video' | 'code' | 'file';
const extensions: Record<string, FileType> = {
  png: 'png', jpg: 'jpg', jpeg: 'jpg', pdf: 'pdf', doc: 'word', docx: 'word', odt: 'word',
  xls: 'excel', xlsx: 'excel', ods: 'excel', ppt: 'powerpoint', pptx: 'powerpoint', odp: 'powerpoint',
  csv: 'csv', tsv: 'csv', txt: 'text', md: 'text', log: 'text', rtf: 'text',
  svg: 'image', gif: 'image', webp: 'image', avif: 'image', bmp: 'image', tif: 'image', tiff: 'image',
  zip: 'archive', gz: 'archive', tar: 'archive', rar: 'archive', '7z': 'archive',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video', mkv: 'video',
  json: 'code', js: 'code', jsx: 'code', ts: 'code', tsx: 'code', css: 'code', html: 'code', xml: 'code', py: 'code', yaml: 'code', yml: 'code'
};
const mimeTypes: Record<string, FileType> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf', 'text/csv': 'csv', 'text/tab-separated-values': 'csv',
  'application/msword': 'word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'application/zip': 'archive', 'application/gzip': 'archive', 'application/x-7z-compressed': 'archive',
  'application/json': 'code', 'application/xml': 'code', 'text/html': 'code', 'text/css': 'code', 'text/javascript': 'code'
};
export function resolveFileType(fileName?: string, mimeType?: string): FileType {
  const mime = mimeType?.split(';')[0].trim().toLowerCase() ?? '';
  if (Object.hasOwn(mimeTypes, mime)) return mimeTypes[mime];
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  const name = fileName?.split(/[?#]/)[0].split(/[\\/]/).at(-1)?.toLowerCase() ?? '';
  const extension = name.lastIndexOf('.') > 0 ? name.split('.').at(-1)! : '';
  return (Object.hasOwn(extensions, extension) ? extensions[extension] : undefined) ?? (mime.startsWith('text/') ? 'text' : 'file');
}
export interface FileTypeIconProps extends Omit<SvgIconProps, 'children' | 'titleAccess' | 'viewBox' | 'type'> {
  fileName?: string;
  mimeType?: string;
  type?: FileType;
  /** Omit for a decorative icon next to an existing file label. */
  label?: string;
}
export const FileTypeIcon = React.forwardRef<SVGSVGElement, FileTypeIconProps>(function FileTypeIcon(
  { fileName, mimeType, type, label, ...props }, ref
) {
  const resolved = type ?? resolveFileType(fileName, mimeType);
  const artwork = Object.hasOwn(fileArtwork, resolved) ? fileArtwork[resolved as keyof typeof fileArtwork] : null;
  const accessibleLabel = label ?? props['aria-label'];
  return <SvgIcon ref={ref} {...props} viewBox={artwork ? '0 0 400 400' : '0 0 24 24'} titleAccess={accessibleLabel}
    role={accessibleLabel ? 'img' : undefined} aria-label={accessibleLabel} aria-hidden={accessibleLabel ? undefined : true} focusable="false">
    {artwork ?? <>
      <path d="M5 2h9l5 5v15H5Z M14 2v6h5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {resolved === 'image' ? <><circle cx="9" cy="11" r="1.5" /><path d="m7 19 4-5 3 3 2-2 2 4Z" /></>
        : resolved === 'audio' ? <path d="M15 10v7a2 2 0 1 1-2-2v-4l4-1v2Z" />
        : resolved === 'video' ? <path d="m10 11 6 4-6 4Z" />
        : resolved === 'code' ? <path d="m10 12-3 3 3 3m4-6 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        : resolved === 'archive' ? <path d="M10 9h2v2h-2Zm2 2h2v2h-2Zm-2 2h2v2h-2Zm2 2h2v2h-2Zm-2 2h2v2h-2Z" />
        : <path d="M8 12h8M8 16h8" fill="none" stroke="currentColor" strokeWidth="1.5" />}
    </>}
  </SvgIcon>;
});
