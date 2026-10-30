/**
 * Typed builders for Slack's `data_visualization` block
 * (https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block).
 *
 * Every option the block supports:
 * - `title` (required, max 50 chars), `chart` (required), `block_id` (optional).
 * - `chart.type`: `pie` | `bar` | `area` | `line`.
 * - Pie: `segments` — 1 to 12 `{ label (max 20 chars), value (> 0) }`.
 * - Bar / area / line: `series` — 1 to 12 `{ name (unique, max 20 chars), data }`, where
 *   `data` is 1 to 20 `{ label, value }` points (negative values allowed), with exactly
 *   one point per category; and `axis_config` — `categories` (required, sets the x-axis
 *   order, max 20 chars each), `x_label` and `y_label` (optional, max 50 chars).
 * - Bar series are grouped by label; area series are layered in array order (first at back).
 * - Surfaces: messages and Home tabs. At most 2 data visualization blocks per message.
 */

export type CartesianChartType = 'bar' | 'area' | 'line';

export type DataPoint = { label: string; value: number };

export type DataSeries = { name: string; data: DataPoint[] };

export type AxisConfig = { categories: string[]; x_label?: string; y_label?: string };

export type PieSegment = { label: string; value: number };

export type PieChart = { type: 'pie'; segments: PieSegment[] };

export type CartesianChart = { type: CartesianChartType; series: DataSeries[]; axis_config: AxisConfig };

export type DataVisualizationBlock = {
  type: 'data_visualization';
  title: string;
  chart: PieChart | CartesianChart;
  block_id?: string;
};

export type SeriesValues = { name: string; values: number[] };

export interface ChartOptions {
  xLabel?: string;
  yLabel?: string;
  blockId?: string;
}

export function pieChart(title: string, segments: PieSegment[], blockId?: string): DataVisualizationBlock {
  return {
    type: 'data_visualization',
    title,
    chart: { type: 'pie', segments },
    ...(blockId ? { block_id: blockId } : {})
  };
}

/**
 * Builds a bar, area, or line chart. Each series lists one value per category, in
 * category order, which guarantees Slack's "one data point per category" rule.
 */
export function cartesianChart(
  type: CartesianChartType,
  title: string,
  categories: string[],
  series: SeriesValues[],
  options: ChartOptions = {}
): DataVisualizationBlock {
  return {
    type: 'data_visualization',
    title,
    chart: {
      type,
      series: series.map(({ name, values }) => ({
        name,
        data: categories.map((label, index) => ({ label, value: values[index] ?? 0 }))
      })),
      axis_config: {
        categories,
        ...(options.xLabel ? { x_label: options.xLabel } : {}),
        ...(options.yLabel ? { y_label: options.yLabel } : {})
      }
    },
    ...(options.blockId ? { block_id: options.blockId } : {})
  };
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
