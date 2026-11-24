import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageComposer } from './MessageComposer';
import { Tag } from '../Tag';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/MessageComposer',
  component: MessageComposer,
  args: { 'aria-label': 'Write a message', onSubmit: () => {}, placeholder: 'Write a message' },
  play: checkStoryLayout
} satisfies Meta<typeof MessageComposer>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Busy: Story = { args: { busy: true, onStop: () => {}, status: 'Working' } };
export const Disabled: Story = { args: { disabled: true, disabledReason: 'Editing is paused' } };
export const ModifiedEnter: Story = {
  args: { submitOn: 'mod+enter', accentColor: 'iris', attachments: <Tag label="Notes.txt" /> }
};
export const LongContent: Story = { args: { defaultValue: longLabel.repeat(3), maxRows: 4 } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { defaultValue: longLabel.repeat(3), maxRows: 4 }
};
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await userEvent.type(input, 'Hello{Enter}');
    await expect(input).toHaveValue('');
    await checkStoryLayout({ canvasElement });
  }
};
