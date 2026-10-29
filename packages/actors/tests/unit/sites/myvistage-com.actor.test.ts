import { describe, expect, it } from 'vitest';
import { myvistageComActor } from '../../../src/sites/myvistage-com/myvistage-com.actor.js';

describe('myvistageComActor', () => {
  it('has expected metadata', () => {
    expect(myvistageComActor.id).toBe('myvistage-com');
    expect(myvistageComActor.baseUrl).toBe('https://myvistage.com');
  });

  it('ping task returns ok with null echo by default', async () => {
    const output = await myvistageComActor.tasks.ping({} as never, {});
    expect(output).toEqual({ ok: true, echo: null });
  });

  it('ping task echoes provided message', async () => {
    const output = await myvistageComActor.tasks.ping({} as never, { message: 'hello' });
    expect(output).toEqual({ ok: true, echo: 'hello' });
  });
});
