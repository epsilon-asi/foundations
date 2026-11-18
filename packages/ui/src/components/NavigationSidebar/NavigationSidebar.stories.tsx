import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { Home, Folder, Settings } from '@mui/icons-material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { StatusBadge } from '../StatusBadge';
import { NavigationSidebar } from './NavigationSidebar';

const meta = { title: 'Components/NavigationSidebar', component: NavigationSidebar, play: checkOverlayLayout,
  args: { title: 'Creative studio', open: true, closeButton: false, value: 'assets', header: <StatusBadge label="Team workspace" tone="info" />, footer: <ActionButton variant="text" fullWidth>Account settings</ActionButton>,
    items: [{ id: 'home', label: 'Overview', href: '#home', icon: <Home /> }, { id: 'library', label: 'Library', icon: <Folder />, children: [{ id: 'assets', label: 'Assets', href: '#assets' }, { id: 'collections', label: 'Collections', href: '#collections' }] },
      { id: 'settings', label: 'Settings', icon: <Settings /> }, { id: 'billing', label: 'Billing', disabled: true, href: '#billing' }] },
  render: function Example(args) { const [open, setOpen] = useState(args.open); const [value, setValue] = useState(args.value); const [reason, setReason] = useState('');
    useEffect(() => setOpen(args.open), [args.open]);
    return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {args.variant === 'temporary' ? <ActionButton sx={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Open navigation</ActionButton> : null}
      <Box sx={{ height: 480, display: 'flex', justifyContent: args.anchor === 'right' ? 'flex-end' : 'flex-start', minWidth: 0 }}><NavigationSidebar {...args} open={open} value={value}
        onSelect={(item, event) => { event.preventDefault(); args.onSelect?.(item, event); setValue(item.id); }}
        onClose={(event, why) => { args.onClose?.(event, why); setOpen(false); setReason(`Closed: ${why}`); }} /></Box>
      <Typography role="status">{reason || `Selected: ${value}`}</Typography>
    </Box>;
  }
} satisfies Meta<typeof NavigationSidebar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Right: Story = { args: { anchor: 'right' } };
export const Persistent: Story = { args: { variant: 'persistent' } };
export const Temporary: Story = { args: { variant: 'temporary', closeButton: true } };
export const TemporaryRight: Story = { args: { variant: 'temporary', anchor: 'right', closeButton: true } };
export const KeepOpenOnSelect: Story = { args: { variant: 'temporary', closeButton: true, closeOnSelect: false } };
export const Busy: Story = { args: { variant: 'temporary', closeButton: true, busy: true, footer: <ActionButton loading fullWidth>Updating workspace</ActionButton> } };
export const Compact: Story = { args: { width: 240, navigationProps: { density: 'compact' } } };
export const Empty: Story = { args: { items: [] } };
export const Scrolling: Story = { args: { items: Array.from({ length: 35 }, (_, id) => ({ id: `${id}`, label: `Collection ${id + 1}`, href: `#collection-${id}` })) } };
export const LongLabels: Story = { args: { title: 'Character design and production workspace', header: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', width: 280,
  items: [{ id: 'long', label: 'Creative asset collections and production revision history', href: '#long', description: 'Everything your team needs to prepare the next release.' }],
  footer: <ActionButton fullWidth>Manage all workspace settings</ActionButton> } };
export const Dark: Story = { decorators: [withDarkUi] };
export const KeyboardAndDismissal: Story = { args: { variant: 'temporary', open: false, closeButton: true }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Open navigation' }));
  await waitFor(() => expect(body.getByRole('dialog')).toBeVisible()); await checkOverlayLayout({ canvasElement, markChecked: false });
  await userEvent.keyboard('{Escape}'); await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('button', { name: 'Open navigation' })).toHaveFocus();
  await userEvent.click(canvas.getByRole('button', { name: 'Open navigation' }));
  await userEvent.click(body.getByRole('button', { name: 'Settings' }));
  await waitFor(() => expect(body.queryByRole('dialog')).not.toBeInTheDocument());
  await expect(canvas.getByRole('status')).toHaveTextContent('Closed: itemSelect'); await checkOverlayLayout({ canvasElement });
} };
