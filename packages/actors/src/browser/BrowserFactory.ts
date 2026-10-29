import puppeteer from 'puppeteer-core';
import { BrowserSession } from './BrowserSession.js';
import { ConfigError } from '../errors/ConfigError.js';
import type { BrowserRuntimeConfig, ExistingChromeProfileConfig, RemoteDebuggingChromeConfig, RuntimeConfig } from './RuntimeConfig.js';
import { isExistingChromeProfileConfig, isRemoteDebuggingChromeConfig, normalizeRuntimeConfig } from './RuntimeConfig.js';
import type { BrowserContextLike, BrowserLike, PageLike, PuppeteerConnectOptions, PuppeteerLauncher, PuppeteerLaunchOptions } from './PuppeteerLike.js';
import { validateExistingProfileConfig, validateRemoteDebuggingConfig } from './profileValidation.js';

export class BrowserFactory {
  constructor(private readonly launcher: PuppeteerLauncher = puppeteer as unknown as PuppeteerLauncher) {}

  buildLaunchOptions(profile: ExistingChromeProfileConfig): PuppeteerLaunchOptions {
    const args = [
      ...(profile.profileDirectory !== undefined ? [`--profile-directory=${profile.profileDirectory}`] : []),
      ...(profile.args ?? [])
    ];

    const options: PuppeteerLaunchOptions = {
      browser: 'chrome',
      channel: profile.channel ?? 'chrome',
      headless: false,
      userDataDir: profile.userDataDir,
      args
    };

    if (profile.executablePath !== undefined) options.executablePath = profile.executablePath;
    if (profile.defaultViewport !== undefined) options.defaultViewport = profile.defaultViewport;
    if (profile.dumpio !== undefined) options.dumpio = profile.dumpio;

    return options;
  }

  buildConnectOptions(config: RemoteDebuggingChromeConfig): PuppeteerConnectOptions {
    if (config.browserURL !== undefined && config.browserWSEndpoint !== undefined) {
      throw new ConfigError('Use either browser.browserURL or browser.browserWSEndpoint, not both.');
    }

    const options: Record<string, unknown> = {};

    if (config.browserWSEndpoint !== undefined) {
      options.browserWSEndpoint = config.browserWSEndpoint;
    } else {
      options.browserURL = config.browserURL ?? `http://${config.remoteDebuggingHost ?? '127.0.0.1'}:${config.remoteDebuggingPort ?? 9222}`;
    }

    if (config.defaultViewport !== undefined) options.defaultViewport = config.defaultViewport;
    if (config.protocolTimeout !== undefined) options.protocolTimeout = config.protocolTimeout;
    if (config.slowMo !== undefined) options.slowMo = config.slowMo;

    return options as PuppeteerConnectOptions;
  }

  async launch(config: RuntimeConfig): Promise<BrowserSession> {
    const normalized = normalizeRuntimeConfig(config);

    if (isExistingChromeProfileConfig(normalized.browser)) {
      return this.launchExistingProfile(normalized as RuntimeConfig & { browser: ExistingChromeProfileConfig });
    }

    if (isRemoteDebuggingChromeConfig(normalized.browser)) {
      return this.connectToRemoteDebuggingBrowser(normalized as RuntimeConfig & { browser: RemoteDebuggingChromeConfig });
    }

    throw new ConfigError('Unsupported browser mode.');
  }

  private async launchExistingProfile(config: RuntimeConfig & { browser: ExistingChromeProfileConfig }): Promise<BrowserSession> {
    validateExistingProfileConfig(config.browser);

    let browser: BrowserLike;
    try {
      browser = await this.launcher.launch(this.buildLaunchOptions(config.browser));
    } catch (error) {
      if ((config.browser.runningInstance?.enabled ?? true) && isLikelyProfileInUseError(error)) {
        return this.connectToAlreadyRunningProfile(config, error);
      }

      throw explainLaunchFailure(error, config.browser);
    }

    const { context, page } = await this.preparePage(browser, config);
    return new BrowserSession(browser, context, page, config.browser, 'launched');
  }

