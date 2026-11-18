import { createRef } from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithUi } from '../../test/renderWithUi';
import { List, ListItem, ListItemButton, ListItemText } from './index';

it('forwards ordered-list attributes and refs to the native list and its rows', () => {
  const list = createRef<HTMLOListElement>();
  const row = createRef<HTMLLIElement>();
  renderWithUi(
    <List component="ol" ref={list} start={3} aria-label="Revisions">
      <ListItem ref={row}><ListItemText primary="Revised walk cycle" /></ListItem>
      <ListItem><ListItemText primary="Updated landing frame" /></ListItem>
    </List>
  );

  expect(screen.getByRole('list', { name: 'Revisions' })).toBe(list.current);
  expect(list.current?.tagName).toBe('OL');
  expect(list.current).toHaveAttribute('start', '3');
  const rows = within(list.current!).getAllByRole('listitem');
  expect(rows[0]).toBe(row.current);
  expect(rows.map(item => item.textContent)).toEqual(['Revised walk cycle', 'Updated landing frame']);
});

it('keeps the selected primary action and the independently named secondary action separate', () => {
  const select = vi.fn();
  const pin = vi.fn();
  const primaryRef = createRef<HTMLButtonElement>();
  renderWithUi(
    <List aria-label="Animations">
      <ListItem disablePadding secondaryAction={<button onClick={pin}>Pin walk cycle</button>}>
        <ListItemButton component="button" ref={primaryRef} selected aria-current="true" onClick={select}>
          <ListItemText primary="Walk cycle" />
        </ListItemButton>
      </ListItem>
    </List>
  );

  const row = within(screen.getByRole('list', { name: 'Animations' })).getByRole('listitem');
  const primary = within(row).getByRole('button', { name: 'Walk cycle', current: true });
  const secondary = within(row).getByRole('button', { name: 'Pin walk cycle' });
  expect(primary).toBe(primaryRef.current);
  expect(primary).toHaveClass('Mui-selected');
  expect(primary).not.toContainElement(secondary);
  fireEvent.click(secondary);
  expect(pin).toHaveBeenCalledTimes(1);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(primary);
  expect(select).toHaveBeenCalledTimes(1);
  expect(pin).toHaveBeenCalledTimes(1);
});
