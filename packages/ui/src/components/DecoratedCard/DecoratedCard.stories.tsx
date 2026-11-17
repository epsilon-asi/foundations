import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { Box, Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { DecoratedCard } from './DecoratedCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/DecoratedCard',
  component: DecoratedCard,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'New possibilities',
    children: <Typography>Collect ideas, compare approaches, and share your next discovery.</Typography>,
    sx: { width: 'min(420px, calc(100vw - 32px))' }
  }
} satisfies Meta<typeof DecoratedCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithGraphic: Story = {
  args: {
    graphic: <AutoAwesomeRounded sx={{ fontSize: 180 }} />,
    graphicSx: { top: -20, right: -20 },
    actions: <ActionButton variant="text">Explore ideas</ActionButton>
  }
};

export const EndAlignedActions: Story = {
  args: {
    alignActions: 'end',
    actions: [
      <ActionButton key="later" variant="text">Later</ActionButton>,
      <ActionButton key="open" variant="contained">Open workspace</ActionButton>
    ]
  }
};

export const ContentOnly: Story = {
  args: { title: undefined }
};

export const Narrow: Story = {
  args: { sx: { width: 280 }, actions: <ActionButton fullWidth>Explore ideas</ActionButton> }
};

export const Dark: Story = {
  ...WithGraphic,
  decorators: [withDarkUi]
};

export const StartAlignedActions: Story = {
  args: { alignActions: 'start', actions: [<ActionButton key="save">Save</ActionButton>, <ActionButton key="share">Share</ActionButton>] }
};
export const CustomGraphic: Story = {
  args: { graphic: <AutoAwesomeRounded sx={{ fontSize: 120 }} />, graphicSx: [(theme) => ({ color: theme.palette.secondary.main }), { opacity: 0.25, right: 12, top: 12 }] }
};
export const LongContent: Story = {
  args: { title: 'Research across distributed teams', children: <Typography>workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz</Typography>,
    sx: { width: 280, maxWidth: '100%' },
    actions: [<ActionButton key="open">Open workspace</ActionButton>, <ActionButton key="share">Share findings</ActionButton>] }
};
