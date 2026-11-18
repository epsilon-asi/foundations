import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { qualityOptions, controlContainer } from '../../../.storybook/controlExamples';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ChoiceCardGroup } from './ChoiceCardGroup';
const meta = { title: 'Components/ChoiceCardGroup', component: ChoiceCardGroup, play: checkStoryLayout,
  args: { label: 'Generation preset', options: qualityOptions, helperText: 'Select a preset for this asset.', onChange: fn() }, decorators: [controlContainer]
} satisfies Meta<typeof ChoiceCardGroup>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: 'balanced' } };
export const OneColumn: Story = { args: { columns: 1 } };
export const ThreeColumns: Story = { args: { columns: 3 } };
export const Disabled: Story = { args: { disabled: true, defaultValue: 'balanced' } };
export const ReadOnly: Story = { args: { readOnly: true, defaultValue: 'production' } };
export const LongContent: Story = { args: { options: [{ value: 'long', label: 'Detailed production artwork and complete character exploration', description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' }, { value: 'other', label: 'Environment studies', description: 'Explore composition, lighting and atmosphere for the upcoming release.' }] } };
export const RequiredError: Story = { args: { required: true, error: true, helperText: 'Choose a preset.' } };
export const Dark: Story = { args: { defaultValue: 'balanced' }, decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('radio', { name: 'Draft' }));
  await userEvent.keyboard('{ArrowRight}{ArrowRight}'); await expect(canvas.getByRole('radio', { name: 'Production' })).toBeChecked();
  await userEvent.keyboard('{ArrowRight}'); await expect(canvas.getByRole('radio', { name: 'Draft' })).toBeChecked(); await checkStoryLayout({ canvasElement });
} };
