import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ShortcutHint } from '../Keycap';
import { ContextMenu } from './ContextMenu';

const items = [{ id: 'open', label: 'Open' }, { id: 'copy', label: <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>Copy<ShortcutHint keys={['Ctrl', 'C']} label="Control plus C" /></Box> }, { id: 'delete', label: 'Delete', disabled: true }];
const meta = { title: 'Components/ContextMenu', component: ContextMenu,
  args: { 'aria-label': 'Asset actions', items, children: 'Right-click here, or focus this region and press Shift+F10.' },
  render: function Example(args) { const [action, setAction] = useState(''); return <><ContextMenu {...args} onItemClick={item => setAction(item.id)} sx={{ p: 3, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1 }} /><Typography role="status">{action}</Typography></>; },
  play: checkStoryLayout
} satisfies Meta<typeof ContextMenu>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { items: [], menuProps: { header: 'No actions available' } } };
export const Checkable: Story = { args: { items: [{ id: 'grid', label: 'Show grid', checked: true }, { id: 'rulers', label: 'Show rulers', checked: false }], menuProps: { closeOnClick: false } } };
export const LongContent: Story = { args: { items: [{ id: 'download', label: 'Download all selected original assets with metadata and generation settings' }] } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const KeyboardAndDismissal: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body); const region = canvas.getByLabelText('Asset actions');
  region.focus(); await userEvent.keyboard('{Shift>}{F10}{/Shift}'); await waitFor(() => expect(body.getByRole('menu')).toBeVisible());
  await expect(body.getByRole('menuitem', { name: 'Open' })).toHaveFocus(); await userEvent.keyboard('{Escape}');
  await waitFor(() => expect(body.queryByRole('menu')).not.toBeInTheDocument()); await expect(region).toHaveFocus(); await checkStoryLayout({ canvasElement });
} };
export const Open: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body); canvas.getByLabelText('Asset actions').focus();
  await userEvent.keyboard('{Shift>}{F10}{/Shift}'); await waitFor(() => expect(body.getByRole('menu')).toBeVisible());
  await checkStoryLayout({ canvasElement: body.getByRole('menu'), markChecked: false }); await checkStoryLayout({ canvasElement });
} };
export const DarkOpen: Story = { decorators: [withDarkUi], play: Open.play };
