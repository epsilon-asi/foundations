#!/usr/bin/env node
import { ActorRegistry } from '../core/ActorRegistry.js';
import { ActorRunner } from '../core/ActorRunner.js';
import { exampleActor } from '../sites/example/example.actor.js';
import type { ExistingChromeProfileConfig, RemoteDebuggingChromeConfig, RuntimeConfig, RunningChromeInstanceConfig } from '../browser/RuntimeConfig.js';

async function main(): Promise<void> {
  const [actorId, taskName, inputJson] = process.argv.slice(2);
  if (actorId === undefined || taskName === undefined) {
    console.error('Usage: paf <actorId> <taskName> [jsonInput]');
    process.exitCode = 1;
    return;
  }

  const config = readRuntimeConfigFromEnv();
  const registry = new ActorRegistry().register(exampleActor);
  const runner = new ActorRunner({ config, registry });
  const input = inputJson === undefined ? undefined : JSON.parse(inputJson);
  const result = await runner.runRegistered(actorId, taskName, input);
  console.log(JSON.stringify(result, null, 2));
}

function readRuntimeConfigFromEnv(): RuntimeConfig {
  const userDataDir = process.env.CHROME_USER_DATA_DIR;
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY;
  const browserURL = process.env.CHROME_REMOTE_DEBUGGING_URL;
  const browserWSEndpoint = process.env.CHROME_WS_ENDPOINT ?? process.env.CHROME_BROWSER_WS_ENDPOINT ?? process.env.CHROME_REMOTE_DEBUGGING_WS_ENDPOINT;
  const connectToDefaultEndpoint = process.env.CHROME_CONNECT === '1' || process.env.CHROME_CONNECT === 'true';
  const remoteDebuggingHost = process.env.CHROME_REMOTE_DEBUGGING_HOST;
  const remoteDebuggingPort = parseOptionalInteger(process.env.CHROME_REMOTE_DEBUGGING_PORT);
  const reuseExistingPage = parseOptionalBoolean(process.env.CHROME_REUSE_EXISTING_PAGE);

  if (userDataDir !== undefined && userDataDir.length > 0) {
    const browser: ExistingChromeProfileConfig = {
      mode: 'existing-profile',
      userDataDir,
      channel: 'chrome',
      headless: false
    };

    if (profileDirectory !== undefined && profileDirectory.length > 0) browser.profileDirectory = profileDirectory;

    const runningInstance = buildRunningInstanceConfig({
      enabled: parseOptionalBoolean(process.env.CHROME_CONNECT_TO_RUNNING_PROFILE),
      browserURL,
      browserWSEndpoint,
      remoteDebuggingHost,
      remoteDebuggingPort,
      reuseExistingPage
    });
    if (runningInstance !== undefined) browser.runningInstance = runningInstance;

    return { browser };
  }

  if (connectToDefaultEndpoint || (browserURL !== undefined && browserURL.length > 0) || (browserWSEndpoint !== undefined && browserWSEndpoint.length > 0)) {
    const browser: RemoteDebuggingChromeConfig = { mode: 'remote-debugging' };

    if (browserURL !== undefined && browserURL.length > 0) browser.browserURL = browserURL;
    if (browserWSEndpoint !== undefined && browserWSEndpoint.length > 0) browser.browserWSEndpoint = browserWSEndpoint;
    if (remoteDebuggingHost !== undefined && remoteDebuggingHost.length > 0) browser.remoteDebuggingHost = remoteDebuggingHost;
    if (remoteDebuggingPort !== undefined) browser.remoteDebuggingPort = remoteDebuggingPort;
    if (reuseExistingPage !== undefined) browser.reuseExistingPage = reuseExistingPage;

    return { browser };
  }

  throw new Error('Set CHROME_USER_DATA_DIR to launch/connect to a Chrome profile, or set CHROME_REMOTE_DEBUGGING_URL/CHROME_CONNECT to connect to an already-running Chrome.');
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.length === 0) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected an integer for CHROME_REMOTE_DEBUGGING_PORT, got: ${value}`);
  }
  return parsed;
}

interface EnvRunningInstanceInput {
  enabled?: boolean | undefined;
  browserURL?: string | undefined;
  browserWSEndpoint?: string | undefined;
  remoteDebuggingHost?: string | undefined;
  remoteDebuggingPort?: number | undefined;
  reuseExistingPage?: boolean | undefined;
}

function buildRunningInstanceConfig(input: EnvRunningInstanceInput): RunningChromeInstanceConfig | undefined {
  const config: RunningChromeInstanceConfig = {};

  if (input.enabled !== undefined) config.enabled = input.enabled;
  if (input.browserURL !== undefined && input.browserURL.length > 0) config.browserURL = input.browserURL;
  if (input.browserWSEndpoint !== undefined && input.browserWSEndpoint.length > 0) config.browserWSEndpoint = input.browserWSEndpoint;
  if (input.remoteDebuggingHost !== undefined && input.remoteDebuggingHost.length > 0) config.remoteDebuggingHost = input.remoteDebuggingHost;
  if (input.remoteDebuggingPort !== undefined) config.remoteDebuggingPort = input.remoteDebuggingPort;
  if (input.reuseExistingPage !== undefined) config.reuseExistingPage = input.reuseExistingPage;

  return Object.keys(config).length === 0 ? undefined : config;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value.length === 0) return undefined;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  throw new Error(`Expected a boolean-like value for environment variable, got: ${value}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
