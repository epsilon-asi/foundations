import { context as contextBlock, divider as dividerBlock, header as headerBlock, section as sectionBlock } from '../blocks';
import { alertCard, approvalRequest, card, chartImage, compactTable, deploymentNotice, digest, imageAlert, incidentUpdate, metricGrid } from '../prebuilt';
import type { SlackMessageMetadata, SlackMessagePayload } from '../types/slack';
import type { ComponentLike } from './component';
import { resolveComponents } from './component';
import { resolveFallbackText } from './fallback';
import { assertValidMessage } from './validation';

export interface MessageBuilderOptions {
  text?: string;
  validate?: boolean;
  metadata?: SlackMessageMetadata;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
}

export interface BuildOptions extends MessageBuilderOptions {
  mrkdwn?: boolean;
  parse?: 'full' | 'none';
}

export class MessageBuilder {
  private readonly parts: ComponentLike[] = [];
  private readonly defaults: MessageBuilderOptions;

  constructor(defaults: MessageBuilderOptions = {}) {
    this.defaults = defaults;
  }

  static create(defaults: MessageBuilderOptions = {}): MessageBuilder {
    return new MessageBuilder(defaults);
  }

  add(component: ComponentLike): this {
    this.parts.push(component);
    return this;
  }

  addMany(components: ComponentLike[]): this {
    components.forEach((component) => this.add(component));
    return this;
  }

  header(text: string): this {
    return this.add(headerBlock(text));
  }

  section(text: string): this {
    return this.add(sectionBlock(text));
  }

  context(elements: string[]): this {
    return this.add(contextBlock(elements));
  }

  divider(): this {
    return this.add(dividerBlock());
  }

  card(options: Parameters<typeof card>[0]): this {
    return this.add(card(options));
  }

  alert(options: Parameters<typeof alertCard>[0]): this {
    return this.add(alertCard(options));
  }

  imageAlert(options: Parameters<typeof imageAlert>[0]): this {
    return this.add(imageAlert(options));
  }

  chart(options: Parameters<typeof chartImage>[0]): this {
    return this.add(chartImage(options));
  }

  metrics(options: Parameters<typeof metricGrid>[0]): this {
    return this.add(metricGrid(options));
  }

  table(options: Parameters<typeof compactTable>[0]): this {
    return this.add(compactTable(options));
  }

  digest(options: Parameters<typeof digest>[0]): this {
    return this.add(digest(options));
  }

  deployment(options: Parameters<typeof deploymentNotice>[0]): this {
    return this.add(deploymentNotice(options));
  }

  incident(options: Parameters<typeof incidentUpdate>[0]): this {
    return this.add(incidentUpdate(options));
  }

  approval(options: Parameters<typeof approvalRequest>[0]): this {
    return this.add(approvalRequest(options));
  }

  build(options: BuildOptions = {}): SlackMessagePayload {
    const rendered = resolveComponents(this.parts);
    const payload: SlackMessagePayload = {
      text: resolveFallbackText({
        providedText: options.text ?? this.defaults.text,
        componentFallback: rendered.fallbackText,
        blocks: rendered.blocks
      }),
      blocks: rendered.blocks
    };

    const metadata = options.metadata ?? this.defaults.metadata;
    if (metadata) {
      payload.metadata = metadata;
    }

    const unfurlLinks = options.unfurlLinks ?? this.defaults.unfurlLinks;
    if (unfurlLinks !== undefined) {
      payload.unfurl_links = unfurlLinks;
    }

    const unfurlMedia = options.unfurlMedia ?? this.defaults.unfurlMedia;
    if (unfurlMedia !== undefined) {
      payload.unfurl_media = unfurlMedia;
    }

    if (options.mrkdwn !== undefined) {
      payload.mrkdwn = options.mrkdwn;
    }
    if (options.parse) {
      payload.parse = options.parse;
    }

    const shouldValidate = options.validate ?? this.defaults.validate ?? true;
    if (shouldValidate) {
      assertValidMessage(payload);
    }

    return payload;
  }
}

export function message(defaults: MessageBuilderOptions = {}): MessageBuilder {
  return new MessageBuilder(defaults);
}

export const compose = message;

export function createMessage(components: ComponentLike[], options: BuildOptions = {}): SlackMessagePayload {
  return new MessageBuilder().addMany(components).build(options);
}
