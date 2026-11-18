import { createRef } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { FileDropzone } from './FileDropzone';
import { SelectedFileList } from './SelectedFileList';

const make = (name = 'asset.png', type = 'image/png', size = 4) => new File(['x'.repeat(size)], name, { type, lastModified: 123 });
const picker = () => screen.getByLabelText('Choose files', { selector: 'input' }) as HTMLInputElement;
it('opens the native picker through our button, selects files and removes them with callbacks', async () => {
  const change = vi.fn(); const drop = vi.fn(); const ref = createRef<HTMLDivElement>(); const input = createRef<HTMLInputElement>();
  renderWithUi(<FileDropzone ref={ref} inputRef={input} onFilesChange={change} onDrop={drop} data-testid="dropzone" />);
  const click = vi.spyOn(input.current!, 'click').mockImplementation(() => {});
  await userEvent.click(screen.getByRole('button', { name: 'Choose files' })); expect(click).toHaveBeenCalledTimes(1); click.mockRestore();
  const file = make(); await userEvent.upload(picker(), file); expect(change).toHaveBeenLastCalledWith([file], 'add'); expect(drop).toHaveBeenLastCalledWith([file], []);
  expect(screen.getByRole('list', { name: 'Selected files' })).toHaveTextContent('asset.png4 bytes');
  await userEvent.click(screen.getByRole('button', { name: 'Remove asset.png' })); expect(change).toHaveBeenLastCalledWith([], 'remove');
  expect(screen.queryByRole('list')).not.toBeInTheDocument(); expect(ref.current).toBe(screen.getByTestId('dropzone'));
});
it('accepts valid files while reporting type, size, count and duplicate rejections without losing existing files', async () => {
  const reject = vi.fn(); const drop = vi.fn(); const first = make();
  renderWithUi(<FileDropzone accept="image/*,.PNG" maxSize={8} maxFiles={2} defaultFiles={[first]} onReject={reject} onDrop={drop} />);
  await userEvent.upload(picker(), [first, make('bad.txt', 'text/plain'), make('big.png', 'image/png', 9), make('second.PNG', ''), make('third.png')], { applyAccept: false });
  expect(drop).toHaveBeenCalledTimes(1); const [accepted, rejected] = drop.mock.calls[0]; expect(accepted.map((file: File) => file.name)).toEqual(['second.PNG']);
  expect(rejected.map((entry: { errors: { code: string }[] }) => entry.errors[0].code)).toEqual(['duplicate-file', 'file-invalid-type', 'file-too-large', 'too-many-files']);
  expect(reject).toHaveBeenCalledWith(rejected); expect(within(screen.getByRole('list', { name: 'Selected files' })).getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByRole('alert')).toHaveTextContent('Some files were not added');
  await userEvent.click(screen.getByRole('button', { name: 'Close alert' })); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('supports drag/drop, nested drag targets and ignores disabled changes', () => {
  const change = vi.fn(); const file = make(); const data = { types: ['Files'], files: [file], dropEffect: '' };
  const { rerender } = renderWithUi(<FileDropzone onFilesChange={change} />); const button = screen.getByRole('button', { name: 'Choose files' });
  fireEvent.dragEnter(button, { dataTransfer: data }); expect(button).toHaveTextContent('Drop files here');
  fireEvent.dragEnter(button.firstChild!, { dataTransfer: data }); fireEvent.dragLeave(button.firstChild!, { dataTransfer: data }); expect(button).toHaveTextContent('Drop files here');
  fireEvent.drop(button, { dataTransfer: data }); expect(change).toHaveBeenLastCalledWith([file], 'add');
  rerender(<FileDropzone onFilesChange={change} disabled />); change.mockClear();
  fireEvent.drop(screen.getByRole('button', { name: 'Choose files' }), { dataTransfer: data }); fireEvent.change(picker(), { target: { files: [file] } }); expect(change).not.toHaveBeenCalled();
});
it('replaces the single selection, rejects empty files and resets input value for retries', async () => {
  const change = vi.fn(); const old = make('old.png'); const next = make('next.png');
  renderWithUi(<FileDropzone multiple={false} minSize={1} defaultFiles={[old]} onFilesChange={change} />);
  await userEvent.upload(picker(), make('empty.png', 'image/png', 0)); expect(change).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('at least 1 bytes');
  await userEvent.upload(picker(), next); expect(change).toHaveBeenLastCalledWith([next], 'add'); expect(picker()).toHaveValue('');
  expect(screen.queryByText('old.png')).not.toBeInTheDocument();
});
it('preserves controlled files and read-only/busy selections', async () => {
  const file = make(); const change = vi.fn(); const { rerender } = renderWithUi(<FileDropzone files={[file]} onFilesChange={change} />);
  await userEvent.click(screen.getByRole('button', { name: 'Remove asset.png' })); expect(change).toHaveBeenCalledWith([], 'remove'); expect(screen.getByText('asset.png')).toBeInTheDocument();
  rerender(<FileDropzone files={[file]} readOnly onFilesChange={change} />); expect(screen.queryByRole('button', { name: 'Remove asset.png' })).not.toBeInTheDocument(); expect(picker()).toBeDisabled();
  rerender(<FileDropzone files={[file]} busy onFilesChange={change} />); expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true'); expect(screen.getByRole('button', { name: 'Remove asset.png' })).toBeDisabled();
});
it('creates local image previews and revokes their URLs when replaced/unmounted', () => {
  const oldCreate = URL.createObjectURL; const oldRevoke = URL.revokeObjectURL;
  const create = vi.fn().mockReturnValueOnce('blob:one').mockReturnValueOnce('blob:two'); const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  try {
    const { rerender, unmount, container } = renderWithUi(<SelectedFileList files={[make()]} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:one');
    rerender(<SelectedFileList files={[make('other.png')]} />); expect(revoke).toHaveBeenCalledWith('blob:one'); expect(container.querySelector('img')).toHaveAttribute('src', 'blob:two');
    unmount(); expect(revoke).toHaveBeenCalledWith('blob:two');
  } finally { Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: oldCreate }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: oldRevoke }); }
});
