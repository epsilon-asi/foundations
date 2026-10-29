import { actions, fieldSections, header, image, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ImageSource, SlackBlock } from '../types/slack';
import { compactJoin } from '../utils/text';
import { toButtons, toFields, type ActionDefinition, type FieldDefinition } from './shared';

export interface ChartImageOptions extends ImageSource {
  title: string;
  chartUrl?: string;
  altText: string;
  summary?: string;
  metrics?: FieldDefinition[];
  actions?: ActionDefinition[];
}

function renderChartImage(options: ChartImageOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`📈 ${options.title}`)];
  if (options.summary) {
    blocks.push(section(options.summary));
  }
  if (options.metrics?.length) {
    blocks.push(...fieldSections(toFields(options.metrics)));
  }
  blocks.push(
    image({
      imageUrl: options.chartUrl ?? options.imageUrl,
      slackFile: options.slackFile,
      altText: options.altText,
      title: options.title
    })
  );
  if (options.actions?.length) {
    blocks.push(actions(toButtons(options.actions)));
  }

  return {
    blocks,
    fallbackText: compactJoin([options.title, options.summary, options.altText])
  };
}

export const chartImage = defineComponent<ChartImageOptions>('prebuilt.chartImage', renderChartImage);
