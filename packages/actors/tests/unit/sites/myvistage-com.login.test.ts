import { describe, expect, it } from 'vitest';
import { myvistageComActor } from '../../../src/sites/myvistage-com/myvistage-com.actor.js';
import { myvistageComSelectors } from '../../../src/sites/myvistage-com/myvistage-com.selectors.js';

describe('myvistage-com actor login flow', () => {
  it('uses a one-page username/password login definition', () => {
    const auth = myvistageComActor.auth;

    expect(auth).toBeDefined();
    expect(auth?.loginUrl).toBe('https://myvistage.com');
    expect(auth?.credentials).toEqual({ id: 'myvistage_com' });
    expect(auth?.selectors).toEqual(myvistageComSelectors.login);
    expect(auth?.steps).toBeUndefined();
  });

  it('keeps human-like typing behavior configured at the flow level', () => {
    expect(myvistageComActor.auth?.behavior?.typing).toEqual({
      targetWordsPerMinute: 65,
      intervalJitterMs: 18
    });
  });
});
