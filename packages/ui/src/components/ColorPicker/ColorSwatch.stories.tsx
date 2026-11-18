import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { presets } from '../../../.storybook/workbenchExamples';
import { ColorSwatch } from './ColorPicker';

const meta = { title: 'Components/ColorSwatch', component: ColorSwatch, play: checkStoryLayout, args: { color: '#325DFF', label: 'Blue' } } satisfies Meta<typeof ColorSwatch>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Transparent: Story = { args: { color: '#325DFF60', label: 'Translucent blue' } };
export const White: Story = { args: { color: '#fff', label: 'White' } };
export const Selected: Story = { args: { selected: true, onClick: () => {} } };
export const Disabled: Story = { args: { disabled: true, onClick: () => {} } };
export const Palette: Story = { render: function Palette() { const [selected, setSelected] = useState('Blue'); return <Box role="group" aria-label="Palette" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
  {presets.map(preset => <ColorSwatch key={preset.label} color={preset.value} label={preset.label} selected={selected === preset.label} onClick={() => setSelected(preset.label)} />)}</Box>;
} };
export const Dark: Story = { decorators: [withDarkUi] };
