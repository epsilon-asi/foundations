import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { rejectCopy, simulateCopy } from '../../../.storybook/collectionExamples';
import { ActionButton } from '../ActionButton';
import { CopyableValue } from './CopyButton';

const meta = { title: 'Components/CopyableValue', component: CopyableValue, play: checkStoryLayout,
  args: { label: 'Asset identifier', value: 'asset_123456789', copyButtonProps: { copy: simulateCopy } } } satisfies Meta<typeof CopyableValue>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const DisplayOverride: Story = { args: { displayValue: 'asset_123…' } };
export const PlainText: Story = { args: { monospace: false, label: 'Document title', value: 'Coastal study' } };
export const Multiline: Story = { args: { value: 'export:\n  format: png\n  width: 1024\n  height: 768' } };
export const LongContent: Story = { args: { label: 'Identifier used by all revisions in this collection', value: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz_0123456789' } };
export const Scrolling: Story = { args: { wrap: false, value: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz_0123456789' } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 220, maxWidth: '100%' }}><Story /></Box>], args: LongContent.args };
export const Disabled: Story = { args: { copyButtonProps: { disabled: true } } };
export const ClipboardError: Story = { args: { copyButtonProps: { copy: rejectCopy, resetAfter: 0 } } };
export const ChangingValue: Story = { render: function Changing(args) { const [revision, setRevision] = useState(1); return <Box sx={{ display: 'grid', gap: 2 }}><CopyableValue {...args} value={`asset_revision_${revision}`} /><ActionButton onClick={() => setRevision(revision + 1)}>Next revision</ActionButton></Box>; } };
export const Dark: Story = { decorators: [withDarkUi] };
