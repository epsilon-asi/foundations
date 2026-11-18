import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkSelectLayout, selectContainer } from '../../../.storybook/selectExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { StatusBadge } from '../StatusBadge';
import { EnumSelect } from './EnumSelect';

enum Workflow { Draft = 'draft', InReview = 'in_review', Approved = 'approved', Archived = 'archived' }
enum Quality { Draft, Standard, Production = 5 }
const meta = { title: 'Components/EnumSelect', component: EnumSelect, play: checkSelectLayout,
  args: { label: 'Workflow status', enumValues: Workflow, helperText: 'Enum values stay typed; labels can be customized.', onChange: fn() },
  decorators: [selectContainer]
} satisfies Meta<typeof EnumSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const StringEnum: Story = { args: { defaultOpen: true, defaultValue: Workflow.InReview } };
export const NumericEnum: Story = { args: { label: 'Quality', enumValues: Quality, defaultOpen: true, defaultValue: Quality.Draft, helperText: 'Numeric zero is a valid value. Reverse mappings are excluded.' } };
export const LiteralArray: Story = { args: { label: 'Output type', enumValues: ['concept_art', 'character_sheet', 'environment_study'] as const, defaultOpen: true } };
export const RichContext: Story = { args: { defaultOpen: true, getOptionDetails: (value) => ({
  description: value === Workflow.Draft ? 'Work in progress, visible to the creative team.' : value === Workflow.InReview ? 'Awaiting feedback from a reviewer.' : value === Workflow.Approved ? 'Ready for the production pipeline.' : 'Retained for reference only.',
  meta: <StatusBadge label={value === Workflow.Approved ? 'Ready' : value === Workflow.Archived ? 'Locked' : 'Active'} tone={value === Workflow.Approved ? 'success' : 'neutral'} />,
  disabled: value === Workflow.Archived, disabledReason: value === Workflow.Archived ? 'Archive from the project menu.' : undefined
}) } };
export const Disabled: Story = { args: { disabled: true, defaultValue: Workflow.Approved } };
export const Dark: Story = { ...RichContext, decorators: [withDarkUi] };
export const KeyboardSelection: Story = { play: async ({ canvasElement }) => {
  const input = within(canvasElement).getByRole('combobox'); await userEvent.click(input); await userEvent.keyboard('{Home}{ArrowDown}{Enter}');
  await expect(input).toHaveValue('In Review'); await expect(input).toHaveFocus(); await checkSelectLayout({ canvasElement });
} };
