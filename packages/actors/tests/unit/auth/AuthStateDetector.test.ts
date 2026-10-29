import { describe, expect, it } from 'vitest';
import { AuthStateDetector } from '../../../src/auth/AuthStateDetector.js';
import { defineLoginFlow } from '../../../src/auth/LoginFlow.types.js';
import { makeContext } from '../../fixtures/makeContext.js';

describe('AuthStateDetector', () => {
  it('returns true when the logged-in signal exists', async () => {
    const { context, fakePage } = makeContext();
    fakePage.setSelector('[data-testid="account"]');
    const detector = new AuthStateDetector();

    const result = await detector.isLoggedIn(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        username: '#email',
        password: '#password',
        submit: '#submit',
        loggedInSignal: '[data-testid="account"]'
      }
    }));

    expect(result).toBe(true);
  });

  it('returns false when the logged-in signal is absent', async () => {
    const { context } = makeContext();
    const detector = new AuthStateDetector();

    await expect(detector.isLoggedIn(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        username: '#email',
        password: '#password',
        submit: '#submit',
        loggedInSignal: '#missing'
      }
    }))).resolves.toBe(false);
  });

  it('visits authCheckUrl before checking auth state', async () => {
    const { context, fakePage } = makeContext();
    fakePage.setSelector('#account');
    const detector = new AuthStateDetector();

    await detector.isLoggedIn(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        username: '#email',
        password: '#password',
        submit: '#submit',
        loggedInSignal: '#account'
      },
      behavior: {
        authCheckUrl: '/dashboard'
      }
    }));

    expect(fakePage.gotos[0]?.url).toBe('https://example.com/dashboard');
  });

  it('uses custom verifyLoggedIn hook when provided', async () => {
    const { context } = makeContext();
    const detector = new AuthStateDetector();

    const result = await detector.isLoggedIn(context, defineLoginFlow({
      loginUrl: '/login',
      selectors: {
        username: '#email',
        password: '#password',
        submit: '#submit',
        loggedInSignal: '#account'
      },
      hooks: {
        verifyLoggedIn: async () => true
      }
    }));

    expect(result).toBe(true);
  });
});
