import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from './Stack';
import { Tag } from '../Tag';
import { Text } from '../Text';
import { Divider } from '../Divider';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Stack',
  component: Stack,
  args: {
    children: (
      <>
        <Tag label="Draft" />
        <Tag label="Shared" />
      </>
    )
  },
  play: checkStoryLayout
} satisfies Meta<typeof Stack>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Row: Story = { args: { direction: 'row', wrap: true, align: 'center' } };
export const Divided: Story = { args: { divider: <Divider />, density: 'comfortable' } };
export const Inline: Story = { args: { direction: 'row', inline: true } };
export const LongContent: Story = {
  args: {
    children: (
      <>
        <Text>{longLabel}</Text>
        <Tag label="Draft" />
      </>
    )
  }
};
export const Narrow: Story = {
  decorators: [narrowConversation],
  args: {
    children: (
      <>
        <Text>{longLabel}</Text>
        <Tag label="Draft" />
      </>
    )
  }
};
export const Dark: Story = { decorators: [withDarkUi] };
