import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { getReorderId, getReorderLabel, isReorderLocked, reorderItems } from '../../../.storybook/collectionExamples';
import { FileTypeIcon } from '../FileTypeIcon';
import { ReorderableList } from './ReorderableList';

const meta = { title: 'Components/ReorderableList', component: ReorderableList<typeof reorderItems[number]>, play: checkStoryLayout,
  args: { 'aria-label': 'Layer order', items: reorderItems, getItemId: getReorderId, getItemLabel: getReorderLabel, isItemDisabled: isReorderLocked, onReorder: () => {} },
  render: function Example(args) { const [items, setItems] = useState(args.items); const [message, setMessage] = useState(''); useEffect(() => setItems(args.items), [args.items]);
    return <><ReorderableList {...args} items={items} onReorder={(next, details) => { setItems(next); setMessage(`${details.itemId}: position ${details.toIndex + 1}`); }} /><Typography role="status">{message}</Typography></>;
  }
} satisfies Meta<typeof ReorderableList<typeof reorderItems[number]>>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const RichRows: Story = { args: { renderItem: (item, state) => <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}><FileTypeIcon fileName={item.label} /><Box sx={{ minWidth: 0 }}><Typography variant="body2">{item.label}</Typography><Typography variant="caption" color="text.secondary">{state.disabled ? 'Locked in place' : 'Drag or use keyboard controls'}</Typography></Box></Box> } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { items: [] } };
export const SingleItem: Story = { args: { items: reorderItems.slice(0, 1) } };
export const AllLocked: Story = { args: { isItemDisabled: () => true } };
export const LongContent: Story = { args: { items: [{ id: 'long', label: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' }, ...reorderItems] } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 260, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi], args: RichRows.args };
export const KeyboardReorder: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const handle = canvas.getByRole('button', { name: 'Reorder Sky.png' });
  handle.focus(); await userEvent.keyboard(' {ArrowDown}{Enter}'); await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('Mountains.svg');
  await expect(canvas.getAllByRole('listitem')[1]).toHaveTextContent('Reference.pdf'); await expect(handle).toHaveFocus(); await checkStoryLayout({ canvasElement });
} };
export const CancelReorder: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByRole('button', { name: 'Reorder Sky.png' }).focus();
  await userEvent.keyboard(' {End}{Escape}'); await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('Sky.png'); await checkStoryLayout({ canvasElement });
} };
export const MoveButtons: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'Move Sky.png down' }));
  await expect(canvas.getAllByRole('listitem')[0]).toHaveTextContent('Mountains.svg'); await checkStoryLayout({ canvasElement });
} };
export const ScrollingKeyboard: Story = { args: { items: Array.from({ length: 40 }, (_, i) => ({ id: `layer-${i}`, label: `Layer ${i + 1}` })), sx: { maxHeight: 240, overflow: 'auto' } },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); const handle = canvas.getByRole('button', { name: 'Reorder Layer 1' }); const list = canvas.getByRole('list', { name: 'Layer order' });
    handle.focus(); await userEvent.keyboard(' {End}{Enter}'); await waitFor(() => expect(list.scrollTop).toBeGreaterThan(0));
    await expect(handle).toHaveFocus(); await expect(handle.getBoundingClientRect().bottom).toBeLessThanOrEqual(list.getBoundingClientRect().bottom + 2); await checkStoryLayout({ canvasElement });
  }
};
