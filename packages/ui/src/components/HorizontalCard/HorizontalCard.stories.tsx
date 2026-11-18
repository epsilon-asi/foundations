import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import { ActionButton } from '../ActionButton';
import { HorizontalCard } from './HorizontalCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/HorizontalCard',
  component: HorizontalCard,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <Box sx={{ width: '100%', maxWidth: 960 }}><Story /></Box>],
  args: {
    title: 'Workspace',
    subtitle: 'An overview of your shared workspace.',
    children: (
      <Stack spacing={2}>
        <Typography variant="h6">Epsilon research</Typography>
        <Typography color="text.secondary">A shared home for project notes and team resources.</Typography>
        <Chip label="12 members" sx={{ alignSelf: 'flex-start' }} />
      </Stack>
    )
  }
} satisfies Meta<typeof HorizontalCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: { action: <ActionButton size="small" variant="outlined">Manage</ActionButton>, contentSize: 8 }
};

export const Transparent: Story = {
  args: { variant: 'transparent' }
};

export const CustomContent: Story = {
  args: {
    title: <Typography component="h2" variant="overline">Team activity</Typography>,
    subtitle: <Chip label="Updated today" size="small" />,
    contentSize: 7
  }
};

export const Narrow: Story = {
  args: { contentSize: 6 },
  decorators: [(Story) => <Box sx={{ width: 320, maxWidth: '100%' }}><Story /></Box>]
};

export const Dark: Story = {
  decorators: [withDarkUi]
};

export const Outlined: Story = { args: { variant: 'outlined' } };
export const Elevated: Story = { args: { variant: 'elevation', elevation: 6 } };
export const ContentWidths: Story = {
  render: (args) => <Stack spacing={3}>{([6, 7, 8, 9] as const).map((contentSize) =>
    <HorizontalCard {...args} key={contentSize} title={`Content width: ${contentSize}/12`} contentSize={contentSize} />
  )}</Stack>
};
export const LongContent: Story = {
  args: { title: 'Research and collaboration across teams', subtitle: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz',
    action: <ActionButton size="small">Manage workspace</ActionButton>,
    sx: { width: 280, maxWidth: '100%' } }
};
export const Spacious: Story = { args: { spacing: 4 } };
