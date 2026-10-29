import os from 'node:os';
import path from 'node:path';
import type { HumanTypingOptions } from '../interaction/HumanTyping.js';

export type ChromeReleaseChannel = 'chrome' | 'chrome-beta' | 'chrome-dev' | 'chrome-canary';

const DEFAULT_VIEWPORT = { width: 2309, height: 1429 };

export interface BrowserSessionBehavior {
  defaultViewport?: { width: number; height: number } | null;
  startUrl?: string;
  reuseExistingPage?: boolean;
  /**
   * Existing-profile mode defaults to true because the framework owns the browser it launched.
   * Remote-debugging mode defaults to false because Chrome is usually a long-lived host process.
   */
  closeBrowserOnFinish?: boolean;
}

export interface RemoteDebuggingEndpointConfig {
  /**
   * HTTP endpoint for an already-running Chrome instance, e.g. http://127.0.0.1:9222.
   * Use either browserURL or browserWSEndpoint, not both.
   */
  browserURL?: string;
  /** WebSocket endpoint from /json/version, e.g. ws://127.0.0.1:9222/devtools/browser/<id>. */
  browserWSEndpoint?: string;
  /** Used only when browserURL and browserWSEndpoint are omitted. */
  remoteDebuggingHost?: string;
  /** Used only when browserURL and browserWSEndpoint are omitted. */
  remoteDebuggingPort?: number;
  protocolTimeout?: number;
  slowMo?: number;
}

export interface RunningChromeInstanceConfig extends RemoteDebuggingEndpointConfig {
  /**
   * If false, disables automatic attach when an existing-profile launch fails
   * because the profile is already running. Defaults to true.
   */
  enabled?: boolean;
  /** Connected runs should usually open a fresh tab. Defaults to false. */
  reuseExistingPage?: boolean;
  /** A running Chrome host should not be closed by default. Defaults to false. */
  closeBrowserOnFinish?: boolean;
  /** Disconnect the Puppeteer client on finish. Defaults to true. */
  disconnectOnFinish?: boolean;
}

export interface ExistingChromeProfileConfig extends BrowserSessionBehavior {
  mode: 'existing-profile';
  /** Parent user data directory, not the nested profile folder. */
  userDataDir: string;
  /** Profile folder within userDataDir, e.g. Default or Profile 1. */
  profileDirectory?: string;
  channel?: ChromeReleaseChannel;
  executablePath?: string;
  headless?: false;
  args?: string[];
  allowCreatingUserDataDir?: boolean;
  allowCreatingProfileDirectory?: boolean;
  dumpio?: boolean;

  /**
   * Endpoint to try when this profile is already locked/running. If omitted,
   * the framework still tries http://127.0.0.1:9222 by default. Set
   * { enabled: false } to disable automatic attach.
   */
  runningInstance?: RunningChromeInstanceConfig;
}

export interface RemoteDebuggingChromeConfig extends BrowserSessionBehavior, RemoteDebuggingEndpointConfig {
  mode: 'remote-debugging';
  /** Disconnect the Puppeteer client on finish. Defaults to true. */
  disconnectOnFinish?: boolean;
}

export type BrowserRuntimeConfig = ExistingChromeProfileConfig | RemoteDebuggingChromeConfig;

export interface NativeRuntimeConfig {
  enabled?: boolean;
  platform?: 'macos';
  templatesDir?: string;
  imageConfidence?: number;
  mouse?: {
    jitterPixels?: number;
    minJitterPixels?: number;
    moveSpeed?: number;
    randomSeed?: number;
  };
  macos?: {
    targetApplicationName?: string;
    targetBundleId?: string;
    osascriptTimeoutMs?: number;
    preferAppleScriptForWindows?: boolean;
    preferVisualTemplatesForDialogs?: boolean;
  };
  coordinateCalibration?: {
    enabled?: boolean;
    markerSizePx?: number;
    timeoutMs?: number;
    cacheTtlMs?: number;
  };
}

export interface RuntimeConfig {
  browser: BrowserRuntimeConfig;
  defaultTimeoutMs?: number;
  navigationTimeoutMs?: number;
  interaction?: {
    typing?: HumanTypingOptions;
  };
  native?: NativeRuntimeConfig;
}

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith(`~${path.sep}`)) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function isExistingChromeProfileConfig(config: BrowserRuntimeConfig): config is ExistingChromeProfileConfig {
  return config.mode === 'existing-profile';
}

