import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityItem } from './ActivityItem';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/ActivityItem',
  component: ActivityItem,
  args: { title: 'Prepare document', children: 'Content is ready.' },
  play: checkStoryLayout
} satisfies Meta<typeof ActivityItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Pending: Story = { args: { status: 'pending' } };
export const Running: Story = { args: { status: 'running' } };
export const Success: Story = { args: { status: 'success' } };
export const Error: Story = { args: { status: 'error' } };
export const Declined: Story = { args: { status: 'declined' } };
export const Cancelled: Story = { args: { status: 'cancelled' } };
export const Expanded: Story = { args: { defaultExpanded: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Static: Story = { args: { children: undefined } };
export const LongContent: Story = { args: { title: longLabel, meta: '12 s', children: longLabel } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { title: longLabel, meta: '12 s', children: longLabel }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button');
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await checkStoryLayout({ canvasElement });
  }
};
