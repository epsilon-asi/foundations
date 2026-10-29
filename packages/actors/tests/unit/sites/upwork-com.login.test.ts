import { describe, expect, it } from 'vitest';
import { upworkComActor } from '../../../src/sites/upwork-com/upwork-com.actor.js';
import { upworkComSelectors } from '../../../src/sites/upwork-com/upwork-com.selectors.js';

describe('upwork-com actor login flow', () => {
  it('uses a staged username-first/password-second login definition', () => {
    const auth = upworkComActor.auth;

    expect(auth).toBeDefined();

    expect(auth?.credentials).toEqual({ id: 'upwork' });
    expect(auth?.selectors.loggedInSignal).toBe(upworkComSelectors.login.loggedInSignal);
    expect(auth?.selectors.errorMessage).toBe(upworkComSelectors.login.errorMessage);

    expect(auth?.steps).toEqual([
      {
        type: 'fill',
        name: 'username',
        selector: upworkComSelectors.login.username,
        credential: 'username'
      },
      {
        type: 'click',
        name: 'continue to password',
        selector: upworkComSelectors.login.continueToPassword,
        waitForSelector: upworkComSelectors.login.password,
        waitForSelectorTimeoutMs: 5_000
      },
      {
        type: 'fill',
        name: 'password',
        selector: upworkComSelectors.login.password,
        credential: 'password'
      },
      {
        type: 'click',
        name: 'submit password',
        selector: upworkComSelectors.login.submit,
        submit: true,
        waitForNavigation: true,
        checkForError: false
      }
    ]);
  });

  it('keeps human-like typing behavior configured at the flow level', () => {
    expect(upworkComActor.auth?.behavior?.typing).toEqual({
      targetWordsPerMinute: 65,
      intervalJitterMs: 18
    });
  });
});
