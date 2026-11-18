import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Typography } from '@mui/material';
import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ShortcutHint } from './Keycap';

const meta = { title: 'Components/ShortcutHint', component: ShortcutHint, play: checkStoryLayout,
  args: { keys: ['Ctrl', 'Shift', 'S'], label: 'Control plus Shift plus S' }
} satisfies Meta<typeof ShortcutHint>;
export default meta; type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Mac: Story = { args: { keys: ['⌘', '⇧', 'S'], label: 'Command plus Shift plus S', separator: '' } };
export const SingleKey: Story = { args: { keys: ['Esc'], label: 'Escape' } };
export const InToolbar: Story = { render: args => <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}><Typography>Save a copy</Typography><ShortcutHint {...args} /></Box> };
export const Narrow: Story = { decorators: [Story => <Box sx={{ width: 120, maxWidth: '100%' }}><Story /></Box>] };
export const Dark: Story = { decorators: [withDarkUi] };
