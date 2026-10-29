import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LoginFlowDefinition } from '../../../src/auth/LoginFlow.types.js';
import { BrowserFactory } from '../../../src/browser/BrowserFactory.js';
import { BrowserSession } from '../../../src/browser/BrowserSession.js';
import type { RuntimeConfig } from '../../../src/browser/RuntimeConfig.js';
import { defineActor } from '../../../src/core/defineActor.js';
import { ActorRunner, ActorSequenceRunner } from '../../../src/core/ActorRunner.js';
import { defineFormTask } from '../../../src/core/Actor.js';
import { AutomationError } from '../../../src/errors/AutomationError.js';
import { PuppeteerPageAdapter } from '../../../src/interaction/PageAdapter.js';
import { MemoryLogger } from '../../../src/logging/MemoryLogger.js';
import { FakeHumanInteractor } from '../../fixtures/FakeCursor.js';
import { FakeBrowser, FakePage } from '../../fixtures/FakePage.js';

class StaticBrowserFactory extends BrowserFactory {
  launchCalls = 0;

  constructor(private readonly session: BrowserSession) {
    super();
  }

  override async launch(): Promise<BrowserSession> {
    this.launchCalls += 1;
    return this.session;
  }
}

class FakeLoginFlow {
  ensureAuthenticatedCalls: LoginFlowDefinition[] = [];

  async ensureAuthenticated(_context: unknown, definition: LoginFlowDefinition): Promise<void> {
    this.ensureAuthenticatedCalls.push(definition);
  }
}

function createConfig(closeBrowserOnFinish = true): RuntimeConfig {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-runner-'));
  fs.mkdirSync(path.join(userDataDir, 'Default'));
  return {
    browser: {
      mode: 'existing-profile',
      userDataDir,
      profileDirectory: 'Default',
      headless: false,
      closeBrowserOnFinish
    }
  };
}

function createRemoteConfig(options: { closeBrowserOnFinish?: boolean; disconnectOnFinish?: boolean } = {}): RuntimeConfig {
  return {
    browser: {
      mode: 'remote-debugging',
      browserURL: 'http://127.0.0.1:9222',
      ...options
    }
  };
}

function createRunnerParts(closeBrowserOnFinish = true, overrideConfig?: RuntimeConfig): {
  runner: ActorRunner;
  page: FakePage;
  browser: FakeBrowser;
  browserFactory: StaticBrowserFactory;
  loginFlow: FakeLoginFlow;
  interactor: FakeHumanInteractor;
} {
  const config = overrideConfig ?? createConfig(closeBrowserOnFinish);
  const page = new FakePage();
  const browser = new FakeBrowser([page]);
  const session = new BrowserSession(browser, browser.context, page, config.browser, config.browser.mode === 'remote-debugging' ? 'connected' : 'launched');
  const browserFactory = new StaticBrowserFactory(session);
  const loginFlow = new FakeLoginFlow();
  const interactor = new FakeHumanInteractor();
  const runner = new ActorRunner({
    config,
    browserFactory,
    loginFlow: loginFlow as never,
    logger: new MemoryLogger(),
    interactorFactory: () => interactor,
    pageAdapterFactory: pageLike => new PuppeteerPageAdapter(pageLike)
  });
  return { runner, page, browser, browserFactory, loginFlow, interactor };
}

function createSequenceRunnerParts(closeBrowserOnFinish = true, overrideConfig?: RuntimeConfig): {
  runner: ActorSequenceRunner;
  page: FakePage;
  browser: FakeBrowser;
  browserFactory: StaticBrowserFactory;
  loginFlow: FakeLoginFlow;
} {
  const config = overrideConfig ?? createConfig(closeBrowserOnFinish);
  const page = new FakePage();
  const browser = new FakeBrowser([page]);
  const session = new BrowserSession(browser, browser.context, page, config.browser, config.browser.mode === 'remote-debugging' ? 'connected' : 'launched');
  const browserFactory = new StaticBrowserFactory(session);
  const loginFlow = new FakeLoginFlow();
  const runner = new ActorSequenceRunner({
    config,
    browserFactory,
    loginFlow: loginFlow as never,
    logger: new MemoryLogger(),
    interactorFactory: () => new FakeHumanInteractor(),
    pageAdapterFactory: pageLike => new PuppeteerPageAdapter(pageLike)
  });
  return { runner, page, browser, browserFactory, loginFlow };
}

