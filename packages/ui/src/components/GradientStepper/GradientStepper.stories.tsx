import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Stack } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { GradientStepper, type GradientStepperProps } from './GradientStepper';

const meta = {
  play: checkStoryLayout,
  title: 'Components/GradientStepper',
  component: GradientStepper,
  parameters: { layout: 'fullscreen' },
  args: {
    steps: [{ id: 'gather', title: 'Gather ideas' }, { id: 'review', title: 'Review' }, { id: 'share', title: 'Share' }],
    activeStep: 1, 'aria-label': 'Research progress',
    sx: { width: 'min(640px, calc(100vw - 32px))' }
  }
} satisfies Meta<typeof GradientStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveExample(args: GradientStepperProps) {
  const [step, setStep] = useState(0);
  return <Stack spacing={3}><GradientStepper {...args} activeStep={step} /><Stack direction="row" spacing={1}>
    <ActionButton variant="text" onClick={() => setStep(0)}>Reset</ActionButton>
    <ActionButton variant="contained" disabled={step >= args.steps.length} onClick={() => setStep((value) => value + 1)}>Next</ActionButton>
  </Stack></Stack>;
}

export const Default: Story = {};
export const FirstStep: Story = { args: { activeStep: 0 } };
export const Completed: Story = { args: { activeStep: 3 } };
export const WithIcons: Story = { args: { steps: meta.args.steps.map((step) => ({ ...step, icon: <span>✦</span> })) } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const Interactive: Story = { render: (args) => <InteractiveExample {...args} /> };
export const Narrow: Story = { decorators: [(Story) => <Box sx={{ width: 280 }}><Story /></Box>], args: { sx: { width: '100%' } } };
export const Empty: Story = { args: { steps: [] } };
export const Dark: Story = { decorators: [withDarkUi] };

export const Inactive: Story = { args: { activeStep: -1 } };
export const NonLinear: Story = { args: { nonLinear: true, activeStep: 2 } };
export const SingleStep: Story = { args: { steps: [{ id: 'review', title: 'Review' }], activeStep: 0 } };
export const InlineLabels: Story = { args: { alternativeLabel: false } };
export const ManySteps: Story = { args: { steps: Array.from({ length: 8 }, (_, index) => ({ id: String(index), title: `Research stage ${index + 1}` })), activeStep: 3 } };
export const LongLabels: Story = { args: { steps: [{ title: 'Gather research from all teams' }, { title: 'Review and consolidate findings' }, { title: 'Share the final report' }] } };
export const DarkVertical: Story = { args: { orientation: 'vertical' }, decorators: [withDarkUi] };
