import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip } from './Tooltip';
import { ActionButton } from '../ActionButton';
import { narrowConversation, longLabel } from '../../../.storybook/conversationExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: { title: 'Document information', children: <ActionButton>Details</ActionButton> },
  play: checkStoryLayout
} satisfies Meta<typeof Tooltip>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const DisabledControl: Story = { args: { children: <ActionButton disabled>Unavailable</ActionButton> } };
export const Disabled: Story = { args: { disabled: true } };
export const Description: Story = { args: { describeChild: true } };
export const LongContent: Story = { args: { title: longLabel } };
export const Narrow: Story = { decorators: [narrowConversation], args: { title: longLabel } };
export const Dark: Story = { decorators: [withDarkUi] };
