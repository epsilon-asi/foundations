import type { Meta, StoryObj } from '@storybook/react-vite';
import { DecisionCard } from './DecisionCard';

import { narrowConversation, longLabel, choices } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/DecisionCard',
  component: DecisionCard,
  args: {
    title: 'Save this revision?',
    actions: choices,
    onDecision: () => {},
    description: 'The document will be available to the team.'
  },
  play: checkStoryLayout
} satisfies Meta<typeof DecisionCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Info: Story = { args: { tone: 'info' } };
export const Danger: Story = { args: { tone: 'danger' } };
export const Neutral: Story = { args: { tone: 'neutral' } };
export const Busy: Story = { args: { busy: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Resolved: Story = { args: { resolution: { actionId: 'save', label: 'Saved', at: 0 } } };
export const Failure: Story = {
  args: {
    onDecision: async () => {
      throw new Error('Could not save.');
    }
  }
};
export const LongContent: Story = { args: { title: longLabel, description: longLabel } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { title: longLabel, description: longLabel }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Request changes' }));
    await expect(canvas.getByRole('textbox', { name: /Reason/ })).toBeVisible();
    await checkStoryLayout({ canvasElement });
  }
};
