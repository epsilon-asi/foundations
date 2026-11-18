import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { controlContainer, withRtlUi } from '../../../.storybook/controlExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { RangeSlider } from './RangeSlider';
const meta = { title: 'Components/RangeSlider', component: RangeSlider, play: checkStoryLayout,
  args: { label: 'Frame range', defaultValue: [20, 80], helperText: 'Choose the start and end frames.', valueLabelDisplay: 'auto', onChange: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof RangeSlider>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Marks: Story = { args: { marks: [{ value: 0, label: 'First frame' }, { value: 50, label: 'Middle' }, { value: 100, label: 'Last frame' }], step: 5 } };
export const Disabled: Story = { args: { disabled: true } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const Error: Story = { args: { error: true, helperText: 'The selected range requires review.' } };
export const Dark: Story = { ...Marks, decorators: [withDarkUi] };
export const RightToLeft: Story = { ...Marks, decorators: [withRtlUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const minimum = canvas.getByRole('slider', { name: 'Frame range: Minimum' }); minimum.focus();
  await userEvent.keyboard('{Home}'); await expect(minimum).toHaveValue('0');
  const maximum = canvas.getByRole('slider', { name: 'Frame range: Maximum' }); maximum.focus(); await userEvent.keyboard('{End}'); await expect(maximum).toHaveValue('100');
  await checkStoryLayout({ canvasElement });
} };
