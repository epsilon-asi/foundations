import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { HeroCard } from './HeroCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/HeroCard',
  component: HeroCard,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Discover', header: 'Make room for your next idea',
    content: 'Collect research, share insights, and explore new possibilities with your team.',
    action: <ActionButton variant="contained">Explore workspace</ActionButton>,
    visual: <Box aria-hidden="true" sx={{ width: '100%', p: 4, bgcolor: 'action.hover', color: 'primary.main', fontSize: 120, textAlign: 'center' }}>✦</Box>,
    sx: { width: 'min(960px, calc(100vw - 32px))' }
  }
} satisfies Meta<typeof HeroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Flipped: Story = { args: { flip: true } };
export const TextOnly: Story = { args: { visual: undefined, action: undefined } };
export const Narrow: Story = { args: { sx: { width: 280 } } };
export const Dark: Story = { decorators: [withDarkUi] };

export const WithoutAction: Story = { args: { action: undefined } };
export const RichContent: Story = { args: { content: <Box component="ul" sx={{ pl: 2 }}><li>Collect your team's research</li><li>Share discoveries and next steps</li></Box>, children: <Box sx={{ mt: 2, typography: 'caption' }}>Updated today</Box> } };
export const LongContent: Story = { args: { header: 'Workspace collaboration and research across distributed teams', content: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', sx: { width: 280, maxWidth: '100%' } } };
export const FlippedNarrow: Story = { args: { flip: true, sx: { width: 280, maxWidth: '100%' } } };
