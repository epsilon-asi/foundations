import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { defaultMenuItems, defaultMenuActions, openMenu, useMenuExample } from '../../../.storybook/menuExamples';
import { IconMenu, type IconMenuProps } from './IconMenu';

function IconExample(args: IconMenuProps) {
  const { message, ...menu } = useMenuExample(args.items, args.actions, args.onItemClick);
  return <Stack spacing={2} alignItems="flex-start"><IconMenu {...args} {...menu} /><Typography role="status">{message}</Typography></Stack>;
}

const meta = {
  play: checkStoryLayout,
  title: 'Components/IconMenu', component: IconMenu,
  parameters: { layout: 'fullscreen' },
  args: { 'aria-label': 'Workspace actions', items: defaultMenuItems, actions: defaultMenuActions, header: 'Workspace' },
  render: (args) => <IconExample {...args} />
} satisfies Meta<typeof IconMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Round: Story = { args: { variant: 'round', filled: true } };
export const KeepOpen: Story = { args: { closeOnClick: false } };
export const Disabled: Story = { args: { disabled: true } };
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

export const Borderless: Story = { args: { outlined: false } };
export const Small: Story = { args: { size: 'small' } };
export const Large: Story = { args: { size: 'large' } };
export const WithTooltip: Story = { args: { tooltip: 'Workspace actions' } };
export const CustomTrigger: Story = { args: { children: <span>✦</span>, color: 'secondary' } };
export const LeftAligned: Story = { args: { menuProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, transformOrigin: { vertical: 'top', horizontal: 'left' } } }, play: openMenu };
