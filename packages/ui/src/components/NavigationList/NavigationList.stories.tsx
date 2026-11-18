import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { Home, Folder, Assessment, Settings } from '@mui/icons-material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { StatusBadge } from '../StatusBadge';
import { NavigationList, type NavigationItem } from './NavigationList';

const sample: NavigationItem[] = [
  { id: 'home', label: 'Overview', href: '#overview', icon: <Home /> },
  { id: 'library', label: 'Library', icon: <Folder />, children: [
    { id: 'assets', label: 'Assets', href: '#assets', badge: <StatusBadge label="12" tone="info" indicator={false} /> },
    { id: 'collections', label: 'Collections', children: [{ id: 'characters', label: 'Characters', href: '#characters' }, { id: 'environments', label: 'Environments', href: '#environments' }] },
    { id: 'archived', label: 'Archived', href: '#archived', disabled: true, disabledReason: 'Owner access required' }
  ] },
  { id: 'reports', label: 'Reports', href: '#reports', icon: <Assessment />, children: [{ id: 'weekly', label: 'Weekly summary', href: '#weekly' }] },
  { id: 'account', kind: 'section', label: 'Account', children: [{ id: 'settings', label: 'Settings', icon: <Settings /> }, { id: 'billing', label: 'Billing', href: '#billing', disabled: true, disabledReason: 'Owner access required' }] }
];
const meta = { title: 'Components/NavigationList', component: NavigationList, play: checkStoryLayout,
  args: { items: sample, value: 'assets', title: 'Studio' },
  decorators: [(Story) => <Box sx={{ maxWidth: 340 }}><Story /></Box>],
  render: function Example(args) { const [selected, setSelected] = useState(args.value);
    return <NavigationList {...args} value={selected} onSelect={(item, event) => { event.preventDefault(); args.onSelect?.(item, event); setSelected(item.id); }} />; }
} satisfies Meta<typeof NavigationList>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Compact: Story = { args: { density: 'compact' } };
export const AllExpanded: Story = { args: { defaultExpandedIds: ['library', 'collections', 'reports'] } };
export const RightToLeft: Story = { args: { dir: 'rtl' } };
export const Disabled: Story = { args: { disabled: true } };
export const Empty: Story = { args: { items: [], value: null } };
export const DescriptionsAndLongLabels: Story = { args: { value: 'long', items: [{ id: 'long', label: 'Character design explorations and production revisions', href: '#long', description: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', badge: <StatusBadge label="New" tone="info" /> },
  { id: 'nested', label: 'Production collections', children: [{ id: 'deep', label: 'A collection with an unusually long descriptive name', children: [{ id: 'leaf', label: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' }] }] }], defaultExpandedIds: ['nested', 'deep'] } };
export const CustomLinks: Story = { args: { renderLink: (props) => <a {...props} data-router-link="true" /> } };
export const ControlledExpansion: Story = { render: function Controlled(args) { const [expandedIds, setExpanded] = useState<string[]>([]); return <><NavigationList {...args} value={null} expandedIds={expandedIds} onExpandedChange={setExpanded} /><Typography variant="caption">Expanded: {expandedIds.join(', ') || 'none'}</Typography></>; } };
export const Dark: Story = { decorators: [withDarkUi] };
export const KeyboardAndSelection: Story = { args: { value: 'home', defaultExpandedIds: [] }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); canvas.getByRole('link', { name: 'Overview' }).focus();
  await userEvent.keyboard('{ArrowDown}'); await expect(canvas.getByRole('button', { name: 'Library' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}'); await expect(canvas.getByRole('link', { name: 'Assets 12' })).toHaveFocus();
  await userEvent.keyboard('{Enter}'); await expect(canvas.getByRole('link', { name: 'Assets 12' })).toHaveAttribute('aria-current', 'page');
  await userEvent.keyboard('{End}'); await expect(canvas.getByRole('button', { name: 'Settings' })).toHaveFocus();
  await checkStoryLayout({ canvasElement });
} };
