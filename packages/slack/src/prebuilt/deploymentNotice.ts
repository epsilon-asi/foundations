import type { Severity } from '../types/slack';
import { card } from './card';
import type { ActionDefinition, FieldDefinition } from './shared';

export type DeploymentStatus = 'started' | 'succeeded' | 'failed' | 'rolled_back';

export interface DeploymentNoticeOptions {
  service: string;
  environment: string;
  version: string;
  status: DeploymentStatus;
  actor?: string;
  commit?: string;
  url?: string;
}

const severityByStatus: Record<DeploymentStatus, Severity> = {
  started: 'info',
  succeeded: 'success',
  failed: 'danger',
  rolled_back: 'warning'
};

export function deploymentNotice(options: DeploymentNoticeOptions) {
  const fields: FieldDefinition[] = [
    { label: 'Service', value: options.service },
    { label: 'Environment', value: options.environment },
    { label: 'Version', value: options.version },
    { label: 'Status', value: options.status.replace('_', ' ') }
  ];

  if (options.actor) fields.push({ label: 'Actor', value: options.actor });
  if (options.commit) fields.push({ label: 'Commit', value: options.commit });

  const actions: ActionDefinition[] = options.url ? [{ text: 'View deployment', url: options.url, actionId: 'view_deployment' }] : [];

  return card({
    title: `${options.service} deploy ${options.status.replace('_', ' ')}`,
    severity: severityByStatus[options.status],
    fields,
    actions
  });
}
