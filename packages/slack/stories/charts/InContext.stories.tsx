import type { Meta, StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { cartesianChart, MONTHS, pieChart, WEEKDAYS } from './chartData';

/**
 * Charts inside real messages and Home tabs, next to other blocks. Slack allows at
 * most 2 `data_visualization` blocks per message, and the block isn't available in
 * modals. Validation is off because the addon's validator doesn't know the block yet.
 */
const meta = {
  title: 'Charts/In context',
  render: renderNothing
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const KpiReport: Story = {
  name: 'Weekly KPI report (chart + narrative)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        { type: 'header', text: { type: 'plain_text', text: '📊 Weekly business review', emoji: true } },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Orders grew *9%* week over week, driven by the mobile app launch.' },
          fields: [
            { type: 'mrkdwn', text: '*Orders*\n12,480 (+9%)' },
            { type: 'mrkdwn', text: '*Conversion*\n3.4% (+0.2pt)' }
          ]
        },
        cartesianChart(
          'line',
          'Orders per day',
          WEEKDAYS,
          [
            { name: 'This week', values: [2310, 2450, 2520, 2600, 2600] },
            { name: 'Last week', values: [2150, 2240, 2300, 2380, 2390] }
          ],
          { xLabel: 'Day', yLabel: 'Orders' }
        ),
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Source: orders warehouse · Updated 09:00 UTC' }] },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'Open dashboard' }, url: 'https://example.com/dashboards/wbr', action_id: 'open_wbr' }
          ]
        }
      ])
    )
  }
};

export const TwoChartsInOneMessage: Story = {
  name: 'Two charts in one message (maximum)',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview([
        { type: 'header', text: { type: 'plain_text', text: '🎧 Support monthly summary', emoji: true } },
        pieChart('Tickets by channel', [
          { label: 'Email', value: 412 },
          { label: 'Live chat', value: 298 },
          { label: 'Phone', value: 121 }
        ]),
        { type: 'divider' },
        cartesianChart(
          'bar',
          'First response time (hours)',
          ['Aug', 'Sep', 'Oct'],
          [
            { name: 'Target', values: [4, 4, 4] },
            { name: 'Actual', values: [5.2, 4.1, 3.6] }
          ],
          { xLabel: 'Month', yLabel: 'Hours' }
        ),
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Slack allows at most 2 charts per message.' }] }
      ])
    )
  }
};

export const HomeTabDashboard: Story = {
  name: 'App Home dashboard',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview(
        [
          { type: 'header', text: { type: 'plain_text', text: '💰 Finance dashboard', emoji: true } },
          { type: 'section', text: { type: 'mrkdwn', text: 'Year-to-date spend is *4% under budget*.' } },
          cartesianChart(
            'area',
            'Spend vs budget ($k)',
            MONTHS.slice(0, 10),
            [
              { name: 'Budget', values: [800, 820, 840, 860, 880, 900, 900, 920, 940, 960] },
              { name: 'Spend', values: [760, 790, 850, 830, 845, 870, 880, 890, 905, 915] }
            ],
            { xLabel: 'Month', yLabel: '$k' }
          ),
          { type: 'divider' },
          pieChart('Spend by category', [
            { label: 'Payroll', value: 61 },
            { label: 'Cloud', value: 14 },
            { label: 'Software', value: 9 },
            { label: 'Travel', value: 6 },
            { label: 'Office', value: 5 },
            { label: 'Other', value: 5 }
          ])
        ],
        { surface: 'home' }
      )
    )
  }
};

export const DarkTheme: Story = {
  name: 'Dark theme',
  parameters: {
    slackBlocks: unvalidated(
      slackPreview(
        [
          cartesianChart(
            'bar',
            'Incidents by severity',
            ['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4'],
            [
              { name: 'Q3', values: [2, 7, 18, 31] },
              { name: 'Q4', values: [1, 4, 15, 26] }
            ],
            { xLabel: 'Severity', yLabel: 'Incidents' }
          )
        ],
        { theme: 'dark' }
      )
    )
  }
};