describe('ActorRunner', () => {
  const auth = {
    loginUrl: '/login',
    selectors: {
      username: '#email',
      password: '#password',
      submit: '#submit',
      loggedInSignal: '#account'
    },
    credentials: { id: 'example' }
  } satisfies LoginFlowDefinition;

  it('creates actor context and runs the selected task', async () => {
    const { runner, browserFactory, browser } = createRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        hello: async context => ({ actorId: context.actor.id, url: context.page.url() })
      }
    });

    const result = await runner.run(actor, 'hello');

    expect(result).toEqual({ actorId: 'example', url: 'about:blank' });
    expect(browserFactory.launchCalls).toBe(1);
    expect(browser.closeCalls).toHaveLength(1);
  });

  it('runs auth when the actor defines a login flow', async () => {
    const { runner, loginFlow } = createRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      auth,
      tasks: {
        scrape: async () => 'done'
      }
    });

    await expect(runner.run(actor, 'scrape')).resolves.toBe('done');
    expect(loginFlow.ensureAuthenticatedCalls).toEqual([auth]);
  });

  it('runs generated form tasks against actor context services', async () => {
    const { runner, page, interactor } = createRunnerParts();
    page
      .setSelector('#name')
      .setSelector('#email')
      .setSelector('#submit');

    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        submitContact: defineFormTask<{ name: string; email: string }, { submitted: string }>({
          url: '/contact',
          fields: [
            { selector: '#name', inputKey: 'name' },
            { selector: '#email', inputKey: 'email' }
          ],
          submit: {
            selector: '#submit',
            waitForNavigation: true
          },
          onComplete: (_context, input) => ({ submitted: input.email })
        })
      }
    });

    const result = await runner.run(actor, 'submitContact', {
      name: 'Jane Doe',
      email: 'jane@example.com'
    });

    expect(result).toEqual({ submitted: 'jane@example.com' });
    expect(page.gotos[0]?.url).toBe('https://example.com/contact');
    expect(interactor.typed).toEqual([
      { selector: '#name', value: 'Jane Doe', options: { required: true } },
      { selector: '#email', value: 'jane@example.com', options: { required: true } }
    ]);
    expect(interactor.clicks).toEqual([{ selector: '#submit' }]);
    expect(page.waitedNavigations).toHaveLength(1);
  });

  it('disconnects a launched browser without closing when closeBrowserOnFinish is false', async () => {
    const { runner, browser } = createRunnerParts(false);
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        noop: async () => undefined
      }
    });

    await runner.run(actor, 'noop');

    expect(browser.closeCalls).toHaveLength(0);
    expect(browser.disconnectCalls).toHaveLength(1);
  });

  it('disconnects from a shared connected browser by default without closing Chrome', async () => {
    const { runner, browser } = createRunnerParts(true, createRemoteConfig());
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        noop: async () => undefined
      }
    });

    await runner.run(actor, 'noop');

    expect(browser.disconnectCalls).toHaveLength(1);
    expect(browser.closeCalls).toHaveLength(0);
  });

  it('can close the connected browser when explicitly configured', async () => {
    const { runner, browser } = createRunnerParts(true, createRemoteConfig({ closeBrowserOnFinish: true, disconnectOnFinish: false }));
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        noop: async () => undefined
      }
    });

    await runner.run(actor, 'noop');

    expect(browser.closeCalls).toHaveLength(1);
    expect(browser.disconnectCalls).toHaveLength(0);
  });

  it('wraps task failures with actor metadata and still closes the browser', async () => {
    const { runner, browser } = createRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        explode: async () => {
          throw new Error('boom');
        }
      }
    });

    await expect(runner.run(actor, 'explode')).rejects.toMatchObject({
      name: 'AutomationError',
      actorId: 'example',
      taskName: 'explode'
    } satisfies Partial<AutomationError>);
    expect(browser.closeCalls).toHaveLength(1);
  });

  it('calls actor hooks around task execution', async () => {
    const calls: string[] = [];
    const { runner } = createRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      hooks: {
        beforeRun: () => { calls.push('before'); },
        afterRun: () => { calls.push('after'); }
      },
      tasks: {
        task: async () => 'ok'
      }
    });

    await runner.run(actor, 'task');

    expect(calls).toEqual(['before', 'after']);
  });
});

describe('ActorSequenceRunner', () => {
  const auth = {
    loginUrl: '/login',
    selectors: {
      username: '#email',
      password: '#password',
      submit: '#submit',
      loggedInSignal: '#account'
    },
    credentials: { id: 'example' }
  } satisfies LoginFlowDefinition;

  it('runs a series of tasks in a single browser session', async () => {
    const calls: string[] = [];
    const { runner, browserFactory, browser } = createSequenceRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        first: async () => {
          calls.push('first');
          return 'one';
        },
        second: async () => {
          calls.push('second');
          return 'two';
        }
      }
    });

    const result = await runner.runSequence(actor, ['first', 'second']);

    expect(result).toEqual(['one', 'two']);
    expect(calls).toEqual(['first', 'second']);
    expect(browserFactory.launchCalls).toBe(1);
    expect(browser.closeCalls).toHaveLength(1);
  });

  it('runs authentication once before the first sequence step', async () => {
    const { runner, loginFlow } = createSequenceRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      auth,
      tasks: {
        a: async () => 'a',
        b: async () => 'b'
      }
    });

    await runner.runSequence(actor, ['a', 'b']);

    expect(loginFlow.ensureAuthenticatedCalls).toEqual([auth]);
  });

  it('calls hooks for each step and wraps errors with the failing task name', async () => {
    const calls: string[] = [];
    const { runner, browser } = createSequenceRunnerParts();
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      hooks: {
        beforeRun: (_context, taskName) => { calls.push(`before:${taskName}`); },
        afterRun: (_context, taskName) => { calls.push(`after:${taskName}`); },
        onError: (_context, taskName) => { calls.push(`error:${taskName}`); }
      },
      tasks: {
        first: async () => 'ok',
        second: async () => {
          throw new Error('boom');
        }
      }
    });

    await expect(runner.runSequence(actor, ['first', 'second'])).rejects.toMatchObject({
      name: 'AutomationError',
      actorId: 'example',
      taskName: 'second'
    } satisfies Partial<AutomationError>);

    expect(calls).toEqual(['before:first', 'after:first', 'before:second', 'error:second']);
    expect(browser.closeCalls).toHaveLength(1);
  });
});
