import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreamingIndicator } from './StreamingIndicator';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/StreamingIndicator',
  component: StreamingIndicator,
  args: { label: 'Updating' },
  play: checkStoryLayout
} satisfies Meta<typeof StreamingIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Medium: Story = { args: { size: 'md' } };
export const LongContent: Story = { args: { label: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { label: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
