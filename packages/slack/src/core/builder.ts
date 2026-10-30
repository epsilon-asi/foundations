import { context as contextBlock, divider as dividerBlock, header as headerBlock, section as sectionBlock } from '../blocks';
import {
  accessRequest,
  agenda,
  alertCard,
  announcement,
  approvalRequest,
  budgetAlert,
  candidateUpdate,
  card,
  celebration,
  chartImage,
  checklist,
  compactTable,
  customerFeedback,
  dealUpdate,
  deploymentNotice,
  digest,
  documentShare,
  errorReport,
  eventInvite,
  expenseApproval,
  goalProgress,
  imageAlert,
  incidentUpdate,
  inventoryAlert,
  invoiceNotice,
  kudos,
  leadAlert,
  leaderboard,
  maintenanceNotice,
  meetingSummary,
  metricGrid,
  onCallHandoff,
  orderUpdate,
  pipelineStatus,
  policyAcknowledgement,
  poll,
  projectStatus,
  pullRequest,
  ratingRequest,
  releaseNotes,
  reminder,
  securityAlert,
  standupSummary,
  supportTicket,
  surveyRequest,
  taskAssignment,
  timeOffRequest,
  trainingAssignment,
  userProfile,
  welcomeMessage
} from '../prebuilt';
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

  announcement(options: Parameters<typeof announcement>[0]): this {
    return this.add(announcement(options));
  }

  event(options: Parameters<typeof eventInvite>[0]): this {
    return this.add(eventInvite(options));
  }

  welcome(options: Parameters<typeof welcomeMessage>[0]): this {
    return this.add(welcomeMessage(options));
  }

  kudos(options: Parameters<typeof kudos>[0]): this {
    return this.add(kudos(options));
  }

  celebration(options: Parameters<typeof celebration>[0]): this {
    return this.add(celebration(options));
  }

  poll(options: Parameters<typeof poll>[0]): this {
    return this.add(poll(options));
  }

  survey(options: Parameters<typeof surveyRequest>[0]): this {
    return this.add(surveyRequest(options));
  }

  rating(options: Parameters<typeof ratingRequest>[0]): this {
    return this.add(ratingRequest(options));
  }

  reminder(options: Parameters<typeof reminder>[0]): this {
    return this.add(reminder(options));
  }

  policy(options: Parameters<typeof policyAcknowledgement>[0]): this {
    return this.add(policyAcknowledgement(options));
  }

  profile(options: Parameters<typeof userProfile>[0]): this {
    return this.add(userProfile(options));
  }

  training(options: Parameters<typeof trainingAssignment>[0]): this {
    return this.add(trainingAssignment(options));
  }

  task(options: Parameters<typeof taskAssignment>[0]): this {
    return this.add(taskAssignment(options));
  }

  checklist(options: Parameters<typeof checklist>[0]): this {
    return this.add(checklist(options));
  }

  standup(options: Parameters<typeof standupSummary>[0]): this {
    return this.add(standupSummary(options));
  }

  meeting(options: Parameters<typeof meetingSummary>[0]): this {
    return this.add(meetingSummary(options));
  }

  project(options: Parameters<typeof projectStatus>[0]): this {
    return this.add(projectStatus(options));
  }

  goals(options: Parameters<typeof goalProgress>[0]): this {
    return this.add(goalProgress(options));
  }

  agenda(options: Parameters<typeof agenda>[0]): this {
    return this.add(agenda(options));
  }

  document(options: Parameters<typeof documentShare>[0]): this {
    return this.add(documentShare(options));
  }

  leaderboard(options: Parameters<typeof leaderboard>[0]): this {
    return this.add(leaderboard(options));
  }

  pullRequest(options: Parameters<typeof pullRequest>[0]): this {
    return this.add(pullRequest(options));
  }

  pipeline(options: Parameters<typeof pipelineStatus>[0]): this {
    return this.add(pipelineStatus(options));
  }

  error(options: Parameters<typeof errorReport>[0]): this {
    return this.add(errorReport(options));
  }

  releaseNotes(options: Parameters<typeof releaseNotes>[0]): this {
    return this.add(releaseNotes(options));
  }

  handoff(options: Parameters<typeof onCallHandoff>[0]): this {
    return this.add(onCallHandoff(options));
  }

  maintenance(options: Parameters<typeof maintenanceNotice>[0]): this {
    return this.add(maintenanceNotice(options));
  }

  security(options: Parameters<typeof securityAlert>[0]): this {
    return this.add(securityAlert(options));
  }

  deal(options: Parameters<typeof dealUpdate>[0]): this {
    return this.add(dealUpdate(options));
  }

  ticket(options: Parameters<typeof supportTicket>[0]): this {
    return this.add(supportTicket(options));
  }

  feedback(options: Parameters<typeof customerFeedback>[0]): this {
    return this.add(customerFeedback(options));
  }

  lead(options: Parameters<typeof leadAlert>[0]): this {
    return this.add(leadAlert(options));
  }

  candidate(options: Parameters<typeof candidateUpdate>[0]): this {
    return this.add(candidateUpdate(options));
  }

  invoice(options: Parameters<typeof invoiceNotice>[0]): this {
    return this.add(invoiceNotice(options));
  }

  expense(options: Parameters<typeof expenseApproval>[0]): this {
    return this.add(expenseApproval(options));
  }

  timeOff(options: Parameters<typeof timeOffRequest>[0]): this {
    return this.add(timeOffRequest(options));
  }

  budget(options: Parameters<typeof budgetAlert>[0]): this {
    return this.add(budgetAlert(options));
  }

  order(options: Parameters<typeof orderUpdate>[0]): this {
    return this.add(orderUpdate(options));
  }

  inventory(options: Parameters<typeof inventoryAlert>[0]): this {
    return this.add(inventoryAlert(options));
  }

  access(options: Parameters<typeof accessRequest>[0]): this {
    return this.add(accessRequest(options));
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
