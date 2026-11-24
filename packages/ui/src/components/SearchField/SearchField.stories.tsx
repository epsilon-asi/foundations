import type { Meta, StoryObj } from '@storybook/react-vite';
import { SearchField } from './SearchField';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/SearchField',
  component: SearchField,
  args: { 'aria-label': 'Search documents', placeholder: 'Find a document' },
  play: checkStoryLayout
} satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Results: Story = { args: { resultsLabel: '12 results', defaultValue: 'Draft' } };
export const Shortcut: Story = { args: { shortcut: 'Ctrl+K' } };
export const LongContent: Story = { args: { defaultValue: longLabel, resultsLabel: longLabel } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { defaultValue: longLabel, resultsLabel: longLabel }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('searchbox');
    await userEvent.type(input, 'draft{Escape}');
    await expect(input).toHaveValue('');
    await checkStoryLayout({ canvasElement });
  }
};
