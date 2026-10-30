import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { pieChart } from './chartData';

/**
 * Pie charts: `chart.type: 'pie'` with 1–12 `segments`. Each segment's share is its
 * value divided by the sum of all values. Validation is off because the addon's
 * validator doesn't know the `data_visualization` block yet.
 */
const meta = {
  title: 'Charts/Pie',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        {
          type: 'data_visualization',
          title: 'Support tickets by channel',
          chart: {
            type: 'pie',
            segments: [
              { label: 'Email', value: 412 },
              { label: 'Live chat', value: 298 },
              { label: 'Phone', value: 121 },
              { label: 'Slack Connect', value: 87 }
            ]
          }
        }
      ])
    )
  }
};

export const SingleSegment: Story = {
  name: 'Single segment (minimum)',
  parameters: {
    slackBlocks: unvalidated(slackPreview([pieChart('Laptops enrolled in MDM', [{ label: 'Enrolled', value: 1240 }])]))
  }
};

export const TwelveSegments: Story = {
  name: '12 segments (maximum, 20-char labels)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        pieChart('Headcount by department', [
          { label: 'Engineering', value: 182 },
          { label: 'Sales', value: 96 },
          { label: 'Customer Success Ops', value: 64 },
          { label: 'Marketing', value: 41 },
          { label: 'Product', value: 33 },
          { label: 'Design', value: 21 },
          { label: 'Finance', value: 18 },
          { label: 'People', value: 15 },
          { label: 'Legal', value: 8 },
          { label: 'IT', value: 12 },
          { label: 'Security', value: 10 },
          { label: 'Facilities', value: 6 }
        ])
      ])
    )
  }
};

export const FractionalValues: Story = {
  name: 'Fractional values',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        pieChart(
          'Cloud spend by service ($k)',
          [
            { label: 'Compute', value: 41.5 },
            { label: 'Storage', value: 22.25 },
            { label: 'Database', value: 18.75 },
            { label: 'Networking', value: 9.1 },
            { label: 'Other', value: 3.4 }
          ],
          'cloud_spend_pie'
        )
      ])
    )
  }
};
