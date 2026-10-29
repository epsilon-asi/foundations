export type Primitive = string | number | boolean | null | undefined;

export type SlackTextType = 'plain_text' | 'mrkdwn';

export interface PlainTextObject {
  type: 'plain_text';
  text: string;
  emoji?: boolean;
}

export interface MrkdwnTextObject {
  type: 'mrkdwn';
  text: string;
  verbatim?: boolean;
}

export type SlackTextObject = PlainTextObject | MrkdwnTextObject;

export interface SlackFileImageObject {
  id?: string;
  url?: string;
}

export interface ImageSource {
  imageUrl?: string;
  slackFile?: SlackFileImageObject;
}

export interface ImageElement {
  type: 'image';
  image_url?: string;
  slack_file?: SlackFileImageObject;
  alt_text: string;
}

export interface ConfirmationDialog {
  title: PlainTextObject;
  text: SlackTextObject;
  confirm: PlainTextObject;
  deny: PlainTextObject;
  style?: 'primary' | 'danger';
}

export interface ButtonElement {
  type: 'button';
  text: PlainTextObject;
  action_id: string;
  url?: string;
  value?: string;
  style?: 'primary' | 'danger';
  accessibility_label?: string;
  confirm?: ConfirmationDialog;
}

export type SlackBlockElement = ButtonElement | ImageElement | Record<string, unknown>;

export interface HeaderBlock {
  type: 'header';
  text: PlainTextObject;
  block_id?: string;
}

export interface SectionBlock {
  type: 'section';
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackBlockElement;
  block_id?: string;
  expand?: boolean;
}

export interface DividerBlock {
  type: 'divider';
  block_id?: string;
}

export interface ContextBlock {
  type: 'context';
  elements: Array<SlackTextObject | ImageElement>;
  block_id?: string;
}

export interface ImageBlock {
  type: 'image';
  image_url?: string;
  slack_file?: SlackFileImageObject;
  alt_text: string;
  title?: PlainTextObject;
  block_id?: string;
}

export interface ActionsBlock {
  type: 'actions';
  elements: SlackBlockElement[];
  block_id?: string;
}

export interface MarkdownBlock {
  type: 'markdown';
  text: string;
  block_id?: string;
}

export type KnownSlackBlock =
  | HeaderBlock
  | SectionBlock
  | DividerBlock
  | ContextBlock
  | ImageBlock
  | ActionsBlock
  | MarkdownBlock;

export type SlackBlock = KnownSlackBlock | ({ type: string } & Record<string, unknown>);

export interface SlackMessageMetadata {
  event_type: string;
  event_payload: Record<string, unknown>;
}

export interface SlackMessagePayload {
  text: string;
  blocks: SlackBlock[];
  metadata?: SlackMessageMetadata;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  mrkdwn?: boolean;
  parse?: 'full' | 'none';
}

export interface SlackPostMessagePayload extends SlackMessagePayload {
  channel: string;
  thread_ts?: string;
  reply_broadcast?: boolean;
}

export interface SlackUpdateMessagePayload extends SlackMessagePayload {
  channel: string;
  ts: string;
}

export type Severity = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
