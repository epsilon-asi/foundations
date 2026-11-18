import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { controlContainer, withRtlUi } from '../../../.storybook/controlExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Slider } from './Slider';
const meta = { title: 'Components/Slider', component: Slider, play: checkStoryLayout,
  args: { label: 'Opacity', defaultValue: 60, helperText: 'Adjust the opacity percentage.', valueLabelDisplay: 'auto', onChange: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof Slider>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Marks: Story = { args: { marks: [{ value: 0, label: 'Transparent' }, { value: 50, label: 'Half' }, { value: 100, label: 'Opaque' }], step: 10 } };
export const Small: Story = { args: { size: 'small' } };
export const Disabled: Story = { args: { disabled: true } };
export const Vertical: Story = { args: { orientation: 'vertical', marks: [{ value: 0, label: '0%' }, { value: 100, label: '100%' }] } };
export const Error: Story = { args: { error: true, helperText: 'Choose an opacity between 20 and 80 percent.', min: 20, max: 80 } };
export const Narrow: Story = { ...Marks, decorators: [(Story) => <Box sx={{ width: 220, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { ...Marks, decorators: [withDarkUi] };
export const RightToLeft: Story = { ...Marks, decorators: [withRtlUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const input = within(canvasElement).getByRole('slider'); input.focus(); await userEvent.keyboard('{Home}{ArrowUp}'); await expect(input).toHaveValue('1');
  await userEvent.keyboard('{End}'); await expect(input).toHaveValue('100'); await checkStoryLayout({ canvasElement });
} };
