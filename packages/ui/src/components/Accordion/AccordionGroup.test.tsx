import { createRef } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { AccordionGroup, type AccordionGroupItem } from './AccordionGroup';
import { Accordion } from './Accordion';

const items: AccordionGroupItem[] = [
  { id: 'details', title: 'Details', content: <input aria-label="Name" /> },
  { id: 'locked', title: 'Locked', disabled: true, content: 'Locked content' },
  { id: 'history', title: 'History', content: 'Revision 3' },
  { id: 'settings', title: 'Settings', content: 'Production settings' }
];
it('keeps one item open by default and allows collapsing the last open item', async () => {
  const changed = vi.fn(); renderWithUi(<AccordionGroup items={items} defaultExpandedIds={['details']} onExpandedChange={changed} />);
  expect(screen.getByRole('textbox')).toBeVisible(); await userEvent.click(screen.getByRole('button', { name: 'History' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument(); expect(screen.getByText('Revision 3')).toBeVisible();
  expect(changed).toHaveBeenLastCalledWith(['history'], 'history');
  await userEvent.click(screen.getByRole('button', { name: 'History' })); expect(changed).toHaveBeenLastCalledWith([], 'history');
});
it('supports multiple open items, controlled expansion and changing mode', async () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<AccordionGroup items={items} mode="multiple" expandedIds={['details', 'history']} onExpandedChange={changed} />);
  await userEvent.click(screen.getByRole('button', { name: 'Settings' })); expect(changed).toHaveBeenLastCalledWith(['details', 'history', 'settings'], 'settings');
  expect(screen.queryByText('Production settings')).not.toBeInTheDocument();
  rerender(<AccordionGroup items={items} mode="single" expandedIds={['details', 'history']} onExpandedChange={changed} />);
  expect(screen.getByRole('textbox')).toBeVisible(); expect(screen.queryByText('Revision 3')).not.toBeInTheDocument();
  expect(changed).toHaveBeenCalledTimes(1);
});
it('navigates available headers with Up/Down and Home/End, without opening them', async () => {
  const changed = vi.fn(); renderWithUi(<AccordionGroup items={items} onExpandedChange={changed} />);
  act(() => screen.getByRole('button', { name: 'Details' }).focus());
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
  await userEvent.keyboard('{End}'); expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
  await userEvent.keyboard('{ArrowUp}'); expect(screen.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await userEvent.keyboard('{Home}'); expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus(); expect(changed).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}'); expect(screen.getByRole('textbox')).toBeVisible();
});
it('leaves input editing, nested disclosures, nested groups and action keys alone', async () => {
  const changed = vi.fn();
  renderWithUi(<AccordionGroup onExpandedChange={changed} defaultExpandedIds={['outer']} items={[{ id: 'outer', title: 'Outer', content: <>
    <input aria-label="Name" /><Accordion title="Nested">Inner</Accordion><AccordionGroup items={[{ id: 'a', title: 'Nested A', content: 'A' }, { id: 'b', title: 'Nested B', content: 'B' }]} />
  </> }, { id: 'next', title: 'Next', content: 'Next content' }]} />);
  act(() => screen.getByRole('textbox').focus()); await userEvent.keyboard('{ArrowDown}{Home}'); expect(screen.getByRole('textbox')).toHaveFocus();
  act(() => screen.getByRole('button', { name: 'Nested' }).focus()); await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'Nested' })).toHaveFocus();
  act(() => screen.getByRole('button', { name: 'Nested A' }).focus()); await userEvent.keyboard('{ArrowDown}'); expect(screen.getByRole('button', { name: 'Nested B' })).toHaveFocus();
  expect(changed).not.toHaveBeenCalled();
});
it('does not toggle disabled items and supports disabling the whole group', async () => {
  const changed = vi.fn(); const { rerender } = renderWithUi(<AccordionGroup items={items} onExpandedChange={changed} />);
  fireEvent.click(screen.getByRole('button', { name: 'Locked' })); expect(changed).not.toHaveBeenCalled();
  rerender(<AccordionGroup items={items} disabled onExpandedChange={changed} />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Details' })); expect(changed).not.toHaveBeenCalled();
});
it('recovers focus when a focused item is removed, disabled or its focused body collapses', () => {
  const { rerender } = renderWithUi(<AccordionGroup items={items} expandedIds={['details']} />);
  act(() => screen.getByRole('textbox').focus()); rerender(<AccordionGroup items={items} expandedIds={['history']} />);
  expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
  rerender(<AccordionGroup items={items.filter((item) => item.id !== 'details')} />); expect(screen.getByRole('button', { name: 'History' })).toHaveFocus();
  rerender(<AccordionGroup items={items} disabled />); expect(screen.getByRole('group', { name: 'Accordion sections' })).toHaveFocus();
});
it('filters unknown/duplicate IDs and applies shared/item presentation and retention options', async () => {
  renderWithUi(<AccordionGroup items={items} mode="multiple" defaultExpandedIds={['missing', 'details', 'details', 'history']} keepMounted headingLevel="h2" density="compact" />);
  expect(screen.getByRole('textbox')).toBeVisible(); expect(screen.getByRole('heading', { name: 'Details', level: 2 })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Details' })); expect(screen.getByLabelText('Name')).not.toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'History' })); expect(screen.getByText('Revision 3')).not.toBeVisible();
});
it('keeps focus in an open body when only its header becomes disabled', () => {
  const { rerender } = renderWithUi(<AccordionGroup items={items} expandedIds={['details']} />);
  act(() => screen.getByRole('textbox').focus());
  rerender(<AccordionGroup items={items} expandedIds={['details']} disabled />);
  expect(screen.getByRole('textbox')).toHaveFocus(); expect(screen.getByRole('button', { name: 'Details' })).toBeDisabled();
});
it('recovers outer focus when an item containing a focused nested group is removed', () => {
  const nested = { id: 'nested', title: 'Nested sections', content: <AccordionGroup items={[{ id: 'inner', title: 'Inner section', content: 'Inner content' }]} /> };
  const { rerender } = renderWithUi(<AccordionGroup items={[nested, ...items]} defaultExpandedIds={['nested']} />);
  act(() => screen.getByRole('button', { name: 'Inner section' }).focus());
  rerender(<AccordionGroup items={items} />); expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
});
it('forwards refs/styles, respects caller keyboard cancellation and renders an empty group', () => {
  const ref = createRef<HTMLDivElement>(); const key = vi.fn((event) => event.preventDefault());
  const { rerender } = renderWithUi(<AccordionGroup ref={ref} items={items} sx={[{ padding: '2px' }, { padding: '5px' }]} onKeyDown={key} />);
  expect(ref.current).toBe(screen.getByRole('group', { name: 'Accordion sections' })); expect(ref.current).toHaveStyle({ padding: '5px' });
  act(() => screen.getByRole('button', { name: 'Details' }).focus()); fireEvent.keyDown(screen.getByRole('button', { name: 'Details' }), { key: 'ArrowDown' });
  expect(key).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus();
  rerender(<AccordionGroup items={[]} aria-label="Empty sections" />); expect(within(screen.getByRole('group', { name: 'Empty sections' })).queryByRole('button')).not.toBeInTheDocument();
});
