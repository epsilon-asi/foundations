import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { checkStoryLayout } from '../../.storybook/layoutAssertions';
import { withDarkUi } from '../../.storybook/withDarkUi';
import { Panel } from '../components/Panel';
import { Tabs } from '../components/Tabs';
import { ActionButton } from '../components/ActionButton';
import { IconButton } from '../components/IconButton';
import { SingleSelect } from '../components/SingleSelect';
import { Checkbox } from '../components/Checkbox';

const meta = { title: 'Foundations/Density', play: checkStoryLayout, render: function Comparison() {
  const [selection, setSelection] = useState({ compact: 'general', comfortable: 'general' });
  return <Box sx={{ display: 'grid', gap: 3 }}>
  <Typography variant="h4" component="h1">Compact spacing standards</Typography>
  <Typography color="text.secondary">4px spacing grid · 8–12px surface padding · small controls · 28px minimum button height</Typography>
  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
    {(['compact', 'comfortable'] as const).map(density => <Panel key={density} density={density} title={density === 'compact' ? 'Default · compact' : 'Optional · comfortable'}
      headerAction={<IconButton aria-label={`Refresh ${density}`} size={density === 'compact' ? 'small' : 'medium'}>↻</IconButton>}>
      <Tabs density={density} value={selection[density]} onChange={(next) => setSelection(previous => ({ ...previous, [density]: next }))}
        aria-label={`${density} settings`} tabs={[{ id: 'general', label: 'General', content: <Box sx={{ display: 'grid', gap: density === 'compact' ? 3 : 5 }}>
        <SingleSelect label="Output format" size={density === 'compact' ? 'small' : 'medium'} options={[{ value: 'png', label: 'PNG', description: 'Lossless image' }, { value: 'webp', label: 'WebP', description: 'Compact web image' }]} defaultValue="png" />
        <Checkbox label="Include metadata" defaultChecked /><ActionButton variant="contained" size={density === 'compact' ? 'small' : 'medium'}>Save settings</ActionButton>
      </Box> }, { id: 'advanced', label: 'Advanced', content: 'Advanced options are available here.' }]} />
    </Panel>)}
  </Box>
</Box>; } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Dark: Story = { decorators: [withDarkUi] };
