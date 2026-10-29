import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserSession } from '../../src/browser/BrowserSession.js';
import type { RuntimeConfig } from '../../src/browser/RuntimeConfig.js';
import type { ActorContext, AuthController } from '../../src/core/ActorContext.js';
import { Extractor } from '../../src/extraction/Extractor.js';
import { Pagination } from '../../src/extraction/Pagination.js';
import { FormFiller } from '../../src/interaction/Forms.js';
import type { HumanInteractor } from '../../src/interaction/HumanInteractor.js';
import { Navigator } from '../../src/interaction/Navigation.js';
import { PuppeteerPageAdapter } from '../../src/interaction/PageAdapter.js';
import { MemoryLogger } from '../../src/logging/MemoryLogger.js';
import { FakeHumanInteractor } from './FakeCursor.js';
import { FakeBrowser, FakePage } from './FakePage.js';
import { createFakeNativeAutomation } from './native/FakeNativeAutomation.js';

export interface TestContextParts {
  context: ActorContext;
  fakePage: FakePage;
  fakeInteractor: FakeHumanInteractor;
  logger: MemoryLogger;
  config: RuntimeConfig;
  native: ReturnType<typeof createFakeNativeAutomation>;
}

export function makeContext(overrides: Partial<{
  page: FakePage;
  interactor: HumanInteractor;
  actorId: string;
  baseUrl: string;
  auth: AuthController;
  native: ReturnType<typeof createFakeNativeAutomation>;
}> = {}): TestContextParts {
  const fakePage = overrides.page ?? new FakePage();
  const fakeInteractor = overrides.interactor instanceof FakeHumanInteractor
    ? overrides.interactor
    : new FakeHumanInteractor();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-test-context-'));
  fs.mkdirSync(path.join(userDataDir, 'Default'));
  const config: RuntimeConfig = {
    browser: {
      mode: 'existing-profile',
      userDataDir,
      profileDirectory: 'Default',
      headless: false
    }
  };
  const fakeBrowser = new FakeBrowser([fakePage]);
  const session = new BrowserSession(fakeBrowser, fakeBrowser.context, fakePage, config.browser, 'launched');
  const page = new PuppeteerPageAdapter(fakePage);
  const cursor = overrides.interactor ?? fakeInteractor;
  const forms = new FormFiller(page, cursor);
  const nav = new Navigator(page, cursor, overrides.baseUrl ?? 'https://example.com');
  const extract = new Extractor(page);
  const pagination = new Pagination(page, cursor);
  const logger = new MemoryLogger();
  const native = overrides.native ?? createFakeNativeAutomation(logger);

  const auth: AuthController = overrides.auth ?? {
    isLoggedIn: async () => false,
    ensureAuthenticated: async () => undefined
  };

  const context: ActorContext = {
    actor: { id: overrides.actorId ?? 'example', baseUrl: overrides.baseUrl ?? 'https://example.com' },
    config,
    session,
    page,
    cursor,
    forms,
    nav,
    extract,
    pagination,
    auth,
    logger,
    native
  };

  return { context, fakePage, fakeInteractor, logger, config, native };
}
