import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, TextField } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { FieldGroup, InspectorRow } from './InspectorRow';

const fields = <>{['Name', 'Description'].map(label => <InspectorRow key={label} label={label}>{control => <TextField id={control.id} fullWidth defaultValue={label === 'Name' ? 'Coastal study' : 'Reference artwork'} />}</InspectorRow>)}</>;
const meta = { title: 'Components/FieldGroup', component: FieldGroup, play: checkStoryLayout,
  args: { title: 'Selection properties', description: 'Shared properties for the selected layers.', children: fields }
} satisfies Meta<typeof FieldGroup>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const WideLabels: Story = { args: { labelWidth: 180 } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const LongContent: Story = { args: { title: 'Properties shared by the complete selection of character and environment layers', description: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } };
export const Dark: Story = { decorators: [withDarkUi] };
