import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ToggleButton, ToggleButtonGroup, type ToggleButtonGroupProps } from './index';

function BrushMode({ required, ...props }: ToggleButtonGroupProps & { required: boolean }) {
  const [value, setValue] = useState<string | null>('paint');
  return (
    <ToggleButtonGroup {...props} aria-label="Brush mode" exclusive value={value}
      onChange={(_event, next: string | null) => { if (next !== null || !required) setValue(next); }}>
      <ToggleButton value="paint">Paint</ToggleButton>
      <ToggleButton value="erase">Erase</ToggleButton>
    </ToggleButtonGroup>
  );
}

function ViewingAngles(props: ToggleButtonGroupProps) {
  const [angles, setAngles] = useState<number[]>([0]);
  return (
    <ToggleButtonGroup {...props} aria-label="Viewing angles" value={angles}
      onChange={(_event, next: number[]) => setAngles(next)}>
      {[0, 45, 90, 180].map((angle) => (
        <ToggleButton key={angle} value={angle} disabled={angle === 180 || props.disabled}>{angle}°</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

const meta = {
  title: 'Components/ToggleButtonGroup',
  component: ToggleButtonGroup,
  play: checkStoryLayout,
  args: { size: 'small' },
} satisfies Meta<typeof ToggleButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keep the current mode when clicking its button a second time yields null. */
export const RequiredSingleChoice: Story = { render: (args) => <BrushMode {...args} required /> };

/** Accept null to let the user clear the selected mode. */
export const ClearableSingleChoice: Story = { render: (args) => <BrushMode {...args} required={false} /> };

/** Multiple selection returns an array of the original option values, including numeric zero. */
export const MultipleNumericChoices: Story = { render: (args) => <ViewingAngles {...args} /> };
export const Disabled: Story = { args: { disabled: true }, render: (args) => <BrushMode {...args} required /> };
export const Vertical: Story = { args: { orientation: 'vertical' }, render: (args) => <BrushMode {...args} required /> };
export const Dark: Story = { render: (args) => <ViewingAngles {...args} />, decorators: [withDarkUi] };
export const LongLabels: Story = { render: () => <ToggleButtonGroup exclusive value="paint" aria-label="Editing tools" sx={{ width: 280, maxWidth: '100%' }}>
  <ToggleButton value="paint">Paint production details</ToggleButton><ToggleButton value="erase">Erase selected elements</ToggleButton>
</ToggleButtonGroup> };
