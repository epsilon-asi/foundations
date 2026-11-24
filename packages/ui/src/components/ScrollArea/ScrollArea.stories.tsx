import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from './ScrollArea';
import { Text } from '../Text';
import { Box } from '../Box';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/ScrollArea',
  component: ScrollArea,
  args: { 'aria-label': 'Notes', maxHeight: 96, children: <Text>{longLabel.repeat(12)}</Text> },
  play: checkStoryLayout
} satisfies Meta<typeof ScrollArea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Horizontal: Story = { args: { axis: 'x', children: <Box sx={{ width: 900 }}>Wide content</Box> } };
export const Both: Story = { args: { axis: 'both' } };
export const Fades: Story = { args: { fadeEdges: true } };
export const LongContent: Story = { args: { children: <Text>{longLabel.repeat(32)}</Text> } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { children: <Text>{longLabel.repeat(32)}</Text> }
};
export const Dark: Story = { decorators: [withDarkUi] };
