import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { checkOverlayLayout } from '../../../.storybook/overlayExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { presets } from '../../../.storybook/workbenchExamples';
import { Popover } from '../Popover';
import { ColorPicker, ColorSwatch } from './ColorPicker';

const meta = { title: 'Components/ColorPicker', component: ColorPicker, play: checkStoryLayout,
  args: { label: 'Fill color', defaultValue: '#325DFFFF', presets }
} satisfies Meta<typeof ColorPicker>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const OpaqueOnly: Story = { args: { allowAlpha: false } };
export const Transparent: Story = { args: { defaultValue: '#325DFF60' } };
export const NoPresets: Story = { args: { presets: [] } };
export const Disabled: Story = { args: { disabled: true } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const InvalidValue: Story = { args: { value: 'invalid' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>] };
export const LongContent: Story = { args: { label: 'Fill color applied to every vector object in the currently selected group', hexLabel: 'Hexadecimal', invalidMessage: 'Enter a valid hexadecimal color value for the selected objects.', value: 'invalid' } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Controlled: Story = { render: function Controlled(args) { const [color, setColor] = useState('#325DFFFF'); return <><ColorPicker {...args} value={color} onChange={setColor} /><Typography role="status">{color}</Typography></>; } };
export const InPopover: Story = { render: function Editor(args) { const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null); const [color, setColor] = useState('#325DFFFF');
  return <><ColorSwatch color={color} label="Edit fill color" onClick={event => setAnchor(event.currentTarget)} />
    <Popover open={!!anchor} anchorEl={anchor} title="Fill" onClose={() => setAnchor(null)}><ColorPicker {...args} value={color} onChange={setColor} /></Popover></>;
}, play: async ({ canvasElement }) => { const canvas = within(canvasElement); const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Edit fill color' })); await waitFor(() => expect(body.getByRole('dialog', { name: 'Fill' })).toBeVisible());
  await userEvent.click(body.getByRole('button', { name: 'Orange' })); await expect(body.getByRole('textbox', { name: 'Hex color' })).toHaveValue('#ED6C02FF');
  await checkOverlayLayout({ canvasElement });
} };
export const KeyboardAndValidation: Story = { play: async ({ canvasElement }) => { const canvas = within(canvasElement); const hex = canvas.getByRole('textbox', { name: 'Hex color' });
  await userEvent.clear(hex); await userEvent.type(hex, 'invalid'); await userEvent.tab(); await expect(hex).toHaveAttribute('aria-invalid', 'true');
  canvas.getByRole('button', { name: 'Orange' }).focus(); await userEvent.keyboard('{Enter}'); await expect(hex).toHaveValue('#ED6C02FF'); await expect(hex).toHaveAttribute('aria-invalid', 'false');
  await checkStoryLayout({ canvasElement });
} };
