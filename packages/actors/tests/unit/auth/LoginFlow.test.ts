import { describe, expect, it } from 'vitest';
import { defineLoginFlow } from '../../../src/auth/LoginFlow.types.js';
import { LoginFlow } from '../../../src/auth/LoginFlow.js';
import { AuthError } from '../../../src/errors/AuthError.js';
import { FakeCredentialsProvider } from '../../fixtures/FakeCredentialsProvider.js';
import { makeContext } from '../../fixtures/makeContext.js';

describe('LoginFlow', () => {
  const loginDefinition = defineLoginFlow({
    loginUrl: '/login',
    selectors: {
      username: '#email',
      password: '#password',
      submit: '#submit',
      loggedInSignal: '#account',
      errorMessage: '#login-error'
    },
    credentials: { id: 'example' },
    behavior: {
      submitCausesNavigation: true,
      errorTimeoutMs: 25
    }
  });

  it('navigates, fills credentials, clicks submit, and verifies login', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#email')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#account');
    const credentialsProvider = new FakeCredentialsProvider({ username: 'me@example.com', password: 'passw0rd' });
    const flow = new LoginFlow(credentialsProvider);

    await flow.login(context, loginDefinition);

    expect(fakePage.gotos[0]?.url).toBe('https://example.com/login');
    expect(fakeInteractor.typed).toEqual([
      { selector: '#email', value: 'me@example.com', options: { required: true, clear: true, clearMethod: 'select-delete' } },
      { selector: '#password', value: 'passw0rd', options: { required: true, clear: true, clearMethod: 'select-delete' } }
    ]);
    expect(fakeInteractor.clicks.map(click => click.selector)).toContain('#submit');
    expect(fakePage.waitedNavigations).toHaveLength(1);
  });


  it('passes clearFieldBeforeTyping=false through the standardized login flow', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#email')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#account');
    const flow = new LoginFlow(new FakeCredentialsProvider({ username: 'me@example.com', password: 'passw0rd' }));

    await flow.login(context, defineLoginFlow({
      ...loginDefinition,
      behavior: {
        ...loginDefinition.behavior,
        clearFieldBeforeTyping: false,
        typing: { targetWordsPerMinute: 70, intervalJitterMs: 6 }
      }
    }));

    expect(fakeInteractor.typed).toEqual([
      {
        selector: '#email',
        value: 'me@example.com',
        options: {
          required: true,
          clear: false,
          clearMethod: 'select-delete',
          typing: { targetWordsPerMinute: 70, intervalJitterMs: 6 }
        }
      },
      {
        selector: '#password',
        value: 'passw0rd',
        options: {
          required: true,
          clear: false,
          clearMethod: 'select-delete',
          typing: { targetWordsPerMinute: 70, intervalJitterMs: 6 }
        }
      }
    ]);
  });


  it('executes an ordered multi-step login flow with username, continue, password, and submit', async () => {
    const calls: string[] = [];
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#username')
      .setSelector('#continue')
      .setSelector('#password')
      .setSelector('#password-submit')
      .setSelector('#account');
    const flow = new LoginFlow(new FakeCredentialsProvider({ username: 'me@example.com', password: 'passw0rd' }));

    await flow.login(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        loggedInSignal: '#account',
        errorMessage: '#login-error'
      },
      credentials: { id: 'example' },
      behavior: {
        errorTimeoutMs: 25,
        typing: { targetWordsPerMinute: 65, intervalJitterMs: 8 }
      },
      hooks: {
        beforeSubmit: () => { calls.push('beforeSubmit'); },
        afterSubmit: () => { calls.push('afterSubmit'); }
      },
      steps: [
        { type: 'fill', name: 'username', selector: '#username', credential: 'username' },
        { type: 'click', name: 'continue', selector: '#continue', waitForSelector: '#password', waitForSelectorTimeoutMs: 500 },
        {
          type: 'fill',
          name: 'password',
          selector: '#password',
          credential: 'password',
          typing: { intervalJitterMs: 4 }
        },
        {
          type: 'click',
          name: 'submit password',
          selector: '#password-submit',
          submit: true,
          waitForNavigation: true,
          checkForError: false
        }
      ]
    }));

    expect(fakePage.gotos[0]?.url).toBe('https://example.com/login');
    expect(fakeInteractor.typed).toEqual([
      {
        selector: '#username',
        value: 'me@example.com',
        options: {
          required: true,
          clear: true,
          clearMethod: 'select-delete',
          typing: { targetWordsPerMinute: 65, intervalJitterMs: 8 }
        }
      },
      {
        selector: '#password',
        value: 'passw0rd',
        options: {
          required: true,
          clear: true,
          clearMethod: 'select-delete',
          typing: { targetWordsPerMinute: 65, intervalJitterMs: 4 }
        }
      }
    ]);
    expect(fakeInteractor.clicks.map(click => click.selector)).toEqual(['#continue', '#password-submit']);
    expect(fakePage.waitedSelectors.map(wait => wait.selector)).toContain('#password');
    expect(fakePage.waitedNavigations).toHaveLength(1);
    expect(calls).toEqual(['beforeSubmit', 'afterSubmit']);
  });

  it('lets each multi-step fill override clearFieldBeforeTyping', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#username')
      .setSelector('#continue')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#account');
    const flow = new LoginFlow(new FakeCredentialsProvider({ username: 'me@example.com', password: 'passw0rd' }));

    await flow.login(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: { loggedInSignal: '#account' },
      credentials: { id: 'example' },
      behavior: { clearFieldBeforeTyping: true },
      steps: [
        { type: 'fill', selector: '#username', credential: 'username' },
        { type: 'click', selector: '#continue', waitForSelector: '#password' },
        { type: 'fill', selector: '#password', credential: 'password', clearFieldBeforeTyping: false },
        { type: 'click', selector: '#submit', submit: true }
      ]
    }));

    expect(fakeInteractor.typed).toEqual([
      { selector: '#username', value: 'me@example.com', options: { required: true, clear: true, clearMethod: 'select-delete' } },
      { selector: '#password', value: 'passw0rd', options: { required: true, clear: false, clearMethod: 'select-delete' } }
    ]);
  });

  it('surfaces an intermediate multi-step login error before waiting for the next field', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#username')
      .setSelector('#continue')
      .setSelector('#login-error', { textContent: 'Unknown Apple ID' });
    const flow = new LoginFlow(new FakeCredentialsProvider({ username: 'me@example.com', password: 'passw0rd' }));

    await expect(flow.login(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        loggedInSignal: '#account',
        errorMessage: '#login-error'
      },
      credentials: { id: 'example' },
      behavior: { errorTimeoutMs: 25 },
      steps: [
        { type: 'fill', name: 'username', selector: '#username', credential: 'username' },
        { type: 'click', name: 'continue', selector: '#continue', waitForSelector: '#password' },
        { type: 'fill', name: 'password', selector: '#password', credential: 'password' }
      ]
    }))).rejects.toThrow('Login failed during step "continue": Unknown Apple ID');

    expect(fakeInteractor.typed).toEqual([
      { selector: '#username', value: 'me@example.com', options: { required: true, clear: true, clearMethod: 'select-delete' } }
    ]);
  });

  it('requires steps when standard username/password/submit selectors are omitted', async () => {
    const { context } = makeContext();
    const flow = new LoginFlow(new FakeCredentialsProvider());

    await expect(flow.login(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: { loggedInSignal: '#account' },
      credentials: { id: 'example' }
    }))).rejects.toThrow('either selectors.username/password/submit');
  });

  it('skips login when the existing profile is already authenticated', async () => {
    const { context, fakePage } = makeContext();
    fakePage.setSelector('#account');
    const credentialsProvider = new FakeCredentialsProvider();
    const flow = new LoginFlow(credentialsProvider);

    await flow.ensureAuthenticated(context, loginDefinition);

    expect(credentialsProvider.requested).toHaveLength(0);
    expect(fakePage.gotos).toHaveLength(0);
  });

  it('throws an AuthError when an error message appears after submit', async () => {
    const { context, fakePage } = makeContext();
    fakePage
      .setSelector('#email')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#login-error', { textContent: 'Bad credentials' });
    const flow = new LoginFlow(new FakeCredentialsProvider());

    await expect(flow.login(context, loginDefinition)).rejects.toBeInstanceOf(AuthError);
  });

  it('calls hooks in order', async () => {
    const calls: string[] = [];
    const { context, fakePage } = makeContext();
    fakePage
      .setSelector('#email')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#account');
    const flow = new LoginFlow(new FakeCredentialsProvider());

    await flow.login(context, defineLoginFlow({
      ...loginDefinition,
      hooks: {
        beforeLogin: () => { calls.push('beforeLogin'); },
        afterUsername: () => { calls.push('afterUsername'); },
        afterPassword: () => { calls.push('afterPassword'); },
        beforeSubmit: () => { calls.push('beforeSubmit'); },
        afterSubmit: () => { calls.push('afterSubmit'); }
      }
    }));

    expect(calls).toEqual(['beforeLogin', 'afterUsername', 'afterPassword', 'beforeSubmit', 'afterSubmit']);
  });

  it('does not write raw passwords to the logger metadata', async () => {
    const { context, fakePage, logger } = makeContext();
    fakePage
      .setSelector('#email')
      .setSelector('#password')
      .setSelector('#submit')
      .setSelector('#account');
    const flow = new LoginFlow(new FakeCredentialsProvider({ username: 'me@example.com', password: 'super-secret' }));

    await flow.login(context, loginDefinition);

    expect(JSON.stringify(logger.records)).not.toContain('super-secret');
    expect(JSON.stringify(logger.records)).toContain('[REDACTED]');
  });
});
