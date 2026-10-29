import * as blockHelpers from '../blocks';
import type { SlackBlock } from '../types/slack';

export interface RenderedComponent {
  blocks: SlackBlock[];
  fallbackText?: string;
}

export interface ComponentRenderHelpers {
  blocks: typeof blockHelpers;
}

export type ComponentRenderResult = SlackBlock | SlackBlock[] | RenderedComponent | MessageComponent<unknown>;

export interface MessageComponent<Props = unknown> {
  readonly kind: 'slack-message-component';
  readonly name: string;
  readonly props: Props;
  render(): RenderedComponent;
}

export type ComponentLike = SlackBlock | SlackBlock[] | RenderedComponent | MessageComponent<unknown>;

export function defineComponent<Props>(
  name: string,
  render: (props: Props, helpers: ComponentRenderHelpers) => ComponentRenderResult
): (props: Props) => MessageComponent<Props> {
  return (props: Props): MessageComponent<Props> => ({
    kind: 'slack-message-component',
    name,
    props,
    render: () => normalizeRenderResult(render(props, { blocks: blockHelpers }))
  });
}

export function isMessageComponent(value: unknown): value is MessageComponent<unknown> {
  return Boolean(value && typeof value === 'object' && (value as MessageComponent).kind === 'slack-message-component');
}

export function isRenderedComponent(value: unknown): value is RenderedComponent {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as RenderedComponent).blocks));
}

export function normalizeRenderResult(result: ComponentRenderResult): RenderedComponent {
  if (isMessageComponent(result)) {
    return result.render();
  }
  if (isRenderedComponent(result)) {
    return result;
  }
  if (Array.isArray(result)) {
    return { blocks: result };
  }
  return { blocks: [result] };
}

export function resolveComponent(component: ComponentLike): RenderedComponent {
  return normalizeRenderResult(component as ComponentRenderResult);
}

export function resolveComponents(components: ComponentLike[]): RenderedComponent {
  const rendered = components.map(resolveComponent);
  return {
    blocks: rendered.flatMap((part) => part.blocks),
    fallbackText: rendered
      .map((part) => part.fallbackText)
      .filter((text): text is string => Boolean(text && text.trim()))
      .join(' • ')
  };
}
