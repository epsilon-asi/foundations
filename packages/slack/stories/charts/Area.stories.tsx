import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { cartesianChart, WEEKDAYS } from './chartData';

/**
 * Area charts: `chart.type: 'area'` with 1–12 `series` and an `axis_config`. Series
 * are layered in array order, so the first series is drawn at the back. Validation
 * is off because the addon's validator doesn't know the `data_visualization` block yet.
 */
const meta = {
  title: 'Charts/Area',
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
          title: 'Support queue depth today',
          chart: {
            type: 'area',
            series: [
              {
                name: 'Waiting tickets',
                data: [
                  { label: '08:00', value: 12 },
                  { label: '10:00', value: 34 },
                  { label: '12:00', value: 51 },
                  { label: '14:00', value: 46 },
                  { label: '16:00', value: 28 },
                  { label: '18:00', value: 9 }
                ]
              }
            ],
            axis_config: {
              categories: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
              x_label: 'Time of day',
              y_label: 'Tickets waiting'
            }
          }
        }
      ])
    )
  }
};

export const LayeredSeries: Story = {
  name: 'Layered series (first is at the back)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'area',
          'Daily active users by plan',
          WEEKDAYS,
          [
            { name: 'Free', values: [12000, 13500, 15200, 14800, 16400] },
            { name: 'Pro', values: [4500, 4800, 5100, 5600, 6200] },
            { name: 'Enterprise', values: [1800, 1900, 2050, 2100, 2300] }
          ],
          { xLabel: 'Day', yLabel: 'Users' }
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
          'area',
          'Net cash flow ($k)',
          ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Wk 7', 'Wk 8'],
          [{ name: 'Net cash flow', values: [120, 85, -40, -95, 30, 140, 60, -20] }],
          { xLabel: 'Week', yLabel: 'Net cash flow ($k)' }
        )
      ])
    )
  }
};
