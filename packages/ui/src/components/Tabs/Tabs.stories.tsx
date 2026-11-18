import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField } from '@mui/material';
import { expect, fn, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Tabs } from './Tabs';

const meta = {
  title: 'Components/Tabs', component: Tabs, play: checkStoryLayout,
  args: { value: 'generate', onChange: fn(), 'aria-label': 'Asset workflow', tabs: [
    { id: 'generate', label: 'Generate', content: 'Choose how to create your next asset.' },
    { id: 'edit', label: 'Edit', content: 'Refine the selected asset.' },
    { id: 'assemble', label: 'Assemble', content: 'Combine the finished parts.' }
  ] },
  render: function Example(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return <Tabs {...args} value={value} onChange={(next, event) => { setValue(next); args.onChange?.(next, event); }} />;
  }
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Compact: Story = { args: { density: 'compact' } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const FullWidth: Story = { args: { variant: 'fullWidth' } };
export const Standard: Story = { args: { variant: 'standard' } };
export const WithIcons: Story = { args: { tabs: [
  { id: 'generate', label: 'Generate', icon: <span aria-hidden>✦</span>, content: 'Generation settings' },
  { id: 'edit', label: 'Edit', icon: <span aria-hidden>✎</span>, content: 'Edit tools' }
] } };
export const DisabledTab: Story = { args: { tabs: [
  { id: 'generate', label: 'Generate', content: 'Generation settings' },
  { id: 'edit', label: 'Edit', disabled: true, disabledReason: 'Select an asset to edit' },
  { id: 'assemble', label: 'Assemble', content: 'Assembly settings' }
] } };
export const AllDisabled: Story = { args: { value: false, tabs: [
  { id: 'generate', label: 'Generate', disabled: true }, { id: 'edit', label: 'Edit', disabled: true }
] } };
export const NoSelection: Story = { args: { value: false } };
export const Empty: Story = { args: { tabs: [], value: false } };
export const ManyTabs: Story = { args: { value: 'tab-0', tabs: Array.from({ length: 12 }, (_, index) =>
  ({ id: `tab-${index}`, label: `Collection ${index + 1}`, content: `Contents of collection ${index + 1}` })) } };
export const LongLabels: Story = { args: { value: 'generate', tabs: [
  { id: 'generate', label: 'Generate original character concepts', content: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' },
  { id: 'edit', label: 'Edit the selected character animation', content: 'Edit settings' }
] }, decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const RetainedPanelState: Story = { args: { keepMounted: true, tabs: [
  { id: 'generate', label: 'Generate', content: <TextField label="Prompt" defaultValue="A moonlit forest" fullWidth multiline /> },
  { id: 'edit', label: 'Edit', content: 'Switch back to find your prompt preserved.' }
] } };
export const FollowFocus: Story = { args: { selectionFollowsFocus: true } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('tab', { name: 'Generate' }));
  await userEvent.keyboard('{ArrowRight}');
  await expect(canvas.getByRole('tab', { name: 'Edit' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect(canvas.getByRole('tabpanel', { name: 'Edit' })).toBeVisible();
  await checkStoryLayout({ canvasElement });
} };

export const Comfortable: Story = { args: { density: 'comfortable' } };
