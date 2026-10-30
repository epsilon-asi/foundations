import type { StoryObj } from '@storybook/react-vite';

import { renderNothing, slackPreview, unvalidated } from '../support';
import { cartesianChart, pieChart, type CartesianChartType } from './chartData';

/**
 * Every `data_visualization` option driven from the Controls panel: chart type,
 * title, number of series or segments, negative values, and axis labels.
 */
const meta = {
  title: 'Charts/Playground',
  render: renderNothing
};

export default meta;

interface PlaygroundArgs {
  chartType: 'pie' | CartesianChartType;
  title: string;
  seriesCount: number;
  categoryCount: number;
  includeNegative: boolean;
  xLabel: string;
  yLabel: string;
}

const SERIES_NAMES = ['North', 'South', 'East', 'West', 'Central', 'Online', 'Partners', 'Retail', 'Wholesale', 'Export', 'Enterprise', 'SMB'];

function buildChart(args: PlaygroundArgs) {
  const categories = Array.from({ length: args.categoryCount }, (_, index) => `Week ${index + 1}`);

  if (args.chartType === 'pie') {
    // Pie segments must be > 0, so negative values don't apply here.
    return pieChart(
      args.title,
      SERIES_NAMES.slice(0, args.seriesCount).map((label, index) => ({ label, value: 10 + ((index * 17) % 40) }))
    );
  }

  return cartesianChart(
    args.chartType,
    args.title,
    categories,
    SERIES_NAMES.slice(0, args.seriesCount).map((name, seriesIndex) => ({
      name,
      values: categories.map((_, index) => {
        const value = 20 + ((seriesIndex * 13 + index * 7) % 45);
        return args.includeNegative && index % 3 === 1 ? -value / 2 : value;
      })
    })),
    { xLabel: args.xLabel, yLabel: args.yLabel }
  );
}

export const Playground: StoryObj<PlaygroundArgs> = {
  render: renderNothing,
  args: {
    chartType: 'bar',
    title: 'Sales by region',
    seriesCount: 3,
    categoryCount: 6,
    includeNegative: false,
    xLabel: 'Week',
    yLabel: 'Sales ($k)'
  },
  argTypes: {
    chartType: { control: { type: 'inline-radio' }, options: ['pie', 'bar', 'area', 'line'] },
    title: { control: { type: 'text', maxLength: 50 } },
    seriesCount: { name: 'series / segments', control: { type: 'range', min: 1, max: 12, step: 1 } },
    categoryCount: { name: 'categories (not pie)', control: { type: 'range', min: 1, max: 20, step: 1 } },
    includeNegative: { name: 'negative values (not pie)', control: 'boolean' },
    xLabel: { name: 'x_label (optional)', control: { type: 'text', maxLength: 50 } },
    yLabel: { name: 'y_label (optional)', control: { type: 'text', maxLength: 50 } }
  },
  parameters: {
    slackBlocks: (args: Record<string, unknown>) => unvalidated(slackPreview([buildChart(args as unknown as PlaygroundArgs)]))
  }
};
