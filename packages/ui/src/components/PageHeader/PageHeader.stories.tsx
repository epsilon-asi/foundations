import type { Meta, StoryObj } from '@storybook/react-vite';
import { Add, MoreHoriz } from '@mui/icons-material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { IconMenu } from '../IconMenu';
import { StatusBadge } from '../StatusBadge';
import { PageHeader } from './PageHeader';

const meta = { title: 'Components/PageHeader', component: PageHeader, play: checkStoryLayout,
  args: { title: 'Asset library', subtitle: 'Explore, review and organize your creative assets.', eyebrow: 'Creative studio',
    breadcrumbs: [{ id: 'home', label: 'Home', href: '#home' }, { id: 'assets', label: 'Assets' }],
    actions: <ActionButton startIcon={<Add />}>Create asset</ActionButton> }
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Minimal: Story = { args: { subtitle: undefined, eyebrow: undefined, breadcrumbs: [], actions: undefined } };
export const SectionHeading: Story = { args: { headingLevel: 'h2', title: 'Revision history', breadcrumbs: [] } };
export const MultipleActions: Story = { args: { actions: <><ActionButton variant="outlined">Import assets</ActionButton><ActionButton startIcon={<Add />}>Create asset</ActionButton>
  <IconMenu aria-label="Library options" icon={<MoreHoriz />} items={[{ id: 'settings', label: 'Library settings' }]} /></> } };
export const RichTitle: Story = { args: { title: <>Forest guardian <StatusBadge label="Approved" tone="success" /></> } };
export const LongContent: Story = { args: { title: 'Character design explorations and production-ready creative assets for the upcoming release',
  subtitle: 'project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
  breadcrumbs: [{ id: 'home', label: 'Creative workspace', href: '#home' }, { id: 'project', label: 'Long-term production project', href: '#project' }, { id: 'current', label: 'Character asset collection' }],
  actions: <><ActionButton variant="outlined">Download complete collection</ActionButton><ActionButton>Create new character asset</ActionButton></> } };
export const Dark: Story = { decorators: [withDarkUi] };
