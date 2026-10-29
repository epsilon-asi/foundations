import { WebClient } from '@slack/web-api';
import { SlackMessenger, createWebApiTransport, prebuilt } from  '../src';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const slack = new SlackMessenger(createWebApiTransport(client));

export async function sendDeploymentNotice(): Promise<void> {
  const result = await slack.send(
    'C0123456789',
    prebuilt.deploymentNotice({
      service: 'checkout-api',
      environment: 'production',
      version: '2026.05.20-1',
      status: 'succeeded',
      actor: '<@U123456>',
      commit: 'abc1234',
      url: 'https://deployments.example.com/checkout-api/2026.05.20-1'
    }),
    { threadTs: undefined }
  );

  if (!result.ok) {
    throw new Error(`Slack send failed: ${result.error ?? 'unknown error'}`);
  }
}
