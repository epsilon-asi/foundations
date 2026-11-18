import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { InspectorSection } from '../InspectorSection';
import { Panel } from '../Panel';
import { SplitPane } from './SplitPane';

const meta = { title: 'Components/SplitPane', component: SplitPane, play: checkStoryLayout,
  args: { defaultSize: 240, minSize: 80, minSecondSize: 120, firstLabel: 'Assets', secondLabel: 'Preview', resizeLabel: 'Resize asset panel',
    children: [<Panel key="first" title="Assets" role="group" density="compact" sx={{ height: '100%', borderRadius: 0 }}>
      <Typography variant="body2">Forest guardian</Typography><Typography variant="body2">Moonlit clearing</Typography>
    </Panel>, <Panel key="second" title="Preview" role="group" density="compact" sx={{ height: '100%', borderRadius: 0 }}>
      <Typography variant="body2">Drag the divider or use the arrow keys. Shift resizes in larger steps; Home and End move to the limits.</Typography>
    </Panel>] },
  decorators: [(Story) => <Box sx={{ width: '100%', height: 380, minWidth: 0 }}><Story /></Box>]
} satisfies Meta<typeof SplitPane>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Vertical: Story = { args: { orientation: 'vertical', defaultSize: 160, minSize: 80, minSecondSize: 100 } };
export const Disabled: Story = { args: { disabled: true } };
export const Constrained: Story = { args: { minSize: 160, maxSize: 320, minSecondSize: 120 } };
export const CustomKeyboardStep: Story = { args: { keyboardStep: 25 } };
export const RightToLeft: Story = { args: { dir: 'rtl' } };
export const Narrow: Story = { decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%', height: '100%' }}><Story /></Box>] };
export const Controlled: Story = { args: { size: 240 }, render: function Example(args) {
  const [size, setSize] = useState(args.size);
  useEffect(() => setSize(args.size), [args.size]);
  return <SplitPane {...args} size={size} onSizeChange={(next, reason) => { setSize(next); args.onSizeChange?.(next, reason); }} />;
} };
export const WithInspector: Story = { args: { children: [
  <Box key="first" sx={{ p: 1, display: 'grid', gap: 1 }}><InspectorSection title="Transform">Position: 12, 24</InspectorSection>
    <InspectorSection title="Playback">24 frames · 12 FPS</InspectorSection><InspectorSection title="History" defaultExpanded={false}>Revision 3</InspectorSection></Box>,
  <Box key="second" sx={{ p: 2, bgcolor: 'action.hover', height: '100%' }}><Typography>Selected asset preview</Typography></Box>
] } };
export const LongContent: Story = { args: { children: [
  <Box key="first" sx={{ p: 2 }}>asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz</Box>,
  <Box key="second" sx={{ p: 2, display: 'grid', gap: 2 }}>{Array.from({ length: 30 }, (_, index) => <Typography key={index}>Revision {index + 1}: Metadata for the selected asset.</Typography>)}</Box>
] } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const separator = canvas.getByRole('separator', { name: 'Resize asset panel' });
  await userEvent.click(separator);
  await userEvent.keyboard('{Home}');
  await expect(separator).toHaveAttribute('aria-valuenow', separator.getAttribute('aria-valuemin'));
  await userEvent.keyboard('{End}');
  await expect(separator).toHaveAttribute('aria-valuenow', separator.getAttribute('aria-valuemax'));
  await checkStoryLayout({ canvasElement });
} };
