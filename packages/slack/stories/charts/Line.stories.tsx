import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { cartesianChart, MONTHS } from './chartData';

/**
 * Line charts: `chart.type: 'line'` with 1–12 `series` and an `axis_config`.
 * `x_label` and `y_label` are optional and independent of each other. Validation is
 * off because the addon's validator doesn't know the `data_visualization` block yet.
 */
const meta = {
  title: 'Charts/Line',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const HOURS = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

export const SingleSeries: Story = {
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        {
          type: 'data_visualization',
          title: 'p95 API latency today',
          block_id: 'api_latency_p95',
          chart: {
            type: 'line',
            series: [
              {
                name: 'p95 latency',
                data: [
                  { label: '00:00', value: 180 },
                  { label: '04:00', value: 165 },
                  { label: '08:00', value: 240 },
                  { label: '12:00', value: 410 },
                  { label: '16:00', value: 320 },
                  { label: '20:00', value: 210 }
                ]
              }
            ],
            axis_config: {
              categories: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
              x_label: 'Time of day (UTC)',
              y_label: 'Latency (ms)'
            }
          }
        }
      ])
    )
  }
};

export const MultipleSeries: Story = {
  name: 'Multiple series',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'line',
          'Weekly orders by channel',
          ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
          [
            { name: 'Website', values: [3200, 3500, 2900, 4100, 4500, 4800] },
            { name: 'Mobile app', values: [2100, 2400, 2600, 2550, 3100, 3600] },
            { name: 'In-store', values: [1800, 1750, 1900, 1700, 1650, 1600] }
          ],
          { xLabel: 'Week', yLabel: 'Orders' }
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
          'line',
          'Cold storage temperature',
          HOURS,
          [
            { name: 'Freezer A', values: [-18, -18.5, -19, -18.2, -17.4, -16.8, -15.9, -17.1, -18.3, -18.7, -18.9, -18.4] },
            { name: 'Freezer B', values: [-20, -20.2, -19.8, -20.1, -19.5, -19.9, -20.3, -20, -19.7, -20.1, -20.4, -20.2] }
          ],
          { xLabel: 'Time', yLabel: 'Temperature (°C)' }
        )
      ])
    )
  }
};

export const XLabelOnly: Story = {
  name: 'x_label only',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart('line', 'Employee NPS', ['Jan', 'Apr', 'Jul', 'Oct'], [{ name: 'eNPS', values: [22, 27, 31, 35] }], { xLabel: 'Survey month' })
      ])
    )
  }
};

export const YLabelOnly: Story = {
  name: 'y_label only',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart('line', 'Monthly recurring revenue', MONTHS.slice(0, 6), [{ name: 'MRR', values: [410, 432, 455, 470, 498, 521] }], {
          yLabel: 'MRR ($k)'
        })
      ])
    )
  }
};

export const TwentyDataPoints: Story = {
  name: '20 data points (maximum)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        cartesianChart(
          'line',
          'Build duration, last 20 runs',
          Array.from({ length: 20 }, (_, index) => `#${4801 + index}`),
          [{ name: 'Duration', values: [6.1, 6.3, 5.9, 6.8, 7.2, 6.4, 6.0, 5.8, 9.4, 6.2, 6.1, 5.7, 5.9, 6.0, 6.6, 6.3, 5.5, 5.4, 5.6, 5.3] }],
          { xLabel: 'Run', yLabel: 'Minutes' }
        )
      ])
    )
  }
};
