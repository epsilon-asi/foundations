import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { qualityOptions, controlContainer } from '../../../.storybook/controlExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { RadioGroup } from './RadioGroup';
const meta = { title: 'Components/RadioGroup', component: RadioGroup, play: checkStoryLayout,
  args: { label: 'Generation quality', options: qualityOptions, helperText: 'Choose one quality preset.', onChange: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof RadioGroup>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: 'balanced' } };
export const Row: Story = { args: { row: true, options: [{ value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }, { value: 'jpeg', label: 'JPEG' }] } };
export const NumericValues: Story = { args: { options: [{ value: 0, label: 'Automatic' }, { value: 24, label: '24 FPS' }, { value: 60, label: '60 FPS' }], defaultValue: 0 } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'balanced' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'balanced' } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Choose a quality preset before continuing.' } };
export const Dark: Story = { args: { defaultValue: 'balanced' }, decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('radio', { name: 'Draft' }));
  await userEvent.keyboard('{End}'); await expect(canvas.getByRole('radio', { name: 'Production' })).toBeChecked();
  await userEvent.keyboard('{Home}'); await expect(canvas.getByRole('radio', { name: 'Draft' })).toHaveFocus(); await checkStoryLayout({ canvasElement });
} };
