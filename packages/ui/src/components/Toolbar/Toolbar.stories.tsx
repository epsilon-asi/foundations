import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, TextField } from '@mui/material';
import { expect, userEvent, within } from 'storybook/test';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { IconButton } from '../IconButton';
import { IconMenu } from '../IconMenu';
import { Toolbar, ToolbarGroup } from './Toolbar';

const actions = <><Button>Undo</Button><Button disabled>Redo</Button><Button>Save</Button></>;
const meta = { title: 'Components/Toolbar', component: Toolbar, play: checkStoryLayout,
  args: { 'aria-label': 'Editor actions', children: actions }
} satisfies Meta<typeof Toolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Compact: Story = { args: { density: 'compact' } };
export const Vertical: Story = { args: { orientation: 'vertical' }, decorators: [(Story) => <Box sx={{ width: 160, maxWidth: '100%' }}><Story /></Box>] };
export const Groups: Story = { args: { children: <>
  <ToolbarGroup aria-label="History"><Button>Undo</Button><Button disabled>Redo</Button></ToolbarGroup>
  <ToolbarGroup aria-label="Zoom" divided><Button>Fit</Button><Button>100%</Button></ToolbarGroup>
  <ToolbarGroup aria-label="Save" divided><Button variant="contained">Save</Button></ToolbarGroup>
</> } };
export const VerticalGroups: Story = { args: { orientation: 'vertical', children: <>
  <ToolbarGroup aria-label="History" orientation="vertical"><Button>Undo</Button><Button disabled>Redo</Button></ToolbarGroup>
  <ToolbarGroup aria-label="Zoom" orientation="vertical" divided><Button>Fit</Button><Button>100%</Button></ToolbarGroup>
</> }, decorators: [(Story) => <Box sx={{ width: 180, maxWidth: '100%' }}><Story /></Box>] };
export const EndActions: Story = { args: { endActions: <Button variant="contained">Export</Button> } };
export const Icons: Story = { args: { children: <>
  <IconButton aria-label="Undo" tooltip="Undo">↶</IconButton><IconButton aria-label="Redo" disabled tooltip="No changes to redo">↷</IconButton>
  <IconButton aria-label="Zoom out">−</IconButton><IconButton aria-label="Zoom in">+</IconButton>
  <IconMenu aria-label="More actions" items={[{ id: 'export', label: 'Export' }, { id: 'copy', label: 'Copy settings' }]} />
</> } };
export const WithSearch: Story = { args: { children: <><TextField label="Search assets" size="small" sx={{ minWidth: 0, width: 220, maxWidth: '100%' }} /><Button>Clear</Button></> } };
export const AllDisabled: Story = { args: { children: <><Button disabled>Undo</Button><Button disabled>Redo</Button><Button disabled>Save</Button></> } };
export const Empty: Story = { args: { children: null } };
export const Wrapping: Story = { args: { children: <>{actions}<Button>Open comparison</Button><Button>Download original asset</Button></> },
  decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const Scrolling: Story = { args: { wrap: false, children: <>{actions}<Button sx={{ flexShrink: 0 }}>Open comparison</Button><Button sx={{ flexShrink: 0 }}>Export</Button></> },
  decorators: [(Story) => <Box sx={{ width: 280, maxWidth: '100%' }}><Story /></Box>] };
export const NormalTabOrder: Story = { args: { rovingFocus: false } };
export const RightToLeft: Story = { args: { dir: 'rtl' } };
export const Dark: Story = { decorators: [withDarkUi] };
export const Keyboard: Story = { play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: 'Undo' }));
  await userEvent.keyboard('{ArrowRight}');
  await expect(canvas.getByRole('button', { name: 'Save' })).toHaveFocus();
  await userEvent.keyboard('{Home}');
  await expect(canvas.getByRole('button', { name: 'Undo' })).toHaveFocus();
  await checkStoryLayout({ canvasElement });
} };

export const Comfortable: Story = { args: { density: 'comfortable' } };
