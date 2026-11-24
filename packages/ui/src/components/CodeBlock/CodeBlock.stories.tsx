import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock } from './CodeBlock';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

import { expect, userEvent, within } from 'storybook/test';
const meta = {
  title: 'Components/CodeBlock',
  component: CodeBlock,
  args: { title: 'Example', language: 'ts', code: 'const count = 2;\nconst next = count + 1;' },
  play: checkStoryLayout
} satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Collapsed: Story = { args: { collapsedLines: 1 } };
export const Numbered: Story = { args: { showLineNumbers: true, highlightLines: [2] } };
export const Wrapped: Story = { args: { defaultWrap: true } };
export const Streaming: Story = { args: { streaming: true } };
export const Plain: Story = { args: { language: 'unknown', copyable: false } };
export const LongContent: Story = { args: { code: longLabel.repeat(6) } };
export const Narrow: Story = { decorators: [narrowConversation], args: { code: longLabel.repeat(6) } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('button', { name: 'Wrap' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await checkStoryLayout({ canvasElement });
  }
};
