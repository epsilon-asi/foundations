import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { checkSelectLayout } from '../../../.storybook/selectExamples';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { StatusBadge } from '../StatusBadge';
import { SingleSelect } from '../SingleSelect';
import { Accordion } from './Accordion';
import { AccordionGroup } from './AccordionGroup';

const meta = { title: 'Components/AccordionGroup', component: AccordionGroup, play: checkSelectLayout,
  args: { onExpandedChange: fn(), items: [
    { id: 'details', title: 'Asset details', subtitle: 'Dimensions and format', content: <Typography>1024 × 1024 px · PNG · Creative team</Typography> },
    { id: 'history', title: 'Revision history', subtitle: '3 revisions', content: <Typography>Colour palette and silhouette updated in the latest revision.</Typography> },
    { id: 'settings', title: 'Generation settings', content: <SingleSelect label="Generation model" options={[{ value: 'fast', label: 'Fast concept' }, { value: 'quality', label: 'Production quality' }]} defaultValue="fast" /> }
  ] }, decorators: [(Story) => <Box sx={{ maxWidth: 720, minWidth: 0 }}><Story /></Box>]
} satisfies Meta<typeof AccordionGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const SingleOpen: Story = { args: { defaultExpandedIds: ['details'] } };
export const MultipleOpen: Story = { args: { mode: 'multiple', defaultExpandedIds: ['details', 'history', 'settings'] } };
export const Compact: Story = { args: { density: 'compact', defaultExpandedIds: ['details'] } };
export const DisabledItems: Story = { args: { items: [
  { id: 'details', title: 'Asset details', content: 'Asset information' },
  { id: 'locked', title: 'Advanced settings', disabled: true, subtitle: 'Requires owner access', content: 'Unavailable settings' },
  { id: 'history', title: 'Revision history', content: 'Three revisions' }
] } };
export const AllDisabled: Story = { args: { disabled: true } };
export const Controlled: Story = { render: function Example(args) { const [expandedIds, setExpanded] = useState<string[]>(['details']); return <>
  <AccordionGroup {...args} expandedIds={expandedIds} onExpandedChange={(ids, id) => { args.onExpandedChange?.(ids, id); setExpanded(ids); }} />
  <Typography role="status" variant="caption">Open: {expandedIds.join(', ') || 'none'}</Typography></>; } };
export const LongContent: Story = { args: { mode: 'multiple', defaultExpandedIds: ['long', 'other'], items: [
  { id: 'long', title: 'Detailed creative asset metadata for the entire production and visual development team', subtitle: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
    headerAction: <StatusBadge label="Review required" tone="warning" />, content: <Typography>asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz</Typography>, footer: <ActionButton>Review complete asset history</ActionButton> },
  { id: 'other', title: 'Ownership and access permissions', content: <Typography>Members of the creative team can review and update this asset.</Typography> }
] } };
export const Nested: Story = { args: { defaultExpandedIds: ['outer'], items: [
  { id: 'outer', title: 'Project settings', content: <Box sx={{ display: 'grid', gap: 1 }}><Accordion title="Output details">PNG · Original size</Accordion>
    <AccordionGroup aria-label="Advanced options" items={[{ id: 'a', title: 'Performance', content: 'Balanced' }, { id: 'b', title: 'Quality', content: 'High detail' }]} /></Box> },
  { id: 'history', title: 'Revision history', content: 'Three revisions' }
] } };
export const Empty: Story = { args: { items: [] } };
export const Dark: Story = { args: { defaultExpandedIds: ['details'] }, decorators: [withDarkUi] };
export const KeyboardNavigation: Story = { ...DisabledItems, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); const first = canvas.getByRole('button', { name: 'Asset details' });
  await userEvent.click(first); await userEvent.keyboard('{ArrowDown}'); await expect(canvas.getByRole('button', { name: 'Revision history' })).toHaveFocus();
  await userEvent.keyboard('{Enter}'); await expect(first).toHaveAttribute('aria-expanded', 'false');
  await expect(canvas.getByRole('region', { name: 'Revision history' })).toBeVisible();
  await userEvent.keyboard('{Home}'); await expect(first).toHaveFocus(); await userEvent.keyboard('{End}');
  await expect(canvas.getByRole('button', { name: 'Revision history' })).toHaveFocus(); await checkStoryLayout({ canvasElement });
} };

export const Comfortable: Story = { args: { density: 'comfortable' } };
