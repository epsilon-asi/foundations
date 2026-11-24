import type { Meta, StoryObj } from '@storybook/react-vite';
import { InlineCode } from './CodeBlock';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/InlineCode',
  component: InlineCode,
  args: { children: 'count + 1' },
  play: checkStoryLayout
} satisfies Meta<typeof InlineCode>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const LongContent: Story = { args: { children: longLabel.repeat(2) } };
export const Narrow: Story = { decorators: [narrowConversation], args: { children: longLabel.repeat(2) } };
export const Dark: Story = { decorators: [withDarkUi] };
