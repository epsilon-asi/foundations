import { describe, expect, it } from 'vitest';
import {
  createMessage,
  errorReport,
  maintenanceNotice,
  onCallHandoff,
  pipelineStatus,
  pullRequest,
  releaseNotes,
  resolveComponent,
  securityAlert
} from '../src';

type ActionsLike = { type: string; elements: Array<{ action_id?: string; value?: string; style?: string; text?: { text: string } }> };

function actionsOf(blocks: Array<{ type: string }>): ActionsLike['elements'] {
  const block = blocks.find((candidate) => candidate.type === 'actions') as ActionsLike | undefined;
  return block?.elements ?? [];
}

describe('engineering and IT components', () => {
  it('renders pull requests across states with changes, branches, and labels', () => {
    const rendered = resolveComponent(pullRequest({
      repository: 'acme/web',
      number: 482,
      title: 'Add dark mode',
      author: 'Ana',
      url: 'https://example.com/pr/482',
      state: 'approved',
      description: 'Implements the theme toggle.',
      reviewers: ['Ben', 'Cy'],
      additions: 120,
      deletions: 30,
      filesChanged: 1,
      headBranch: 'feat/dark-mode',
      baseBranch: 'main',
      labels: ['frontend', 'ux'],
      actions: [{ text: 'Merge', value: 'merge' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('+120 / −30 in 1 file');
    expect(text).toContain('`feat/dark-mode` → `main`');
    expect(text).toContain('🏷️ frontend · ux');
    expect(actionsOf(rendered.blocks)[0]).toMatchObject({ style: 'primary', text: { text: 'Review' } });
    expect(rendered.fallbackText).toBe('acme/web#482: Add dark mode (✅ Approved) by Ana');

    const merged = resolveComponent(pullRequest({ repository: 'r', number: 1, title: 't', author: 'a', url: 'https://example.com', state: 'merged', deletions: 4 }));
    expect(actionsOf(merged.blocks)[0]).toMatchObject({ text: { text: 'View' } });
    expect(actionsOf(merged.blocks)[0]?.style).toBeUndefined();
    expect(JSON.stringify(merged.blocks)).toContain('+0 / −4');

    const many = resolveComponent(pullRequest({ repository: 'r', number: 2, title: 't', author: 'a', url: 'https://example.com', additions: 1, filesChanged: 3 }));
    expect(JSON.stringify(many.blocks)).toContain('in 3 files');
    expect(many.fallbackText).toContain('🟢 Open');
  });

  it('renders pipeline status with stages and status-specific actions', () => {
    const failed = resolveComponent(pipelineStatus({
      pipeline: 'web-ci',
      status: 'failed',
      branch: 'main',
      commit: 'a1b2c3d',
      triggeredBy: 'Ana',
      duration: '6m 12s',
      runId: 'run-77',
      url: 'https://example.com/run/77',
      stages: [
        { name: 'Install', status: 'passed', duration: '40s' },
        { name: 'Test', status: 'failed' },
        { name: 'Deploy', status: 'skipped' }
      ],
      actions: [{ text: 'Logs', url: 'https://example.com/logs' }]
    }));
    expect(failed.blocks[0]).toMatchObject({ text: { text: '❌ web-ci failed' } });
    expect(actionsOf(failed.blocks).map((button) => button.action_id)).toEqual(['run_77_view_run', 'run_77_retry', 'action_logs']);
    expect(JSON.stringify(failed.blocks)).toContain('✅ Install · 40s');

    const running = resolveComponent(pipelineStatus({ pipeline: 'api-ci', status: 'running' }));
    expect(actionsOf(running.blocks)[0]).toMatchObject({ action_id: 'api_ci_cancel', value: 'api-ci' });

    const passed = resolveComponent(pipelineStatus({ pipeline: 'docs', status: 'passed' }));
    expect(passed.blocks).toHaveLength(1);
    for (const status of ['pending', 'cancelled'] as const) {
      expect(resolveComponent(pipelineStatus({ pipeline: 'x', status })).fallbackText).toContain(status);
    }
  });

  it('renders error reports with stack traces, stats, and triage actions', () => {
    const stack = Array.from({ length: 15 }, (_, index) => `at frame${index} (app.ts:${index})`).join('\n');
    const rendered = resolveComponent(errorReport({
      title: 'TypeError in checkout',
      service: 'checkout-web',
      environment: 'production',
      message: "Cannot read properties of undefined (reading 'total') ```",
      level: 'fatal',
      stackTrace: stack,
      occurrences: 1_204,
      usersAffected: 311,
      firstSeen: '10:02',
      lastSeen: '10:41',
      url: 'https://example.com/issue/9',
      issueId: 'ERR-9',
      actions: [{ text: 'Ignore', value: 'ignore' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('3 more lines');
    expect(text).toContain("'''");
    expect(actionsOf(rendered.blocks).map((button) => button.action_id)).toEqual(['err_9_view', 'err_9_assign', 'err_9_resolve', 'action_ignore']);
    expect(rendered.fallbackText).toContain('FATAL: TypeError in checkout');

    const assigned = resolveComponent(errorReport({
      title: 'Slow query',
      service: 'db',
      message: 'Query took 9s',
      level: 'warning',
      assignee: 'Ben',
      stackTrace: 'one\ntwo',
      maxStackLines: 1
    }));
    expect(assigned.blocks[0]).toMatchObject({ text: { text: '⚠️ Slow query' } });
    expect(JSON.stringify(assigned.blocks)).toContain('1 more line\\n');
    expect(actionsOf(assigned.blocks).map((button) => button.text?.text)).toEqual(['Resolve']);

    const minimal = resolveComponent(errorReport({ title: 'Boom', service: 'api', message: 'boom' }));
    expect(minimal.blocks).toHaveLength(3);
    expect(createMessage([errorReport({ title: 'Valid', service: 'api', message: 'ok' })]).blocks.length).toBe(3);
  });

  it('renders release notes groups, truncation, and empty release', () => {
    const rendered = resolveComponent(releaseNotes({
      product: 'Acme App',
      version: 'v3.2.0',
      date: 'Oct 30',
      summary: 'Faster and friendlier.',
      breaking: ['Removed legacy API'],
      features: ['Dark mode', 'Saved searches', 'Bulk edit'],
      improvements: ['Faster load'],
      fixes: ['Login loop'],
      maxItemsPerSection: 2,
      url: 'https://example.com/changelog',
      actions: [{ text: 'Docs', url: 'https://example.com/docs' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('_+1 more_');
    expect(text.indexOf('Breaking')).toBeLessThan(text.indexOf('✨ New'));
    expect(rendered.fallbackText).toBe('Released Acme App v3.2.0 • 1 breaking change');

    const empty = resolveComponent(releaseNotes({ version: '1.0.1' }));
    expect(JSON.stringify(empty.blocks)).toContain('No notable changes');
    expect(empty.fallbackText).toBe('Released 1.0.1');
    const twoBreaking = resolveComponent(releaseNotes({ version: '2.0', breaking: ['a', 'b'] }));
    expect(twoBreaking.fallbackText).toContain('2 breaking changes');
  });

  it('renders on-call handoffs with and without open incidents', () => {
    const rendered = resolveComponent(onCallHandoff({
      rotation: 'Platform',
      from: 'Ana',
      to: 'Ben',
      startsAt: 'Mon 09:00',
      endsAt: 'Mon 09:00 +7d',
      openIncidents: [
        { id: 'INC-1', title: 'Elevated 5xx', severity: 'danger', url: 'https://example.com/inc/1' },
        { id: 'INC-2', title: 'Disk 80%' }
      ],
      notes: ['Watch the cache cluster.', 'Vendor maintenance Tue.'],
      scheduleUrl: 'https://example.com/schedule',
      actions: [{ text: 'Runbooks', url: 'https://example.com/runbooks' }]
    }));
    const text = JSON.stringify(rendered.blocks);
    expect(text).toContain('Open incidents (2)');
    expect(text).toContain('🚨 <https://example.com/inc/1|INC-1: Elevated 5xx>');
    expect(text).toContain('⚠️ INC-2: Disk 80%');
    expect(rendered.fallbackText).toBe('Platform on-call: Ana → Ben • 2 open incidents');

    const quiet = resolveComponent(onCallHandoff({ rotation: 'Data', from: 'Cy', to: 'Di', openIncidents: [{ id: 'I', title: 't' }].slice(1) }));
    expect(JSON.stringify(quiet.blocks)).toContain('No open incidents');
    expect(quiet.fallbackText).toContain('0 open incidents');
    expect(resolveComponent(onCallHandoff({ rotation: 'X', from: 'a', to: 'b', openIncidents: [{ id: '1', title: 'x' }] })).fallbackText).toContain('1 open incident');
  });

  it('renders maintenance notices for each status', () => {
    const rendered = resolveComponent(maintenanceNotice({
      title: 'Database upgrade',
      status: 'scheduled',
      startsAt: 'Sat 02:00 UTC',
      endsAt: '04:00 UTC',
      description: 'Upgrading to Postgres 17.',
      services: ['API', 'Dashboard'],
      impact: 'Read-only for ~10 minutes',
      statusUrl: 'https://status.example.com',
      actions: [{ text: 'Subscribe', value: 'sub' }]
    }));
    expect(rendered.blocks[0]).toMatchObject({ text: { text: 'ℹ️ Database upgrade' } });
    expect(actionsOf(rendered.blocks)[0]?.action_id).toBe('open_status_page');

    const severities = (['in_progress', 'extended', 'completed', 'cancelled'] as const).map(
      (status) => (resolveComponent(maintenanceNotice({ title: 'M', status, startsAt: 'now' })).blocks[0] as { text: { text: string } }).text.text
    );
    expect(severities).toEqual(['⚠️ M', '⚠️ M', '✅ M', '• M']);
  });

  it('renders security alerts with verification actions', () => {
    const rendered = resolveComponent(securityAlert({
      title: 'New sign-in detected',
      description: 'We noticed a sign-in from a new device.',
      user: 'ana@example.com',
      occurredAt: 'Oct 30 03:12 UTC',
      ipAddress: '203.0.113.7',
      location: 'Lisbon, PT',
      device: 'Chrome on Windows',
      alertId: 'sec-42',
      url: 'https://example.com/security/42',
      actions: [{ text: 'Contact IT', url: 'https://example.com/it' }]
    }));
    expect(actionsOf(rendered.blocks).map((button) => button.action_id)).toEqual(['sec_42_confirm', 'sec_42_report', 'sec_42_details', 'action_contact_it']);
    expect(JSON.stringify(rendered.blocks)).toContain('`203.0.113.7`');

    const informational = resolveComponent(securityAlert({ title: 'Password changed', description: 'Your password was changed.', severity: 'info', verify: false }));
    expect(informational.blocks.some((block) => block.type === 'actions')).toBe(false);
    expect(informational.blocks[0]).toMatchObject({ text: { text: 'ℹ️ Password changed' } });
  });
});
