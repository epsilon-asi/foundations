import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { Add, Check, Edit } from '@mui/icons-material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { StatusBadge } from '../StatusBadge';
import { VerticalTimeline } from './VerticalTimeline';

const meta = { title: 'Components/VerticalTimeline', component: VerticalTimeline, play: checkStoryLayout,
  args: { now: '2026-11-17T14:00Z', items: [
    { id: 'created', title: 'Asset created', date: '2026-11-17T09:00Z', icon: <Add />, tone: 'info', content: 'A new forest guardian concept was added to the library.' },
    { id: 'edited', title: 'Revision completed', date: '2026-11-17T11:00Z', icon: <Edit />, tone: 'warning', content: 'Updated colours and silhouette.', actions: <ActionButton variant="text">View revision</ActionButton> },
    { id: 'approved', title: 'Ready for production', date: '2026-11-17T12:00Z', icon: <Check />, tone: 'success', status: <StatusBadge label="Approved" tone="success" /> }
  ] }, decorators: [(Story) => <Box sx={{ maxWidth: 960 }}><Story /></Box>]
} satisfies Meta<typeof VerticalTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Left: Story = { args: { position: 'left' } };
export const Alternating: Story = { args: { position: 'alternate' } };
export const AlternatingReverse: Story = { args: { position: 'alternate-reverse' } };
export const Relative: Story = { args: { dateFormat: 'relative' } };
export const Compact: Story = { args: { density: 'compact' } };
export const NarrowContainer: Story = { decorators: [(Story) => <Box sx={{ maxWidth: 280 }}><Story /></Box>] };
export const Minimal: Story = { args: { items: [{ id: 'a', title: 'Created' }, { id: 'b', title: 'Reviewed' }, { id: 'c', title: 'Published' }] } };
export const Empty: Story = { args: { items: [] } };
export const LongContent: Story = { args: { position: 'alternate', items: [{ id: 'a', title: 'A detailed production review with multiple outstanding requests', date: '2026-11-17T12:00Z',
  content: 'asset_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', actions: <ActionButton>Review all requested changes</ActionButton> }, { id: 'b', title: 'Timestamp unavailable', date: 'invalid', content: 'Content is still available when the date is missing or invalid.' }] } };
export const Dark: Story = { args: { position: 'alternate' }, decorators: [withDarkUi] };
