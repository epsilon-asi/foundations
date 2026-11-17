import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import { Box, Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { DialogCard } from './DialogCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/DialogCard',
  component: DialogCard,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Report ready',
    subtitle: 'Your export is complete.',
    message: 'The report includes activity from the last 30 days.',
    icon: <CheckCircleOutlineRounded color="success" sx={{ fontSize: 48 }} />,
    maxWidth: 'sm',
    actions: [
      <ActionButton key="close" variant="text">Close</ActionButton>,
      <ActionButton key="download" variant="contained">Download report</ActionButton>
    ]
  }
} satisfies Meta<typeof DialogCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithContent: Story = {
  args: {
    children: (
      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2">report-november.csv · 124 KB</Typography>
      </Box>
    )
  }
};

export const WithoutActions: Story = {
  args: { actions: undefined }
};

export const BusyAction: Story = {
  args: { actions: <ActionButton loading loadingLabel="Preparing download…">Download</ActionButton> }
};

export const Narrow: Story = {
  decorators: [(Story) => <Box sx={{ width: 280 }}><Story /></Box>]
};

export const Dark: Story = {
  decorators: [withDarkUi]
};

export const Minimal: Story = { args: { title: 'Ready to continue', subtitle: undefined, message: undefined, icon: undefined, actions: undefined, children: <Typography>Your changes are saved.</Typography> } };
export const MessageOnly: Story = { args: { title: undefined, subtitle: undefined, icon: undefined, actions: undefined } };
export const Widths: Story = {
  render: (args) => <Box sx={{ display: 'grid', gap: 3 }}>{(['xs', 'sm', 'md', 'lg', 'xl', false] as const).map((width) =>
    <DialogCard {...args} key={String(width)} maxWidth={width} title={`Width: ${width || 'unlimited'}`} actions={undefined} />
  )}</Box>
};
export const LongContent: Story = {
  args: { title: 'Your shared workspace report is ready to download', subtitle: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
    sx: { width: 280, maxWidth: '100%' }, actions: [<ActionButton key="download">Download full report</ActionButton>, <ActionButton key="share">Share with your team</ActionButton>] }
};
export const CustomContent: Story = { args: { title: <span>Workspace <strong>updated</strong></span>, message: undefined, children: <Box sx={{ p: 2, bgcolor: 'action.hover' }}>Version 12 · Published today</Box> } };
