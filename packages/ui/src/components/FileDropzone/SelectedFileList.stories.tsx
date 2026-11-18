import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { controlContainer } from '../../../.storybook/controlExamples';
import { exampleFiles } from '../../../.storybook/fileExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { SelectedFileList } from './SelectedFileList';
const meta = { title: 'Components/SelectedFileList', component: SelectedFileList, play: checkStoryLayout,
  args: { files: exampleFiles(), onRemove: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof SelectedFileList>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithoutPreviews: Story = { args: { showPreviews: false } };
export const ReadOnly: Story = { args: { onRemove: undefined } };
export const Disabled: Story = { args: { disabled: true } };
export const Dark: Story = { decorators: [withDarkUi] };
