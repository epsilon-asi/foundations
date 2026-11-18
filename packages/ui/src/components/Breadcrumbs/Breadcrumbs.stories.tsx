import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { expect, userEvent, within, fn } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { Breadcrumbs } from './Breadcrumbs';

const meta = { title: 'Components/Breadcrumbs', component: Breadcrumbs, play: checkStoryLayout,
  args: { items: [{ id: 'home', label: 'Home', href: '#home' }, { id: 'library', label: 'Library', href: '#library' }, { id: 'asset', label: 'Forest guardian' }] }
} satisfies Meta<typeof Breadcrumbs>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const CustomSeparator: Story = { args: { separator: '›' } };
export const DisabledAndActions: Story = { args: { items: [{ id: 'home', label: 'Home', href: '#home' }, { id: 'archived', label: 'Archived', disabled: true, href: '#archived' }, { id: 'choose', label: 'Choose collection', onClick: fn() }, { id: 'current', label: 'Asset' }] } };
export const Collapsed: Story = { args: { maxItems: 3, items: Array.from({ length: 7 }, (_, index) => ({ id: `${index}`, label: `Collection ${index + 1}`, href: `#${index}` })) } };
export const RouterAdapter: Story = { args: { renderLink: (props) => <a {...props} onClick={(event) => { props.onClick?.(event); event.preventDefault(); }} /> } };
export const LongLabels: Story = { args: { items: [{ id: 'home', label: 'Creative asset management', href: '#home' }, { id: 'project', label: 'Project_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', href: '#project' }, { id: 'current', label: 'Forest guardian character exploration and production revisions' }] }, decorators: [(Story) => <Box sx={{ maxWidth: 480 }}><Story /></Box>] };
export const Empty: Story = { args: { items: [] } };
export const Dark: Story = { decorators: [withDarkUi] };
export const ExpandPath: Story = { ...Collapsed, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement); await userEvent.click(canvas.getByRole('button', { name: 'Show path' }));
  await expect(canvas.getByRole('link', { name: 'Collection 3' })).toBeVisible(); await checkStoryLayout({ canvasElement });
} };
