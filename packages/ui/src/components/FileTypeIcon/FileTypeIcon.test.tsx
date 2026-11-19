import { createRef } from 'react';
import { screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { FileTypeIcon, resolveFileType } from './FileTypeIcon';

it.each([
  ['C:\\assets\\HERO.PNG?download=1', undefined, 'png'], ['folder/report.DOCX#revision', undefined, 'word'],
  ['assets/data.csv', 'text/csv; charset=utf-8', 'csv'], ['unknown.bin', 'image/svg+xml', 'image'],
  ['wrong.png', 'application/pdf', 'pdf'], ['report.xlsx', 'application/octet-stream', 'excel'],
  ['clip.bin', 'audio/ogg', 'audio'], ['clip', 'video/mp4', 'video'], ['readme', 'text/plain', 'text'],
  ['.hidden', undefined, 'file'], ['file.constructor', 'constructor', 'file'], ['unknown', undefined, 'file']
])('resolves %s / %s as %s', (name, mime, type) => { expect(resolveFileType(name, mime)).toBe(type); });
it('allows explicit type overrides and supports labelled or decorative SVGs', () => {
  const ref = createRef<SVGSVGElement>(); const { rerender } = renderWithUi(<FileTypeIcon ref={ref} type="pdf" fileName="wrong.png" label="PDF document" />);
  expect(screen.getByRole('img', { name: 'PDF document' })).toBe(ref.current); expect(ref.current).toHaveAttribute('viewBox', '0 0 400 400');
  rerender(<FileTypeIcon ref={ref} fileName="unknown" data-testid="icon" />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument(); expect(ref.current).toHaveAttribute('aria-hidden', 'true'); expect(ref.current).toHaveAttribute('viewBox', '0 0 24 24');
});
