import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from './Box';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Box',
  component: Box,
  args: { children: 'Content', sx: { p: 2, bgcolor: 'background.paper' } },
  play: checkStoryLayout
} satisfies Meta<typeof Box>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Styled: Story = { args: { sx: { p: 3, border: 1, borderColor: 'divider' } } };
export const LongContent: Story = { args: { children: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { children: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
