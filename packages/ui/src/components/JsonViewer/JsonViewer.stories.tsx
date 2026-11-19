import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { sampleJson, simulateCopy } from '../../../.storybook/collectionExamples';
import { JsonViewer } from './JsonViewer';

const circular: Record<string, unknown> = { name: 'Circular sample' }; circular.self = circular;
const getters = Object.defineProperty({ name: 'Metadata' }, 'derived', { enumerable: true, get: () => { throw new Error('This getter must not run'); } });
const meta = { title: 'Components/JsonViewer', component: JsonViewer, play: checkStoryLayout,
  args: { label: 'Asset metadata', value: sampleJson, copyButtonProps: { copy: simulateCopy } }
} satisfies Meta<typeof JsonViewer>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Expanded: Story = { args: { defaultExpandedPaths: ['', '/output', '/output/layers', '/output/layers/0', '/tags'] } };
export const Collapsed: Story = { args: { defaultExpandedPaths: [] } };
export const Primitive: Story = { args: { value: 'coastal study' } };
export const EmptyObject: Story = { args: { value: {} } };
export const EmptyArray: Story = { args: { value: [] } };
export const Null: Story = { args: { value: null } };
export const Circular: Story = { args: { value: circular } };
export const Accessors: Story = { render: args => <JsonViewer {...args} value={getters} /> };
export const NonJsonValues: Story = { args: { value: { missing: undefined, count: 12n, invalid: NaN, date: new Date('2026-01-01T00:00:00Z'), callback: () => {} } } };
export const InspectionLimits: Story = { args: { value: Array.from({ length: 1000 }, (_, index) => ({ id: index, settings: { width: 1024 } })), maxEntries: 10, maxNodes: 30, maxDepth: 2 } };
export const WithoutCopy: Story = { args: { copyable: false } };
export const LongContent: Story = { args: { value: { asset_abcdefghijklmnopqrstuvwxyz_0123456789: 'value_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz' } } };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 240, maxWidth: '100%' }}><Story /></Box>], args: LongContent.args };
export const Controlled: Story = { render: function Controlled(args) { const [expanded, setExpanded] = useState<readonly string[]>(['']); return <><JsonViewer {...args} expandedPaths={expanded} onExpandedChange={setExpanded} /><Typography variant="caption">Expanded: {JSON.stringify(expanded)}</Typography></>; } };
export const Dark: Story = { decorators: [withDarkUi], args: Expanded.args };
export const Keyboard: Story = { args: { defaultExpandedPaths: [] }, play: async ({ canvasElement }) => { const canvas = within(canvasElement); const root = canvas.getByRole('treeitem', { name: 'root: Object (7)' });
  root.focus(); await userEvent.keyboard('{ArrowRight}{ArrowRight}'); await expect(canvas.getByRole('treeitem', { name: 'name: "Coastal study"' })).toHaveFocus(); await checkStoryLayout({ canvasElement });
} };
