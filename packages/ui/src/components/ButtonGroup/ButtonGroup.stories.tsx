import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
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
