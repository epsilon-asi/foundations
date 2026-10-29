import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BrowserFactory } from '../../../src/browser/BrowserFactory.js';
import type { PuppeteerConnectOptions, PuppeteerLauncher, PuppeteerLaunchOptions } from '../../../src/browser/PuppeteerLike.js';
import type { RuntimeConfig } from '../../../src/browser/RuntimeConfig.js';
import { ConfigError } from '../../../src/errors/ConfigError.js';
import { FakeBrowser, FakePage } from '../../fixtures/FakePage.js';

class ThrowingLauncher implements PuppeteerLauncher {
  async launch(): Promise<FakeBrowser> {
    throw new Error('DevToolsActivePort file does not exist; user data directory is already in use');
  }

  async connect(): Promise<FakeBrowser> {
    throw new Error('connect was not expected');
  }
}


class ThrowingLaunchConnectingLauncher implements PuppeteerLauncher {
  launchOptions?: PuppeteerLaunchOptions;
  connectOptions?: PuppeteerConnectOptions;

  constructor(readonly browser: FakeBrowser, private readonly connectError?: Error) {}

  async launch(options: PuppeteerLaunchOptions): Promise<FakeBrowser> {
    this.launchOptions = options;
    throw new Error('DevToolsActivePort file does not exist; user data directory is already in use');
  }

  async connect(options: PuppeteerConnectOptions): Promise<FakeBrowser> {
    this.connectOptions = options;
    if (this.connectError !== undefined) throw this.connectError;
    return this.browser;
  }
}

class ThrowingConnector implements PuppeteerLauncher {
  async launch(): Promise<FakeBrowser> {
    throw new Error('launch was not expected');
  }

  async connect(): Promise<FakeBrowser> {
    throw new Error('connect ECONNREFUSED 127.0.0.1:9222');
  }
}

class FakeLauncher implements PuppeteerLauncher {
  launchOptions?: PuppeteerLaunchOptions;
  connectOptions?: PuppeteerConnectOptions;

  constructor(readonly browser: FakeBrowser) {}

  async launch(options: PuppeteerLaunchOptions): Promise<FakeBrowser> {
    this.launchOptions = options;
    return this.browser;
  }

  async connect(options: PuppeteerConnectOptions): Promise<FakeBrowser> {
    this.connectOptions = options;
    return this.browser;
  }
}

function createProfileDirs(profileDirectory = 'Profile 1'): { userDataDir: string; profileDirectory: string } {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-user-data-'));
  fs.mkdirSync(path.join(userDataDir, profileDirectory));
  return { userDataDir, profileDirectory };
}

