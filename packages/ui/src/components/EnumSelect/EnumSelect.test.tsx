import { screen } from '@testing-library/react';
import { userEvent } from 'storybook/test';
import { renderWithUi } from '../../test/renderWithUi';
import { expectTypeOf } from 'vitest';
import { EnumSelect } from './EnumSelect';

enum Numeric { Off, Draft, Published = 5 }
enum StringEnum { InProgress = 'in_progress', Complete = 'complete' }
it('filters numeric enum reverse mappings and preserves numeric zero on selection', async () => {
  const change = vi.fn(); renderWithUi(<EnumSelect label="Stage" enumValues={Numeric} defaultValue={Numeric.Published} onChange={(value, event, reason) => {
    expectTypeOf(value).toEqualTypeOf<Numeric | null>(); change(value, event, reason);
  }} />);
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.queryByRole('option', { name: '0' })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Off' })); expect(change).toHaveBeenCalledExactlyOnceWith(0, expect.anything(), 'selectOption');
  expect(screen.getByRole('combobox')).toHaveValue('Off');
});
it('keeps labels valid when details omit them and exposes empty enum sources', async () => {
  const { rerender } = renderWithUi(<EnumSelect label="Stage" enumValues={StringEnum} getOptionDetails={() => ({ label: undefined })} />);
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getByRole('option', { name: 'In Progress' })).toBeInTheDocument();
  rerender(<EnumSelect label="Stage" enumValues={[]} />); expect(screen.getByRole('status')).toHaveTextContent('No matching options');
});
it('supports string enums, humanized labels and replacing option metadata/callbacks', async () => {
  const first = vi.fn(); const latest = vi.fn();
  const { rerender } = renderWithUi(<EnumSelect label="Stage" enumValues={StringEnum} onChange={first} />);
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getByRole('option', { name: 'In Progress' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('option', { name: 'Complete' })); expect(first).toHaveBeenCalledWith('complete', expect.anything(), 'selectOption');
  rerender(<EnumSelect label="Stage" enumValues={StringEnum} onChange={latest} getOptionDetails={(value) => ({
    label: value === StringEnum.InProgress ? 'Working' : 'Done', description: 'Updated description', disabled: value === StringEnum.Complete
  })} />);
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getByRole('option', { name: 'Done' })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('option', { name: 'Working' })).toHaveTextContent('Updated description');
  await userEvent.click(screen.getByRole('option', { name: 'Working' })); expect(latest).toHaveBeenCalledWith('in_progress', expect.anything(), 'selectOption');
});
it('supports literal arrays, const objects and aliases without duplicate options', async () => {
  const change = vi.fn();
  const { rerender } = renderWithUi(<EnumSelect label="Stage" enumValues={['in_progress', 'ready', 'ready'] as const} onChange={change} />);
  await userEvent.click(screen.getByRole('combobox')); expect(screen.getAllByRole('option')).toHaveLength(2);
  await userEvent.click(screen.getByRole('option', { name: 'In progress' })); expect(change).toHaveBeenCalledWith('in_progress', expect.anything(), 'selectOption');
  rerender(<EnumSelect label="Stage" enumValues={{ Automatic: '', Zero: 0, ZeroAlias: 0 } as const} value={0} />);
  expect(screen.getByRole('combobox')).toHaveValue('Zero'); await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getAllByRole('option')).toHaveLength(2); expect(screen.getByRole('option', { name: 'Automatic' })).toBeInTheDocument();
});
