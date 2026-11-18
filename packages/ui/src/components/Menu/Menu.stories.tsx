import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Stack, Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { defaultMenuItems, defaultMenuActions, openMenu, useMenuExample } from '../../../.storybook/menuExamples';
import { Menu, type MenuProps } from './Menu';

function ControlledMenuExample(args: MenuProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const { message, ...items } = useMenuExample(args.items, args.actions, args.onItemClick);
  return <Stack spacing={2} alignItems="flex-start">
    <Button id={`${id}-trigger`} variant="outlined" aria-haspopup="menu" aria-expanded={Boolean(anchor)}
      aria-controls={anchor ? `${id}-menu` : undefined}
      onClick={(event) => setAnchor(event.currentTarget)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setAnchor(event.currentTarget); } }}>
      Workspace actions
    </Button>
    <Menu {...args} {...items} id={`${id}-menu`} labelledBy={`${id}-trigger`} anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} />
    <Typography role="status">{message}</Typography>
  </Stack>;
}

const meta = {
  play: checkStoryLayout,
  title: 'Components/Menu', component: Menu,
  parameters: { layout: 'fullscreen' },
  args: { items: defaultMenuItems, actions: defaultMenuActions, open: false, header: 'Workspace' },
  argTypes: { anchorEl: { control: false }, open: { control: false } },
  render: (args) => <ControlledMenuExample {...args} />
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const KeepOpen: Story = { args: { closeOnClick: false } };
export const Dark: Story = { decorators: [withDarkUi] };

export const Open: Story = { play: openMenu };
export const Empty: Story = { args: { items: [], actions: [], header: 'No actions available' }, play: openMenu };
export const AllDisabled: Story = { args: { items: defaultMenuItems.map((item) => ({ ...item, disabled: true })), actions: [] }, play: openMenu };
export const CheckedAndSelected: Story = { args: { closeOnClick: false, items: [{ id: 'checked', label: 'Pinned', checked: true }, { id: 'unchecked', label: 'Notifications', checked: false }, { id: 'selected', label: 'Current workspace', selected: true }] }, play: openMenu };
export const WithIcons: Story = { args: { items: defaultMenuItems.map((item) => ({ ...item, icon: <span>✦</span> })) }, play: openMenu };
export const WithoutHeaderOrFooter: Story = { args: { header: undefined, actions: [] }, play: openMenu };
export const LongLabels: Story = { args: { items: [{ id: 'long', label: 'Open the shared workspace and review the latest research from all teams' }, { id: 'identifier', label: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' }] }, play: openMenu };
export const Scrollable: Story = { args: { items: Array.from({ length: 24 }, (_, index) => ({ id: String(index), label: `Workspace ${index + 1}` })) }, play: openMenu };
export const DarkOpen: Story = { decorators: [withDarkUi], play: openMenu };
