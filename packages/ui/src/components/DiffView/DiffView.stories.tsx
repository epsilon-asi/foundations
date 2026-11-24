import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiffView } from './DiffView';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/DiffView',
  component: DiffView,
  args: { oldValue: 'First line\nOld value\n', newValue: 'First line\nNew value\n', filename: 'notes.txt' },
  play: checkStoryLayout
} satisfies Meta<typeof DiffView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Split: Story = { args: { view: 'split' } };
export const Words: Story = { args: { wordDiff: true } };
export const Truncated: Story = { args: { maxLines: 1 } };
export const CollapsedContext: Story = { args: { contextLines: 0 } };
export const Malformed: Story = {
  args: { patch: 'Incomplete header', oldValue: undefined, newValue: undefined, filename: undefined }
};
export const LongContent: Story = { args: { oldValue: longLabel, newValue: longLabel + ' revised' } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { oldValue: longLabel, newValue: longLabel + ' revised' }
};
export const Dark: Story = { decorators: [withDarkUi] };
