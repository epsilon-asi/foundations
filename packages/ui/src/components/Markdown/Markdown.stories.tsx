import type { Meta, StoryObj } from '@storybook/react-vite';
import { Markdown } from './Markdown';

import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Markdown',
  component: Markdown,
  args: { content: '# Notes\n\nA **short** paragraph with `inline code` and a [link](https://example.org).' },
  play: checkStoryLayout
} satisfies Meta<typeof Markdown>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Extended: Story = {
  args: { content: '| Name | State |\n| --- | --- |\n| Notes | ~~Draft~~ |\n\n- [x] Reviewed\n- [ ] Shared' }
};
export const Streaming: Story = { args: { streaming: true, content: 'Draft response\n\n```ts\nconst value = 1' } };
export const LiteralHtml: Story = { args: { content: '<b>Literal markup</b>' } };
export const LongContent: Story = { args: { content: longLabel.repeat(12) } };
export const Narrow: Story = { decorators: [narrowConversation], args: { content: longLabel.repeat(12) } };
export const Dark: Story = { decorators: [withDarkUi] };
