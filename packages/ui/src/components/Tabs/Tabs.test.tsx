import { createRef, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { Tabs, type TabDefinition } from './Tabs';

const tabs: TabDefinition[] = [
  { id: 'generate', label: 'Generate', content: <input aria-label="Prompt" defaultValue="Original" /> },
  { id: 'edit', label: 'Edit', disabled: true, disabledReason: 'Choose an asset first', content: 'Editor' },
  { id: 'assemble', label: 'Assemble', content: 'Assembly' }
];

it('links each tab to its named panel and leaves selection controlled', () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<Tabs tabs={tabs} value="generate" onChange={changed} aria-label="Workflow" />);
  const panel = screen.getByRole('tabpanel', { name: 'Generate' });
  const tab = screen.getByRole('tab', { name: 'Generate' });
  expect(tab).toHaveAttribute('aria-controls', panel.id);
  expect(panel).toHaveAttribute('aria-labelledby', tab.id);
  fireEvent.click(screen.getByRole('tab', { name: 'Assemble' }));
  expect(changed).toHaveBeenCalledWith('assemble', expect.anything());
  expect(tab).toHaveAttribute('aria-selected', 'true');
  rerender(<Tabs tabs={tabs} value="assemble" onChange={changed} />);
  expect(screen.getByRole('tabpanel', { name: 'Assemble' })).toHaveTextContent('Assembly');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('skips disabled tabs and supports arrows, Home, End and explicit keyboard selection', async () => {
  const changed = vi.fn();
  renderWithUi(<Tabs tabs={tabs} value="generate" onChange={changed} />);
  screen.getByRole('tab', { name: 'Generate' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Assemble' })).toHaveFocus();
  expect(changed).not.toHaveBeenCalled();
  await userEvent.keyboard('{Enter}');
  expect(changed).toHaveBeenCalledWith('assemble', expect.anything());
  await userEvent.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'Generate' })).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Assemble' })).toHaveFocus();
  fireEvent.click(screen.getByRole('tab', { name: 'Edit' }));
  expect(changed).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-description', 'Choose an asset first');
});

it('supports vertical navigation and selection following focus', async () => {
  const changed = vi.fn();
  renderWithUi(<Tabs tabs={tabs} value="generate" orientation="vertical" selectionFollowsFocus onChange={changed} />);
  screen.getByRole('tab', { name: 'Generate' }).focus();
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('tab', { name: 'Assemble' })).toHaveFocus();
  expect(changed).toHaveBeenCalledWith('assemble', expect.anything());
});

it('preserves panel state only when keepMounted is requested', () => {
  function Example() {
    const [value, setValue] = useState<string>('generate');
    return <Tabs tabs={tabs} value={value} onChange={setValue} keepMounted />;
  }
  renderWithUi(<Example />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Edited' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Assemble' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Generate' }));
  expect(screen.getByRole('textbox')).toHaveValue('Edited');
});

it('handles empty, missing and disabled selections without silently choosing a tab', () => {
  const changed = vi.fn();
  const { rerender } = renderWithUi(<Tabs tabs={[]} value={false} onChange={changed} />);
  expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  rerender(<Tabs tabs={tabs} value="missing" onChange={changed} />);
  expect(screen.getAllByRole('tab').every((tab) => tab.getAttribute('aria-selected') === 'false')).toBe(true);
  rerender(<Tabs tabs={tabs} value="edit" onChange={changed} />);
  expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
  expect(changed).not.toHaveBeenCalled();
});

it('generates unique associations across instances and forwards root refs and styles', () => {
  const ref = createRef<HTMLDivElement>();
  renderWithUi(<><Tabs ref={ref} data-testid="tabs" sx={[{ padding: '3px' }, { padding: '7px' }]}
    tabs={tabs} value="generate" onChange={vi.fn()} /><Tabs tabs={tabs} value="assemble" onChange={vi.fn()} /></>);
  expect(ref.current).toBe(screen.getByTestId('tabs'));
  expect(ref.current).toHaveStyle({ padding: '7px' });
  const ids = screen.getAllByRole('tab').map((tab) => tab.id);
  expect(new Set(ids).size).toBe(ids.length);
});
