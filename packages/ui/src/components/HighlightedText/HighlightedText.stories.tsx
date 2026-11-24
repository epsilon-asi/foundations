import type { Meta, StoryObj } from '@storybook/react-vite';
import { HighlightedText } from './HighlightedText';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/HighlightedText',
  component: HighlightedText,
  args: { text: 'Find the draft document', query: 'draft' },
  play: checkStoryLayout
} satisfies Meta<typeof HighlightedText>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Ranges: Story = {
  args: {
    ranges: [
      [0, 4],
      [9, 14]
    ]
  }
};
export const CaseSensitive: Story = { args: { query: ['Draft', 'Find'], caseSensitive: true } };
export const LongContent: Story = { args: { text: longLabel, query: 'revision', snippet: { maxLength: 34 } } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { text: longLabel, query: 'revision', snippet: { maxLength: 34 } }
};
export const Dark: Story = { decorators: [withDarkUi] };