export function isRemoteDebuggingChromeConfig(config: BrowserRuntimeConfig): config is RemoteDebuggingChromeConfig {
  return config.mode === 'remote-debugging';
}

function normalizeRunningChromeInstanceConfig(config: RunningChromeInstanceConfig | undefined): RunningChromeInstanceConfig | undefined {
  if (config === undefined) return undefined;

  return {
    ...config,
    enabled: config.enabled ?? true,
    remoteDebuggingHost: config.remoteDebuggingHost ?? '127.0.0.1',
    remoteDebuggingPort: config.remoteDebuggingPort ?? 9222,
    reuseExistingPage: config.reuseExistingPage ?? false,
    closeBrowserOnFinish: config.closeBrowserOnFinish ?? false,
    disconnectOnFinish: config.disconnectOnFinish ?? true
  };
}

function normalizeExistingProfileConfig(browser: ExistingChromeProfileConfig): ExistingChromeProfileConfig {
  const runningInstance = normalizeRunningChromeInstanceConfig(browser.runningInstance);

  return {
    ...browser,
    userDataDir: path.resolve(expandHome(browser.userDataDir)),
    channel: browser.channel ?? 'chrome',
    headless: false,
    defaultViewport: browser.defaultViewport === undefined ? DEFAULT_VIEWPORT : browser.defaultViewport,
    reuseExistingPage: browser.reuseExistingPage ?? true,
    closeBrowserOnFinish: browser.closeBrowserOnFinish ?? true,
    allowCreatingUserDataDir: browser.allowCreatingUserDataDir ?? false,
    allowCreatingProfileDirectory: browser.allowCreatingProfileDirectory ?? false,
    ...(runningInstance !== undefined ? { runningInstance } : {})
  };
}

function normalizeNativeRuntimeConfig(config: NativeRuntimeConfig): NativeRuntimeConfig {
  return {
    ...config,
    enabled: config.enabled ?? true,
    platform: config.platform ?? 'macos',
    imageConfidence: config.imageConfidence ?? 0.9,
    mouse: {
      ...config.mouse,
      jitterPixels: config.mouse?.jitterPixels ?? 3,
      minJitterPixels: config.mouse?.minJitterPixels ?? 2
    },
    macos: {
      ...config.macos,
      targetApplicationName: config.macos?.targetApplicationName ?? 'Google Chrome',
      osascriptTimeoutMs: config.macos?.osascriptTimeoutMs ?? 15_000,
      preferAppleScriptForWindows: config.macos?.preferAppleScriptForWindows ?? true,
      preferVisualTemplatesForDialogs: config.macos?.preferVisualTemplatesForDialogs ?? false
    },
    coordinateCalibration: {
      ...config.coordinateCalibration,
      enabled: config.coordinateCalibration?.enabled ?? true,
      markerSizePx: config.coordinateCalibration?.markerSizePx ?? 22,
      timeoutMs: config.coordinateCalibration?.timeoutMs ?? 15_000,
      cacheTtlMs: config.coordinateCalibration?.cacheTtlMs ?? 60_000
    }
  };
}

function normalizeRemoteDebuggingConfig(browser: RemoteDebuggingChromeConfig): RemoteDebuggingChromeConfig {
  return {
    ...browser,
    remoteDebuggingHost: browser.remoteDebuggingHost ?? '127.0.0.1',
    remoteDebuggingPort: browser.remoteDebuggingPort ?? 9222,
    defaultViewport: browser.defaultViewport === undefined ? DEFAULT_VIEWPORT : browser.defaultViewport,
    reuseExistingPage: browser.reuseExistingPage ?? false,
    closeBrowserOnFinish: browser.closeBrowserOnFinish ?? false,
    disconnectOnFinish: browser.disconnectOnFinish ?? true
  };
}

export function normalizeRuntimeConfig(config: RuntimeConfig): RuntimeConfig {
  return {
    ...config,
    browser: config.browser.mode === 'existing-profile'
      ? normalizeExistingProfileConfig(config.browser)
      : normalizeRemoteDebuggingConfig(config.browser),
    defaultTimeoutMs: config.defaultTimeoutMs ?? 15_000,
    navigationTimeoutMs: config.navigationTimeoutMs ?? 30_000,
    ...(config.interaction !== undefined ? { interaction: config.interaction } : {}),
    ...(config.native !== undefined ? { native: normalizeNativeRuntimeConfig(config.native) } : {})
  };
}
