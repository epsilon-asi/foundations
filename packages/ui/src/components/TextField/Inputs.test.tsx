import * as React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { TextField } from './TextField';
import { TextArea } from '../TextArea';
import { SearchField } from '../SearchField';
import { MessageComposer, type MessageComposerHandle } from '../MessageComposer';
import { InspectorRow } from '../InspectorRow';
it('links inspector labels and combines helper descriptions on the input', () => {
  const change = vi.fn();
  renderWithUi(
    <InspectorRow label="Name" description="Public name" required>
      {(a) => <TextField {...a} error="Name required" onChange={change} clearable />}
    </InspectorRow>
  );
  const input = screen.getByRole('textbox', { name: /Name/ });
  expect(input).toBeRequired();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('Public name Name required');
  expect(screen.getByRole('alert')).toHaveTextContent('Name required');
  fireEvent.change(input, { target: { value: 'New' } });
  expect(change).toHaveBeenLastCalledWith('New', expect.anything(), 'input');
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(change).toHaveBeenLastCalledWith('', expect.anything(), 'clear');
  expect(input).toHaveFocus();
});
it('honors controlled multiline values, character limits and counts', () => {
  const change = vi.fn();
  renderWithUi(<TextArea label="Notes" value="abc" onChange={change} maxLength={8} showCount resize="vertical" />);
  const input = screen.getByRole('textbox');
  expect(input.tagName).toBe('TEXTAREA');
  expect(input).toHaveAttribute('maxlength', '8');
  expect(input).toHaveAccessibleDescription('3 / 8');
  fireEvent.change(input, { target: { value: 'abcde' } });
  expect(input).toHaveValue('abc');
});
it('debounces the latest edit, searches on Enter and lets a second Escape bubble', () => {
  vi.useFakeTimers();
  try {
    const debounced = vi.fn(),
      search = vi.fn(),
      parent = vi.fn();
    const { unmount } = renderWithUi(
      <div onKeyDown={parent}>
        <SearchField
          aria-label="Documents"
          onDebouncedChange={debounced}
          debounceMs={50}
          onSearch={search}
          resultsLabel="2 results"
        />
      </div>
    );
    const input = screen.getByRole('searchbox');
    expect(screen.getByRole('search', { name: 'Documents' })).toContainElement(input);
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    act(() => vi.advanceTimersByTime(50));
    expect(debounced.mock.calls).toEqual([['ab']]);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledWith('ab');
    parent.mockClear();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parent).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parent).toHaveBeenCalledOnce();
    unmount();
    act(() => vi.advanceTimersByTime(100));
    expect(debounced).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
it('submits intact drafts only on the configured key outside composition', () => {
  const submit = vi.fn();
  renderWithUi(<MessageComposer aria-label="Draft" onSubmit={submit} submitOn="mod+enter" />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '  ' } });
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
  fireEvent.change(input, { target: { value: ' hello ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, shiftKey: true });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
  fireEvent.compositionEnd(input);
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
  expect(submit).toHaveBeenCalledWith(' hello ');
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});
it('allows busy drafts, inserts at the selection and passes local files through', () => {
  const stop = vi.fn(),
    files = vi.fn(),
    submit = vi.fn(),
    ref = React.createRef<MessageComposerHandle>();
  renderWithUi(
    <MessageComposer
      aria-label="Draft"
      defaultValue="abc"
      ref={ref}
      busy
      onSubmit={submit}
      onStop={stop}
      onPasteFiles={files}
      onDropFiles={files}
    />
  );
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  input.setSelectionRange(1, 2);
  act(() => ref.current?.insertText('X'));
  expect(input).toHaveValue('aXc');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  expect(stop).toHaveBeenCalledOnce();
  const file = new File(['notes'], 'notes.txt');
  fireEvent.paste(input, { clipboardData: { files: [file] } });
  fireEvent.drop(input, { dataTransfer: { files: [file] } });
  expect(files.mock.calls).toEqual([[[file]], [[file]]]);
  act(() => ref.current?.clear());
  expect(input).toHaveValue('');
});
