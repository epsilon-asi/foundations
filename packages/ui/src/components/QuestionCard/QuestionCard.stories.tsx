import type { Meta, StoryObj } from '@storybook/react-vite';
import { QuestionCard } from './QuestionCard';

import { narrowConversation, longLabel, questions } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/QuestionCard',
  component: QuestionCard,
  args: { title: 'Document settings', questions, onSubmit: () => {} },
  play: checkStoryLayout
} satisfies Meta<typeof QuestionCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Resolved: Story = {
  args: { resolution: { answers: { format: 'Text', sections: ['Overview', 'Details'] }, at: 0 } }
};
export const Busy: Story = { args: { busy: true } };
export const Disabled: Story = { args: { disabled: true } };
export const LongContent: Story = {
  args: { title: longLabel, questions: [{ ...questions[0], question: longLabel }] }
};
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { title: longLabel, questions: [{ ...questions[0], question: longLabel }] }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    await expect(canvas.getAllByRole('alert')).toHaveLength(2);
    await checkStoryLayout({ canvasElement });
  }
};
