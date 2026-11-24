import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextArea } from './TextArea';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/TextArea',
  component: TextArea,
  args: { label: 'Notes', placeholder: 'Add notes' },
  play: checkStoryLayout
} satisfies Meta<typeof TextArea>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Resizable: Story = { args: { resize: 'vertical' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'Archived' } };
export const Error: Story = { args: { error: 'Notes are required.' } };
export const LongContent: Story = { args: { defaultValue: longLabel.repeat(10), maxRows: 4 } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { defaultValue: longLabel.repeat(10), maxRows: 4 }
};
export const Dark: Story = { decorators: [withDarkUi] };
