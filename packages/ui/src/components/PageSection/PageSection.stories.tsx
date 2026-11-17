import { checkStoryLayout } from '../../../.storybook/layoutAssertions';
import { withDarkUi } from '../../../.storybook/withDarkUi';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Grid, Typography } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { PageSection } from './PageSection';
import { StatCard } from '../StatCard';

const meta = {
  play: checkStoryLayout,
  title: 'Components/PageSection',
  component: PageSection,
  args: {
    title: 'Workspace overview',
    subtitle: 'Reusable page framing for downstream apps',
    action: <ActionButton size="small">Create item</ActionButton>
  },
  render: (args) => (
    <PageSection {...args}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <StatCard
            description="Compared to last month"
            title="Active users"
            trendLabel="+8.2%"
            value="12,480"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              alignItems: 'center',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 3,
              display: 'flex',
              height: '100%',
              justifyContent: 'center',
              minHeight: 160
            }}
          >
            <Typography color="text.secondary" variant="body2">
              Put tables, charts, forms, or any page content here.
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </PageSection>
  )
} satisfies Meta<typeof PageSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Minimal: Story = { args: { subtitle: undefined, action: undefined } };
export const Narrow: Story = { args: { sx: { width: 280, maxWidth: '100%' } } };
export const LongContent: Story = { args: { title: 'Workspace collaboration and research across distributed teams', subtitle: 'workspace_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz', action: <ActionButton>Manage workspace settings</ActionButton>, sx: { width: 280, maxWidth: '100%' } } };
export const Dark: Story = { decorators: [withDarkUi] };
