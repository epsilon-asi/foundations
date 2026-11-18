import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { expect, userEvent, within } from 'storybook/test';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack, Typography } from '@mui/material';
import SettingsRounded from '@mui/icons-material/SettingsRounded';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { IconButton, type IconButtonProps } from './IconButton';

function ButtonExample(args: IconButtonProps) {
  const [count, setCount] = useState(0);
  return <Stack spacing={2} alignItems="flex-start"><IconButton {...args} onClick={(event) => {
    args.onClick?.(event); setCount((value) => value + 1);
  }} /><Typography role="status">Activated {count} times</Typography></Stack>;
}

const meta = {
  play: checkStoryLayout,
  title: 'Components/IconButton', component: IconButton,
  parameters: { layout: 'fullscreen' },
  args: { 'aria-label': 'Open settings', tooltip: 'Open settings', children: <SettingsRounded /> },
  render: (args) => <ButtonExample {...args} />
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Round: Story = { args: { variant: 'round', filled: true } };
export const Borderless: Story = { args: { outlined: false } };
export const Disabled: Story = { args: { disabled: true, tooltip: 'You need edit access' } };
export const Large: Story = { args: { size: 'large' } };
export const Dark: Story = { decorators: [withDarkUi] };

export const Small: Story = { args: { size: 'small' } };
export const Filled: Story = { args: { filled: true } };
export const Grow: Story = { args: { grow: true, children: <span>More actions</span>, sx: { px: 2 } } };
export const WithoutTooltip: Story = { args: { tooltip: undefined } };
export const Colors: Story = { render: (args) => <Stack direction="row" flexWrap="wrap" gap={2}>{(['default', 'primary', 'secondary', 'success', 'warning', 'error', 'info'] as const).map((color) => <IconButton {...args} key={color} color={color} aria-label={`${color} action`} />)}</Stack> };
export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{Enter} ');
    await expect(canvas.getByRole('status')).toHaveTextContent(/Activated\s+2\s+times/);
    await checkStoryLayout({ canvasElement });
  }
};
