import { context, fieldSections, header } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { Primitive, Severity, SlackBlock } from '../types/slack';
import { compactJoin, formatPrimitive } from '../utils/text';
import { tone } from './status';
import type { FieldDefinition } from './shared';

export interface MetricDefinition {
  label: string;
  value: Primitive;
  unit?: string;
  delta?: string;
  severity?: Severity;
}

export interface MetricGridOptions {
  title: string;
  metrics: MetricDefinition[];
  context?: string[];
  maxMetrics?: number;
}

function metricToField(metric: MetricDefinition): FieldDefinition {
  const selectedTone = metric.severity ? `${tone(metric.severity).emoji} ` : '';
  const value = compactJoin([`${selectedTone}${formatPrimitive(metric.value)}${metric.unit ?? ''}`, metric.delta], ' ');
  return { label: metric.label, value };
}

function renderMetricGrid(options: MetricGridOptions): RenderedComponent {
  const metrics = options.metrics.slice(0, options.maxMetrics ?? 20);
  const blocks: SlackBlock[] = [header(`📊 ${options.title}`), ...fieldSections(metrics.map(metricToField))];

  if (options.context?.length) {
    blocks.push(context(options.context));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, metrics.map((metric) => `${metric.label}: ${formatPrimitive(metric.value)}${metric.unit ?? ''}`).join(', ')])
  };
}

export const metricGrid = defineComponent<MetricGridOptions>('prebuilt.metricGrid', renderMetricGrid);
