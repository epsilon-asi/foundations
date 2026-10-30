import type {
  SlackBlocksParameterObject,
  SlackPreviewSurface,
  SlackPreviewTheme
} from '@tightknitai/storybook-addon-slack-block-kit';

import type { SlackBlock, SlackMessagePayload } from '../src';

/** Block shape the addon (via slack-blocks-to-jsx) renders. */
export type PreviewBlocks = SlackBlocksParameterObject['blocks'];

export interface PreviewOptions {
  surface?: SlackPreviewSurface;
  theme?: SlackPreviewTheme;
}

/**
 * Builds the `slackBlocks` story parameter from either raw Block Kit JSON or a
 * payload produced by this package's builders (`message()`, `compose()`, ...).
 */
export function slackPreview(
  source: PreviewBlocks | SlackBlock[] | SlackMessagePayload,
  options: PreviewOptions = {}
): SlackBlocksParameterObject {
  const blocks = Array.isArray(source) ? source : source.blocks;
  return {
    blocks: blocks as PreviewBlocks,
    // The addon (0.1.1) validates modal blocks inside a `{ type: 'modal', title }`
    // wrapper with no `submit`, which Slack requires whenever a modal has input
    // blocks — so every input modal reports a false "missing submit" error.
    validate: options.surface !== 'modal',
    ...options
  };
}

/**
 * Turns off the addon's validator for a story whose blocks use types or fields
 * from Slack's current Block Kit reference that the validator's schema
 * (@tightknitai/slack-block-kit-validator 0.1.0-alpha.0) doesn't know yet,
 * such as the `layout` block, header `level`, or rich-text `tag` elements.
 * For those it reports hundreds of false "must NOT have additional properties"
 * errors.
 */
export function unvalidated(preview: SlackBlocksParameterObject): SlackBlocksParameterObject {
  return { ...preview, validate: false };
}

/** Story placeholder — the addon's decorator draws the Slack surface itself. */
export const renderNothing = () => <></>;

export const SAMPLE_IMAGE = 'https://picsum.photos/seed/epsilon-slack/600/300';
export const SAMPLE_AVATAR = 'https://picsum.photos/seed/epsilon-avatar/96/96';