describe('BrowserFactory', () => {
  it('launches installed Chrome with an existing userDataDir and profile directory', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const fakePage = new FakePage();
    const fakeBrowser = new FakeBrowser([fakePage]);
    const launcher = new FakeLauncher(fakeBrowser);
    const factory = new BrowserFactory(launcher);

    const config: RuntimeConfig = {
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        channel: 'chrome',
        headless: false
      }
    };

    const session = await factory.launch(config);

    expect(launcher.launchOptions).toMatchObject({
      browser: 'chrome',
      channel: 'chrome',
      headless: false,
      userDataDir,
      args: [`--profile-directory=${profileDirectory}`]
    });
    expect(launcher.connectOptions).toBeUndefined();
    expect(session.context).toBe(fakeBrowser.context);
    expect(session.page).toBe(fakePage);
  });

  it('connects to an existing Chrome remote debugging endpoint', async () => {
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const launcher = new FakeLauncher(fakeBrowser);
    const factory = new BrowserFactory(launcher);

    const session = await factory.launch({
      browser: {
        mode: 'remote-debugging',
        browserURL: 'http://127.0.0.1:9222'
      }
    });

    expect(launcher.launchOptions).toBeUndefined();
    expect(launcher.connectOptions).toMatchObject({ browserURL: 'http://127.0.0.1:9222' });
    expect(session.profile).toMatchObject({
      mode: 'remote-debugging',
      browserURL: 'http://127.0.0.1:9222',
      closeBrowserOnFinish: false,
      disconnectOnFinish: true
    });
    expect(fakeBrowser.newPageCalls).toBe(1);
  });

  it('connects using browserWSEndpoint when configured', async () => {
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const launcher = new FakeLauncher(fakeBrowser);
    const factory = new BrowserFactory(launcher);

    await factory.launch({
      browser: {
        mode: 'remote-debugging',
        browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/test'
      }
    });

    expect(launcher.connectOptions).toMatchObject({
      browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/test'
    });
  });

  it('defaults remote-debugging mode to http://127.0.0.1:9222', async () => {
    const launcher = new FakeLauncher(new FakeBrowser([new FakePage()]));
    const factory = new BrowserFactory(launcher);

    await factory.launch({ browser: { mode: 'remote-debugging' } });

    expect(launcher.connectOptions).toMatchObject({ browserURL: 'http://127.0.0.1:9222' });
  });

  it('rejects remote-debugging configs that set both browserURL and browserWSEndpoint', async () => {
    const factory = new BrowserFactory(new FakeLauncher(new FakeBrowser()));

    await expect(factory.launch({
      browser: {
        mode: 'remote-debugging',
        browserURL: 'http://127.0.0.1:9222',
        browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/test'
      }
    })).rejects.toBeInstanceOf(ConfigError);
  });

  it('uses browser.defaultBrowserContext and never creates an isolated context', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const factory = new BrowserFactory(new FakeLauncher(fakeBrowser));

    await factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        headless: false,
        runningInstance: { enabled: false }
      }
    });

    expect(fakeBrowser.defaultBrowserContextCalls).toBe(1);
    expect(fakeBrowser.createBrowserContextCalls).toBe(0);
  });

  it('defaults to channel chrome and headless false', () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const factory = new BrowserFactory(new FakeLauncher(new FakeBrowser()));

    const options = factory.buildLaunchOptions({
      mode: 'existing-profile',
      userDataDir,
      profileDirectory
    });

    expect(options.channel).toBe('chrome');
    expect(options.headless).toBe(false);
  });

  it('throws when userDataDir does not exist by default', async () => {
    const missingDir = path.join(os.tmpdir(), `missing-${Date.now()}`);
    const factory = new BrowserFactory(new FakeLauncher(new FakeBrowser()));

    await expect(factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir: missingDir,
        headless: false
      }
    })).rejects.toBeInstanceOf(ConfigError);
  });

  it('throws when a configured profileDirectory is missing by default', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-user-data-'));
    const factory = new BrowserFactory(new FakeLauncher(new FakeBrowser()));

    await expect(factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory: 'Missing Profile',
        headless: false
      }
    })).rejects.toBeInstanceOf(ConfigError);
  });


  it('automatically tries the default local debugging endpoint when an existing profile is already running', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const launcher = new ThrowingLaunchConnectingLauncher(fakeBrowser);
    const factory = new BrowserFactory(launcher);

    const session = await factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        headless: false
      }
    });

    expect(launcher.launchOptions).toMatchObject({ userDataDir });
    expect(launcher.connectOptions).toMatchObject({ browserURL: 'http://127.0.0.1:9222' });
    expect(session.connectionMode).toBe('connected');
    expect(session.profile).toMatchObject({
      mode: 'remote-debugging',
      remoteDebuggingHost: '127.0.0.1',
      remoteDebuggingPort: 9222,
      closeBrowserOnFinish: false,
      disconnectOnFinish: true
    });
  });


  it('falls back to a local debugging endpoint when an existing profile is already running and fallback is enabled', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const launcher = new ThrowingLaunchConnectingLauncher(fakeBrowser);
    const factory = new BrowserFactory(launcher);

    const session = await factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory
      }
    });

    expect(launcher.launchOptions).toMatchObject({ userDataDir });
    expect(launcher.connectOptions).toMatchObject({ browserURL: 'http://127.0.0.1:9222' });
    expect(session.connectionMode).toBe('connected');
    expect(session.profile).toMatchObject({
      mode: 'remote-debugging',
      remoteDebuggingHost: '127.0.0.1',
      remoteDebuggingPort: 9222,
      closeBrowserOnFinish: false,
      disconnectOnFinish: true
    });
    expect(fakeBrowser.newPageCalls).toBe(1);
  });

  it('uses the configured running-profile WebSocket endpoint when fallback is enabled', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const launcher = new ThrowingLaunchConnectingLauncher(new FakeBrowser([new FakePage()]));
    const factory = new BrowserFactory(launcher);

    await factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        runningInstance: {
          enabled: true,
          browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/test',
          reuseExistingPage: true
        }
      }
    });

    expect(launcher.connectOptions).toMatchObject({
      browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/test'
    });
  });

  it('throws a fallback-specific error when the running profile debugging endpoint is unavailable', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const launcher = new ThrowingLaunchConnectingLauncher(new FakeBrowser(), new Error('connect ECONNREFUSED 127.0.0.1:9222'));
    const factory = new BrowserFactory(launcher);

    await expect(factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        runningInstance: { enabled: true }
      }
    })).rejects.toMatchObject({
      name: 'ConfigError',
      message: expect.stringContaining('local DevTools endpoint could not be reached'),
      details: expect.objectContaining({
        browserURL: 'http://127.0.0.1:9222'
      })
    });
  });

  it('explains likely profile lock launch failures', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const factory = new BrowserFactory(new ThrowingLauncher());

    await expect(factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        headless: false,
        runningInstance: { enabled: false }
      }
    })).rejects.toThrow(/local remote debugging endpoint|already be running/);
  });

  it('explains remote debugging connection failures', async () => {
    const factory = new BrowserFactory(new ThrowingConnector());

    await expect(factory.launch({
      browser: {
        mode: 'remote-debugging',
        browserURL: 'http://127.0.0.1:9222'
      }
    })).rejects.toThrow(/debugging endpoint/);
  });

  it('creates a new page when reuseExistingPage is false', async () => {
    const { userDataDir, profileDirectory } = createProfileDirs();
    const fakeBrowser = new FakeBrowser([new FakePage()]);
    const factory = new BrowserFactory(new FakeLauncher(fakeBrowser));

    const session = await factory.launch({
      browser: {
        mode: 'existing-profile',
        userDataDir,
        profileDirectory,
        reuseExistingPage: false,
        headless: false
      }
    });

    expect(fakeBrowser.newPageCalls).toBe(1);
    expect(session.page).not.toBe((await fakeBrowser.pages())[0]);
  });
});
