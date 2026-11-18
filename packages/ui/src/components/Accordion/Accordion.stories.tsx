import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { checkSelectLayout } from '../../../.storybook/selectExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { IconMenu } from '../IconMenu';
import { PropertiesDisplayCard } from '../PropertiesDisplayCard';
import { SingleSelect } from '../SingleSelect';
import { StatusBadge } from '../StatusBadge';
import { Accordion } from './Accordion';

const meta = { title: 'Components/Accordion', component: Accordion, play: checkSelectLayout,
  args: { title: 'Asset details', subtitle: 'Dimensions, format and ownership', onExpandedChange: fn(),
    children: <PropertiesDisplayCard title="Metadata" properties={[{ label: 'Size', value: '1024 × 1024 px' }, { label: 'Format', value: 'PNG' }, { label: 'Owner', value: 'Creative team' }]} /> },
  decorators: [(Story) => <Box sx={{ maxWidth: 640, minWidth: 0 }}><Story /></Box>]
} satisfies Meta<typeof Accordion>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Expanded: Story = { args: { defaultExpanded: true } };
export const Compact: Story = { args: { defaultExpanded: true, density: 'compact' } };
export const WithHeaderAction: Story = { args: { headerAction: <IconMenu aria-label="Asset options" items={[{ id: 'reset', label: 'Reset details', onClick: fn() }]} /> } };
export const WithFooter: Story = { args: { defaultExpanded: true, footer: <><ActionButton>Apply changes</ActionButton><ActionButton variant="text">Reset</ActionButton></> } };
export const Disabled: Story = { args: { disabled: true, subtitle: 'Details are unavailable while the asset is being processed.' } };
export const DisabledExpanded: Story = { args: { disabled: true, defaultExpanded: true } };
export const KeepMounted: Story = { args: { keepMounted: true, defaultExpanded: true,
  children: <SingleSelect label="Output format" options={[{ value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]} defaultValue="png" helperText="The selection survives closing this section." /> } };
export const Controlled: Story = { render: function Example(args) { const [expanded, setExpanded] = useState(false); return <>
  <Accordion {...args} expanded={expanded} onExpandedChange={(next) => { args.onExpandedChange?.(next); setExpanded(next); }} />
  <Typography role="status" variant="caption">{expanded ? 'Expanded' : 'Collapsed'}</Typography></>; } };
export const LongContent: Story = { args: { defaultExpanded: true, title: 'Detailed production metadata and ownership settings for the selected creative asset',
  subtitle: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', headerAction: <StatusBadge label="Review required" tone="warning" />,
  children: <Typography>project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz</Typography>, footer: <ActionButton>Review all production metadata</ActionButton> } };
export const Dark: Story = { args: { defaultExpanded: true }, decorators: [withDarkUi] };
export const KeyboardAndFocus: Story = { args: { children: <SingleSelect label="Output format" options={[{ value: 'png', label: 'PNG' }, { value: 'webp', label: 'WebP' }]} /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement); const header = canvas.getByRole('button', { name: 'Asset details' });
    await userEvent.click(header); await expect(header).toHaveAttribute('aria-expanded', 'true');
    await userEvent.tab(); await expect(canvas.getByRole('combobox')).toHaveFocus();
    await userEvent.tab({ shift: true }); await expect(header).toHaveFocus(); await userEvent.keyboard(' ');
    await expect(canvas.queryByRole('combobox')).not.toBeInTheDocument(); await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('region', { name: 'Asset details' })).toBeVisible(); await checkStoryLayout({ canvasElement });
} };

export const Comfortable: Story = { args: { density: 'comfortable' } };
