import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BrowserFactory } from '../../../src/browser/BrowserFactory.js';
import { BrowserSession } from '../../../src/browser/BrowserSession.js';
import type { RuntimeConfig } from '../../../src/browser/RuntimeConfig.js';
import { defineActor } from '../../../src/core/defineActor.js';
import { ActorRunner } from '../../../src/core/ActorRunner.js';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { MemoryLogger } from '../../../src/logging/MemoryLogger.js';
import type { NativeAutomation } from '../../../src/native/types.js';
import { FakeHumanInteractor } from '../../fixtures/FakeCursor.js';
import { FakeBrowser, FakePage } from '../../fixtures/FakePage.js';
import { createFakeNativeAutomation } from '../../fixtures/native/FakeNativeAutomation.js';

class StaticBrowserFactory extends BrowserFactory {
  constructor(private readonly session: BrowserSession) {
    super();
  }

  override async launch(): Promise<BrowserSession> {
    return this.session;
  }
}

function createConfig(): RuntimeConfig {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-native-runner-'));
  fs.mkdirSync(path.join(userDataDir, 'Default'));
  return {
    browser: {
      mode: 'existing-profile',
      userDataDir,
      profileDirectory: 'Default',
      headless: false
    }
  };
}

describe('ActorRunner native automation integration', () => {
  it('injects context.native from the configured nativeAutomationFactory', async () => {
    const config = createConfig();
    const page = new FakePage();
    const browser = new FakeBrowser([page]);
    const session = new BrowserSession(browser, browser.context, page, config.browser);
    const native = createFakeNativeAutomation();
    native.windows.windows = [{ title: 'Chrome', appName: 'Google Chrome', region: { x: 0, y: 0, width: 100, height: 100 } }];

    const runner = new ActorRunner({
      config,
      browserFactory: new StaticBrowserFactory(session),
      loginFlow: { ensureAuthenticated: async () => undefined } as never,
      logger: new MemoryLogger(),
      interactorFactory: () => new FakeHumanInteractor(),
      pageAdapterFactory: pageLike => new PuppeteerPageAdapter(pageLike),
      nativeAutomationFactory: () => native as NativeAutomation
    });

    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        checkWindow: async context => context.native.windows.isOpen({ title: 'Chrome' })
      }
    });

    await expect(runner.run(actor, 'checkWindow')).resolves.toBe(true);
  });
});
