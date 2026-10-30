import { actions, button, context, fieldSections, header, mrkdwn, plainText, section } from '../blocks';
import { defineComponent, type RenderedComponent } from '../core/component';
import type { ButtonElement, SlackBlock } from '../types/slack';
import { slugify } from '../utils/ids';
import { compactJoin } from '../utils/text';
import { toFields, type FieldDefinition } from './shared';

export interface PolicyAcknowledgementOptions {
  policyName: string;
  summary: string;
  documentUrl: string;
  effectiveDate?: string;
  dueDate?: string;
  owner?: string;
  policyId?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
}

function renderPolicyAcknowledgement(options: PolicyAcknowledgementOptions): RenderedComponent {
  const blocks: SlackBlock[] = [header(`📜 ${options.policyName}`), section(options.summary)];

  const fields: FieldDefinition[] = [];
  if (options.effectiveDate) fields.push({ label: 'Effective', value: options.effectiveDate });
  if (options.dueDate) fields.push({ label: 'Acknowledge by', value: options.dueDate });
  if (options.owner) fields.push({ label: 'Policy owner', value: options.owner });
  if (fields.length) {
    blocks.push(...fieldSections(toFields(fields)));
  }

  const prefix = slugify(options.policyId ?? options.policyName, 'policy');
  const buttons: ButtonElement[] = [button({ text: 'Read policy', url: options.documentUrl, actionId: `${prefix}_read` })];

  if (!options.acknowledged) {
    buttons.unshift(
      button({
        text: 'I acknowledge',
        style: 'primary',
        actionId: `${prefix}_acknowledge`,
        value: options.policyId ?? prefix,
        confirm: {
          title: plainText('Acknowledge policy?'),
          text: mrkdwn(`You confirm you have read and understood *${options.policyName}*.`),
          confirm: plainText('Acknowledge'),
          deny: plainText('Not yet')
        }
      })
    );
  }
  blocks.push(actions(buttons));

  if (options.acknowledged) {
    blocks.push(context([compactJoin(['✅ Acknowledged', options.acknowledgedAt])]));
  }

  return {
    blocks,
    fallbackText: compactJoin([
      options.acknowledged ? `Acknowledged: ${options.policyName}` : `Please acknowledge: ${options.policyName}`,
      options.dueDate ? `Due ${options.dueDate}` : ''
    ])
  };
}

export const policyAcknowledgement = defineComponent<PolicyAcknowledgementOptions>('prebuilt.policyAcknowledgement', renderPolicyAcknowledgement);
