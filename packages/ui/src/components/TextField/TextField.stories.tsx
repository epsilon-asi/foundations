import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  args: { label: 'Title', placeholder: 'Untitled' },
  play: checkStoryLayout
} satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'Draft' } };
export const Error: Story = { args: { error: 'A title is required.', required: true } };
export const Clearable: Story = { args: { clearable: true, defaultValue: 'Draft' } };
export const Count: Story = { args: { showCount: true, maxLength: 24, monospace: true } };
export const Adorned: Story = { args: { startAdornment: '◇', endAdornment: 'units' } };
export const LongContent: Story = { args: { defaultValue: longLabel, helperText: longLabel } };
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: { defaultValue: longLabel, helperText: longLabel }
};
export const Dark: Story = { decorators: [withDarkUi] };
