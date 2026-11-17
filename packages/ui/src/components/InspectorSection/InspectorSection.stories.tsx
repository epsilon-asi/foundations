import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { PropertyListItem } from '../PropertiesDisplayCard';
import { InspectorSection } from './InspectorSection';

const meta = {
  title: 'Components/InspectorSection', component: InspectorSection, play: checkStoryLayout,
  args: { title: 'Transform', children: <Box component="dl" sx={{ m: 0 }}>
    <PropertyListItem label="Position" value="12, 24" align="horizontal" /><PropertyListItem label="Rotation" value="0°" align="horizontal" />
    <PropertyListItem label="Scale" value="1×" align="horizontal" />
  </Box> }
} satisfies Meta<typeof InspectorSection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Collapsed: Story = { args: { defaultExpanded: false } };
export const KeepMounted: Story = { args: { keepMounted: true } };
export const Static: Story = { args: { collapsible: false } };
export const Comfortable: Story = { args: { density: 'comfortable' } };
export const WithAction: Story = { args: { headerAction: <ActionButton size="small" variant="text">Reset</ActionButton> } };
export const Controlled: Story = { args: { expanded: true }, render: function Example(args) {
  const [expanded, setExpanded] = useState(args.expanded);
  useEffect(() => setExpanded(args.expanded), [args.expanded]);
  return <InspectorSection {...args} expanded={expanded} onExpandedChange={(next) => { setExpanded(next); args.onExpandedChange?.(next); }} />;
} };
export const Stacked: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 1 }}>
  <InspectorSection {...args} /><InspectorSection title="Playback"><Typography>24 frames · 12 FPS · Looping</Typography></InspectorSection>
  <InspectorSection title="Generation settings" defaultExpanded={false}><Typography>Provider and model metadata</Typography></InspectorSection>
</Box> };
export const LongContent: Story = { args: { title: 'Transform and placement settings for the selected character sub-sprite',
  subtitle: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', headerAction: <ActionButton size="small">Reset transform</ActionButton> },
  decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const toggle = canvas.getByRole('button', { name: 'Transform' });
  await userEvent.click(toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.keyboard('{Enter}');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await checkStoryLayout({ canvasElement });
} };
