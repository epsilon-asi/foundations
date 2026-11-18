import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { treeItems } from '../../../.storybook/workbenchExamples';
import { UiProvider } from '../../theme';
import { TreeView } from './TreeView';

const meta = { title: 'Components/TreeView', component: TreeView, play: checkStoryLayout,
  args: { 'aria-label': 'Document layers', items: treeItems, defaultExpandedIds: ['document', 'foreground'], defaultSelectedIds: ['shapes'] }
} satisfies Meta<typeof TreeView>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Collapsed: Story = { args: { defaultExpandedIds: [] } };
export const MultiSelect: Story = { args: { multiSelect: true, defaultSelectedIds: ['shapes', 'background'] } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { items: [] } };
export const AllDisabled: Story = { args: { items: [{ id: 'a', label: 'No available layers', disabled: true }] } };
export const LongContent: Story = { args: { items: [{ id: 'root', label: 'A deeply nested collection of character concepts and environment reference assets', children: [{ id: 'nested', label: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' }] }], defaultExpandedIds: ['root'] } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 260, maxWidth: '100%' }}><Story /></Box>] };
export const Scrolling: Story = { args: { items: Array.from({ length: 60 }, (_, i) => ({ id: String(i), label: `Layer ${i + 1}` })), sx: { maxHeight: 240, overflow: 'auto' } } };
export const Controlled: Story = { render: function Controlled(args) { const [selected, setSelected] = useState<readonly string[]>(['shapes']); const [expanded, setExpanded] = useState<readonly string[]>(['document', 'foreground']);
  return <><TreeView {...args} selectedIds={selected} onSelectionChange={setSelected} expandedIds={expanded} onExpandedChange={setExpanded} /><Typography role="status">Selected: {selected.join(', ') || 'none'}</Typography></>;
} };
export const Visibility: Story = { render: function Visibility(args) { const [visible, setVisible] = useState(true); return <TreeView {...args}
  items={[{ id: 'layer', label: 'Sky', visible }, { id: 'locked', label: 'Locked layer', visible: false, disabled: true }]}
  onVisibilityChange={setVisible} />; } };
export const Rtl: Story = { decorators: [Story => <UiProvider themeOptions={{ direction: 'rtl' }}><Box dir="rtl"><Story /></Box></UiProvider>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = { args: { defaultExpandedIds: [], defaultSelectedIds: [] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const root = canvas.getByRole('treeitem', { name: 'Coastal study' });
  root.focus(); await userEvent.keyboard('{ArrowRight}{ArrowRight}'); await expect(canvas.getByRole('treeitem', { name: 'Foreground' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}{ArrowRight} '); await expect(canvas.getByRole('treeitem', { name: 'Shapes' })).toHaveAttribute('aria-selected', 'true');
  await checkStoryLayout({ canvasElement });
} };