  private async connectToAlreadyRunningProfile(
    config: RuntimeConfig & { browser: ExistingChromeProfileConfig },
    launchError: unknown
  ): Promise<BrowserSession> {
    const remoteBrowser = this.buildProfileLockedConnectConfig(config.browser);
    validateRemoteDebuggingConfig(remoteBrowser);

    const connect = this.launcher.connect;
    if (connect === undefined) {
      throw new ConfigError('Chrome profile is already running, but the configured Puppeteer launcher does not support connect().', {
        cause: launchError,
        details: profileLockConnectDetails(config.browser, remoteBrowser, launchError)
      });
    }

    let browser: BrowserLike;
    try {
      browser = await connect.call(this.launcher, this.buildConnectOptions(remoteBrowser));
    } catch (connectError) {
      throw explainProfileLockedConnectFailure(connectError, config.browser, remoteBrowser, launchError);
    }

    const connectedRuntimeConfig: RuntimeConfig & { browser: RemoteDebuggingChromeConfig } = {
      ...config,
      browser: remoteBrowser
    };
    const { context, page } = await this.preparePage(browser, connectedRuntimeConfig);
    return new BrowserSession(browser, context, page, remoteBrowser, 'connected');
  }

  private buildProfileLockedConnectConfig(profile: ExistingChromeProfileConfig): RemoteDebuggingChromeConfig {
    const running = profile.runningInstance ?? {};
    const remoteBrowser: RemoteDebuggingChromeConfig = {
      mode: 'remote-debugging',
      remoteDebuggingHost: running.remoteDebuggingHost ?? '127.0.0.1',
      remoteDebuggingPort: running.remoteDebuggingPort ?? 9222,
      reuseExistingPage: running.reuseExistingPage ?? false,
      closeBrowserOnFinish: false,
      disconnectOnFinish: running.disconnectOnFinish ?? true
    };

    if (running.browserURL !== undefined) remoteBrowser.browserURL = running.browserURL;
    if (running.browserWSEndpoint !== undefined) remoteBrowser.browserWSEndpoint = running.browserWSEndpoint;
    if (running.protocolTimeout !== undefined) remoteBrowser.protocolTimeout = running.protocolTimeout;
    if (running.slowMo !== undefined) remoteBrowser.slowMo = running.slowMo;
    if (profile.defaultViewport !== undefined) remoteBrowser.defaultViewport = profile.defaultViewport;
    if (profile.startUrl !== undefined) remoteBrowser.startUrl = profile.startUrl;

    return remoteBrowser;
  }

  private async connectToRemoteDebuggingBrowser(config: RuntimeConfig & { browser: RemoteDebuggingChromeConfig }): Promise<BrowserSession> {
    validateRemoteDebuggingConfig(config.browser);

    const connect = this.launcher.connect;
    if (connect === undefined) {
      throw new ConfigError('The configured Puppeteer launcher does not support connect().');
    }

    let browser: BrowserLike;
    try {
      browser = await connect.call(this.launcher, this.buildConnectOptions(config.browser));
    } catch (error) {
      throw explainConnectFailure(error, config.browser);
    }

    const { context, page } = await this.preparePage(browser, config);
    return new BrowserSession(browser, context, page, config.browser, 'connected');
  }

  private async preparePage(browser: BrowserLike, config: RuntimeConfig & { browser: BrowserRuntimeConfig }): Promise<{ context: BrowserContextLike; page: PageLike }> {
    const context = browser.defaultBrowserContext();
    const pages = await browser.pages();
    const page = config.browser.reuseExistingPage !== false && pages[0] !== undefined
      ? pages[0]
      : await browser.newPage();

    page.setDefaultTimeout?.(config.defaultTimeoutMs ?? 15_000);
    page.setDefaultNavigationTimeout?.(config.navigationTimeoutMs ?? 30_000);

    if (config.browser.startUrl !== undefined) {
      await page.goto(config.browser.startUrl, { waitUntil: 'domcontentloaded' });
    }

    return { context, page };
  }
}

function isLikelyProfileInUseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /DevToolsActivePort|SingletonLock|already\s+(?:in\s+use|running)|browser is already running|userDataDir|user data directory|profile.*(?:lock|in use|running)/i.test(message);
}

function explainLaunchFailure(error: unknown, profile: ExistingChromeProfileConfig): ConfigError {
  const message = error instanceof Error ? error.message : String(error);
  const likelyProfileIssue = isLikelyProfileInUseError(error) || /profile/i.test(message);

  if (likelyProfileIssue) {
    return new ConfigError(
      'Could not launch Chrome with the configured existing profile because it appears to already be running. Close other Chrome windows using this profile, or start Chrome once with a local remote debugging endpoint and let existing-profile mode connect to it.',
      {
        cause: error,
        details: {
          userDataDir: profile.userDataDir,
          profileDirectory: profile.profileDirectory ?? '(default)',
          launchError: message
        }
      }
    );
  }

  return new ConfigError('Could not launch Chrome with the configured existing profile.', {
    cause: error,
    details: {
      userDataDir: profile.userDataDir,
      profileDirectory: profile.profileDirectory ?? '(default)',
      launchError: message
    }
  });
}

function explainConnectFailure(error: unknown, config: RemoteDebuggingChromeConfig): ConfigError {
  const message = error instanceof Error ? error.message : String(error);
  return new ConfigError(
    'Could not connect to the existing Chrome debugging endpoint. Make sure Chrome was started with --remote-debugging-port and that the browserURL/browserWSEndpoint is correct.',
    {
      cause: error,
      details: {
        browserURL: config.browserURL ?? `http://${config.remoteDebuggingHost ?? '127.0.0.1'}:${config.remoteDebuggingPort ?? 9222}`,
        browserWSEndpoint: config.browserWSEndpoint ?? '(not configured)',
        connectError: message
      }
    }
  );
}

function explainProfileLockedConnectFailure(
  connectError: unknown,
  profile: ExistingChromeProfileConfig,
  remoteBrowser: RemoteDebuggingChromeConfig,
  launchError: unknown
): ConfigError {
  const connectMessage = connectError instanceof Error ? connectError.message : String(connectError);
  return new ConfigError(
    'Chrome profile is already running, but the configured local DevTools endpoint could not be reached. Ensure Chrome was started with --remote-debugging-port and that the endpoint is bound only to localhost.',
    {
      cause: connectError,
      details: profileLockConnectDetails(profile, remoteBrowser, launchError, connectMessage)
    }
  );
}

function profileLockConnectDetails(
  profile: ExistingChromeProfileConfig,
  remoteBrowser: RemoteDebuggingChromeConfig,
  launchError: unknown,
  connectError?: string
): Record<string, unknown> {
  const launchMessage = launchError instanceof Error ? launchError.message : String(launchError);
  return {
    userDataDir: profile.userDataDir,
    profileDirectory: profile.profileDirectory ?? '(default)',
    endpoint: remoteBrowser.browserWSEndpoint ?? remoteBrowser.browserURL ?? `http://${remoteBrowser.remoteDebuggingHost ?? '127.0.0.1'}:${remoteBrowser.remoteDebuggingPort ?? 9222}`,
    browserURL: remoteBrowser.browserURL ?? `http://${remoteBrowser.remoteDebuggingHost ?? '127.0.0.1'}:${remoteBrowser.remoteDebuggingPort ?? 9222}`,
    browserWSEndpoint: remoteBrowser.browserWSEndpoint ?? '(not configured)',
    launchError: launchMessage,
    ...(connectError !== undefined ? { connectError } : {})
  };
}
