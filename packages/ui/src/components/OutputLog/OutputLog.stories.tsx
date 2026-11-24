import type { Meta, StoryObj } from '@storybook/react-vite';
import { OutputLog } from './OutputLog';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/OutputLog',
  component: OutputLog,
  args: { 'aria-label': 'Output', text: 'Started\nSaved\nFinished' },
  play: checkStoryLayout
} satisfies Meta<typeof OutputLog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Colors: Story = { args: { text: '\x1b[32mSaved\x1b[0m\n\x1b[91mFailed\x1b[0m' } };
export const Limited: Story = { args: { maxLines: 2, copyable: true } };
export const Empty: Story = { args: { text: '' } };
export const Chunks: Story = { args: { text: undefined, chunks: ['Start', 'ed\n', 'Finished'] } };
export const Manual: Story = { args: { follow: false, ansi: false } };
export const LongContent: Story = { args: { text: longLabel.repeat(12), wrap: true } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { text: longLabel.repeat(12), wrap: true }
};
export const Dark: Story = { decorators: [withDarkUi] };
