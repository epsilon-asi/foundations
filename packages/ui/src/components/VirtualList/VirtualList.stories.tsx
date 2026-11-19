import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { getVirtualKey, virtualRows, type VirtualRow } from '../../../.storybook/collectionExamples';
import { ActionButton } from '../ActionButton';
import { FileTypeIcon } from '../FileTypeIcon';
import { VirtualList, type VirtualListHandle, type VirtualListProps } from './VirtualList';

const renderVirtualItem: VirtualListProps<VirtualRow>['renderItem'] = item => item.label;

const meta = { title: 'Components/VirtualList', component: VirtualList<VirtualRow>, play: checkStoryLayout,
  args: { 'aria-label': 'Asset list', items: virtualRows, getItemKey: getVirtualKey, renderItem: renderVirtualItem, height: 240, itemHeight: 32 }
} satisfies Meta<typeof VirtualList<VirtualRow>>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const RichRows: Story = { args: { itemHeight: 40, renderItem: (item, state) => <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 2 }}><FileTypeIcon fileName={item.label} /><Typography noWrap variant="body2">{item.label}</Typography>{state.active ? <Typography variant="caption" color="text.secondary">Focused</Typography> : null}</Box> } };
export const Empty: Story = { args: { items: [] } };
export const DisabledRows: Story = { args: { isItemDisabled: item => Number(item.id) % 3 === 1 } };
export const AllDisabled: Story = { args: { isItemDisabled: () => true } };
export const OverscanZero: Story = { args: { overscan: 0 } };
export const TallRows: Story = { args: { itemHeight: 64, renderItem: item => <Box><Typography variant="subtitle2" component="div">{item.label}</Typography><Typography variant="caption">1024 × 768 · PNG · Revision 3</Typography></Box> } };
export const LongContent: Story = { args: { items: virtualRows.map(item => ({ ...item, label: `${item.label} — asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz` })) } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 220, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi], args: RichRows.args };
export const Resize: Story = { render: function Resize(args) { const [height, setHeight] = useState(160); return <Box sx={{ display: 'grid', gap: 2 }}><ActionButton onClick={() => setHeight(height === 160 ? 320 : 160)}>Change list height</ActionButton><VirtualList {...args} height={height} /></Box>; } };
export const InteractiveRows: Story = { args: { itemHeight: 48, renderItem: item => Number(item.id) % 10 === 0 ? <TextField label={`Name ${item.id}`} defaultValue={item.label} fullWidth /> : item.label } };
export const JumpToRow: Story = { render: function Jump(args) { const ref = useRef<VirtualListHandle>(null); return <Box sx={{ display: 'grid', gap: 2 }}><ActionButton onClick={() => ref.current?.focusIndex(9999)}>Focus last asset</ActionButton><VirtualList {...args} ref={ref} /></Box>; } };
export const KeyboardNavigation: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); canvas.getByText('Asset 1.png', { exact: true }).closest('li')!.focus();
  await userEvent.keyboard('{End}'); await waitFor(() => expect(canvas.getByText('Asset 10000.png').closest('li')).toHaveFocus());
  await expect(canvas.getAllByRole('listitem').length).toBeLessThan(25); await userEvent.keyboard('{Home}'); await expect(canvas.getByText('Asset 1.png', { exact: true }).closest('li')).toHaveFocus();
  await checkStoryLayout({ canvasElement });
} };
export const ReorderingWithFocusedControl: Story = { render: function Reordering(args) { const [items, setItems] = useState(args.items); return <VirtualList {...args} items={items} itemHeight={40}
  renderItem={item => item.id === '0' ? <ActionButton onClick={() => setItems([...items].reverse())}>Reverse order</ActionButton> : item.label} />; },
  play: async ({ canvasElement }) => { const canvas = within(canvasElement); const button = canvas.getByRole('button', { name: 'Reverse order' });
    await userEvent.click(button); await waitFor(() => expect(button).toHaveFocus()); await expect(button.closest('li')).toHaveAttribute('aria-posinset', '10000');
    await expect(canvas.getAllByRole('listitem').length).toBeLessThan(25); await checkStoryLayout({ canvasElement });
  }
};
