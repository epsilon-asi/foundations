import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from './SelectField';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';

const meta = { title: 'Components/SelectField', component: SelectField, play: checkStoryLayout } satisfies Meta<typeof SelectField>;
export default meta;
type Story = StoryObj<typeof meta>;

function GroupedPresets() {
  const [size, setSize] = useState<number | null>(null);
  return (
    <SelectField label="Preview size" value={size} helperText="Sizes are in pixels."
      onChange={(event) => setSize(event.target.value === '' ? null : Number(event.target.value))}>
      <option value="">Automatic</option>
      <optgroup label="Small"><option value={96}>96 px</option><option value={160}>160 px</option></optgroup>
      <optgroup label="Large"><option value={320}>320 px</option></optgroup>
    </SelectField>
  );
}

export const Grouped: Story = { render: () => <GroupedPresets /> };
export const SavedUnavailableValue: Story = { args: {
  label: 'Model', defaultValue: 'retired', helperText: 'Choose a replacement to update this setting.',
  children: <><option value="retired" disabled>Previous model (unavailable)</option><option value="current">Current model</option></>,
} };
export const Disabled: Story = { args: {
  label: 'Row', disabled: true, children: <option>No rows available</option>,
} };
export const Dark: Story = { render: () => <GroupedPresets />, decorators: [withDarkUi] };
export const RequiredError: Story = { args: { label: 'Output format', required: true, error: true, fullWidth: true, helperText: 'Choose an output format.', value: null,
  children: <><option value="">Choose format</option><option value="png">PNG</option><option value="webp">WebP</option></> } };
