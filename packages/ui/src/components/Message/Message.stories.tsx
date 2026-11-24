import type { Meta, StoryObj } from '@storybook/react-vite';
import { Message } from './Message';
import { ActionButton } from '../ActionButton';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Message',
  component: Message,
  args: { role: 'assistant', author: 'Editor', children: 'The document is ready.' },
  play: checkStoryLayout
} satisfies Meta<typeof Message>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Outgoing: Story = { args: { role: 'user' } };
export const System: Story = { args: { role: 'system', variant: 'plain' } };
export const Notice: Story = { args: { role: 'notice', author: 'Update', children: 'Stopped' } };
export const Streaming: Story = { args: { status: 'streaming' } };
export const Complete: Story = { args: { status: 'complete', timestamp: 0, footer: 'Saved' } };
export const Stopped: Story = { args: { status: 'stopped' } };
export const Error: Story = { args: { status: 'error', error: 'Unable to save', onRetry: () => {} } };
export const Highlighted: Story = {
  args: { highlighted: true, accentColor: 'plum', actions: <ActionButton>Edit</ActionButton> }
};
export const LongContent: Story = { args: { children: longLabel.repeat(4), author: longLabel } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { children: longLabel.repeat(4), author: longLabel }
};
export const Dark: Story = { decorators: [withDarkUi] };
