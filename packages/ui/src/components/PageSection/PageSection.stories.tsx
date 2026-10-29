import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Grid, Typography } from '@mui/material';
import { ActionButton } from '../ActionButton';
import { PageSection } from './PageSection';
import { StatCard } from '../StatCard';

const meta = {
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
