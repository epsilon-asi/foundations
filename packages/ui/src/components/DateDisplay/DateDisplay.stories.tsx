import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { DateDisplay } from './DateDisplay';

const meta = { title: 'Components/DateDisplay', component: DateDisplay, play: checkStoryLayout,
  args: { value: '2026-11-27T12:00Z', now: '2026-11-17T12:00Z' },
  decorators: [(Story) => <Box sx={{ maxWidth: 400 }}><Story /></Box>]
} satisfies Meta<typeof DateDisplay>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Relative: Story = { args: { showRelative: true } };
export const RangeProgress: Story = { args: { start: '2026-11-07T12:00Z', showRelative: true } };
export const ProgressStates: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 2 }}>{[
  ['Not started', '2026-11-01'], ['Halfway', '2026-11-17'], ['Due today', '2026-11-27'], ['Overdue', '2026-11-30']
].map(([label, now]) => <Box key={label}><Typography variant="caption">{label}</Typography><DateDisplay {...args} now={now} start="2026-11-07" showRelative /></Box>)}</Box> };
export const Colors: Story = { render: (args) => <Box sx={{ display: 'grid', gap: 1 }}>{(['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const).map((color) =>
  <DateDisplay {...args} key={color} color={color} start="2026-11-07" progressLabel={`${color} progress`} showRelative />)}</Box> };
export const Localized: Story = { args: { locale: 'de-DE', timeZone: 'Europe/Berlin', formatOptions: { weekday: 'long', month: 'long' }, showRelative: true } };
export const TimeZoneBoundary: Story = { args: { value: '2026-11-18T01:00Z', now: '2026-11-17T12:00Z', timeZone: 'America/Los_Angeles', showRelative: true } };
export const InvalidAndMissing: Story = { render: () => <Box sx={{ display: 'grid', gap: 1 }}><DateDisplay value={null} /><DateDisplay value="invalid" emptyValue="Date unavailable" /><DateDisplay value="2026-11-17" start="2026-11-27" now="2026-11-17" showRelative /></Box> };
export const Dark: Story = { args: { start: '2026-11-07', showRelative: true }, decorators: [withDarkUi] };
