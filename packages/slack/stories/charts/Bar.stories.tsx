import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { cartesianChart, MONTHS, QUARTERS } from './chartData';

/**
 * Bar charts: `chart.type: 'bar'` with 1–12 `series` and an `axis_config`. With more
 * than one series, bars are grouped by category. Validation is off because the
 * addon's validator doesn't know the `data_visualization` block yet.
 */
const meta = {
  title: 'Charts/Bar',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSeries: Story = {
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        {
          type: 'data_visualization',
          title: 'Deploys per team this sprint',
          chart: {
            type: 'bar',
            series: [
              {
                name: 'Deploys',
                data: [
                  { label: 'Platform', value: 14 },
                  { label: 'Payments', value: 9 },
                  { label: 'Mobile', value: 6 },
                  { label: 'Data', value: 11 }
                ]
              }
            ],
            axis_config: {
              categories: ['Platform', 'Payments', 'Mobile', 'Data'],
              x_label: 'Team',
              y_label: 'Deploys'
            }
          }
        }
      ])
    )
  }
};

export const GroupedSeries: Story = {
  name: 'Grouped series',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'bar',
          'Revenue by region ($M)',
          ['North America', 'EMEA', 'APAC', 'LATAM'],
          [
            { name: 'FY2024', values: [18.2, 9.4, 5.1, 2.2] },
            { name: 'FY2025', values: [21.7, 11.8, 6.9, 2.9] },
            { name: 'FY2026', values: [25.3, 14.1, 9.2, 3.8] }
          ],
          { xLabel: 'Region', yLabel: 'Revenue ($M)' }
        )
      ])
    )
  }
};

export const NegativeValues: Story = {
  name: 'Negative values',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'bar',
          'Net headcount change',
          ['Engineering', 'Sales', 'Support', 'Marketing', 'Finance'],
          [{ name: 'Net change', values: [12, -4, 6, -2, 1] }],
          { xLabel: 'Department', yLabel: 'Hires minus exits' }
        )
      ])
    )
  }
};

export const CategoryOrder: Story = {
  name: 'Category order (axis_config sets it)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        {
          type: 'data_visualization',
          title: 'Open tickets by priority',
          chart: {
            type: 'bar',
            series: [
              {
                name: 'Open tickets',
                // Points are listed out of order on purpose: the x-axis still follows
                // `axis_config.categories` (Urgent → Low).
                data: [
                  { label: 'Low', value: 64 },
                  { label: 'High', value: 23 },
                  { label: 'Urgent', value: 7 },
                  { label: 'Medium', value: 41 }
                ]
              }
            ],
            axis_config: { categories: ['Urgent', 'High', 'Medium', 'Low'], x_label: 'Priority', y_label: 'Tickets' }
          }
        }
      ])
    )
  }
};

export const WithoutAxisLabels: Story = {
  name: 'Without axis labels',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart('bar', 'New customers per quarter', QUARTERS, [
          { name: '2025', values: [48, 61, 57, 72] },
          { name: '2026', values: [66, 79, 84, 95] }
        ])
      ])
    )
  }
};

export const TwentyCategories: Story = {
  name: '20 categories (maximum data points)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'bar',
          'Daily sign-ups, last 20 days',
          Array.from({ length: 20 }, (_, index) => `Oct ${index + 11}`),
          [{ name: 'Sign-ups', values: [42, 51, 38, 47, 66, 29, 24, 55, 61, 58, 49, 70, 33, 27, 63, 68, 72, 59, 31, 26] }],
          { xLabel: 'Day', yLabel: 'Sign-ups' }
        )
      ])
    )
  }
};

export const TwelveSeries: Story = {
  name: '12 series (maximum)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'bar',
          'Hires by month and quarter',
          QUARTERS,
          MONTHS.map((month, index) => ({
            name: month,
            values: QUARTERS.map((_, quarter) => ((index * 7 + quarter * 5) % 13) + 3)
          })),
          { xLabel: 'Quarter', yLabel: 'Hires' }
        )
      ])
    )
  }
};
