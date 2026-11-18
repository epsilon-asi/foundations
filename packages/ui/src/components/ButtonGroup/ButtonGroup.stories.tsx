import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { expect, userEvent, within } from 'storybook/test';
import { ActionButton } from '../ActionButton';
import { ButtonGroup, type ButtonGroupProps } from './index';

function FrameCommands(props: ButtonGroupProps) {
  const [frame, setFrame] = useState(2);
  return (
    <div>
      <ButtonGroup aria-label="Frame navigation" {...props}>
        <ActionButton disabled={frame === 1 || props.disabled} onClick={() => setFrame(frame - 1)}>Previous</ActionButton>
        <ActionButton onClick={() => setFrame(1)}>First</ActionButton>
        <ActionButton disabled={frame === 8 || props.disabled} onClick={() => setFrame(frame + 1)}>Next</ActionButton>
      </ButtonGroup>
      <p><output>Frame {frame} of 8</output></p>
    </div>
  );
}

const meta = {
  title: 'Components/ButtonGroup',
  component: ButtonGroup,
  play: checkStoryLayout,
  args: { size: 'small' },
  render: (args) => <FrameCommands {...args} />,
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Commands: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Vertical: Story = { args: { orientation: 'vertical' } };
export const Dark: Story = { decorators: [withDarkUi] };
export const LongLabels: Story = { render: () => <ButtonGroup aria-label="Asset commands" sx={{ width: 280, maxWidth: '100%' }}>
  <ActionButton>Previous production frame</ActionButton><ActionButton>Reset animation position</ActionButton><ActionButton>Next production frame</ActionButton>
</ButtonGroup> };
export const Variants: Story = { render: () => <div style={{ display: 'grid', gap: 8 }}>{(['text', 'outlined', 'contained'] as const).map(variant => <FrameCommands key={variant} variant={variant} />)}</div> };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'First' }));
  await expect(canvas.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(canvas.getByRole('button', { name: 'Next' })); await expect(canvas.getByText('Frame 2 of 8')).toBeVisible();
  await checkStoryLayout({ canvasElement });
} };
