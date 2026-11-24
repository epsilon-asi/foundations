import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActivityGroup } from './ActivityItem';
import { ActivityItem } from '../ActivityItem';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/ActivityGroup',
  component: ActivityGroup,
  args: {
    label: '2 steps',
    children: (
      <>
        <ActivityItem title="Prepare" />
        <ActivityItem title="Save" />
      </>
    )
  },
  play: checkStoryLayout
} satisfies Meta<typeof ActivityGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Expanded: Story = { args: { defaultExpanded: true } };
export const LongContent: Story = { args: { label: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { label: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
