import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { DataTable } from './DataTable';
import { CommandPalette } from '../CommandPalette';
it('reports sorting, activation and selection separately and leaves rows caller-owned', () => {
  const sort = vi.fn(),
    activate = vi.fn(),
    select = vi.fn();
  renderWithUi(
    <DataTable
      aria-label="Files"
      rows={['b', 'a']}
      getRowKey={(x) => x}
      columns={[{ id: 'name', header: 'Name', render: (x) => x, sortable: true }]}
      sort={{ columnId: 'name', direction: 'asc' }}
      onSortChange={sort}
      onRowActivate={activate}
      selectedKeys={['a']}
      onSelectionChange={select}
      rowActions={() => <button>Edit</button>}
    />
  );
  const table = screen.getByRole('table', { name: 'Files' });
  expect(within(table).getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending');
  fireEvent.click(within(table).getByRole('button', { name: /Name/ }));
  expect(sort).toHaveBeenCalledWith({ columnId: 'name', direction: 'desc' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select b' }));
  expect(select).toHaveBeenCalledWith(['a', 'b']);
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
  expect(activate).not.toHaveBeenCalled();
  fireEvent.keyDown(within(table).getAllByRole('row')[1], { key: 'Enter' });
  expect(activate).toHaveBeenCalledWith('b');
});
it('navigates enabled grouped options, filters keywords and reports local close reasons', () => {
  const select = vi.fn(),
    close = vi.fn();
  renderWithUi(
    <CommandPalette
      open
      items={[
        { id: 'a', title: 'Open', group: 'File' },
        { id: 'b', title: 'Delete', disabled: true },
        { id: 'c', title: 'Save', keywords: ['write'] }
      ]}
      onClose={close}
      onSelect={select}
    />
  );
  const input = screen.getByRole('combobox');
  expect(screen.getByRole('listbox')).toHaveAttribute('id', input.getAttribute('aria-controls'));
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Save' }).id);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
  expect(close).toHaveBeenCalledWith('itemClick');
  fireEvent.change(input, { target: { value: 'write' } });
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(close).toHaveBeenCalledWith('escapeKeyDown');
});

it('uses the combobox selection model for Home and End and skips disabled results', () => {
  const select = vi.fn(),
    close = vi.fn();
  renderWithUi(
    <CommandPalette
      open
      onSelect={select}
      onClose={close}
      items={[
        { id: 'one', title: 'First' },
        { id: 'two', title: 'Last enabled' },
        { id: 'three', title: 'Disabled', disabled: true }
      ]}
    />
  );
  const input = screen.getByRole('combobox');
  fireEvent.keyDown(input, { key: 'End' });
  expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Last enabled' }).id);
  fireEvent.keyDown(input, { key: 'Home' });
  expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'First' }).id);
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(select).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: 'one' }));
});
