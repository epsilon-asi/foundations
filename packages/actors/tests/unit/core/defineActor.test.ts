import { describe, expect, it } from 'vitest';
import { ActorRegistry } from '../../../src/core/ActorRegistry.js';
import { defineActor } from '../../../src/core/defineActor.js';
import { defineFormFillerTask, defineFormTask } from '../../../src/core/Actor.js';
import { ConfigError } from '../../../src/errors/ConfigError.js';
import { makeContext } from '../../fixtures/makeContext.js';

// Defaults applied by defineFormTask (see src/core/Actor.ts) to every filled field.
const defaultFillOptions = {
  clickBeforeTyping: true,
  typing: { enabled: true, targetWordsPerMinute: 88, intervalJitterMs: 37 }
};

describe('defineActor and ActorRegistry', () => {
  it('preserves actor definitions and registers them by id', () => {
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {
        test: async () => 'ok'
      }
    });

    const registry = new ActorRegistry().register(actor);

    expect(registry.get('example')).toBe(actor);
    expect(registry.list()).toEqual([actor]);
  });

  it('rejects duplicate actor ids', () => {
    const actor = defineActor({
      id: 'example',
      baseUrl: 'https://example.com',
      tasks: {}
    });
    const registry = new ActorRegistry().register(actor);

    expect(() => registry.register(actor)).toThrow(ConfigError);
  });
});

describe('defineFormTask', () => {
  it('creates a task that fills listed fields and submits the form from input data', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#name')
      .setSelector('#email')
      .setSelector('#submit');

    const task = defineFormTask<{ name: string; email: string }, { submittedEmail: string }>({
      url: '/contact',
      fields: [
        { selector: '#name', inputKey: 'name' },
        { selector: '#email', inputKey: 'email' }
      ],
      submit: {
        selector: '#submit',
        waitForNavigation: true
      },
      onComplete: (_ctx, input) => ({ submittedEmail: input.email })
    });

    const result = await task(context, {
      name: 'Jane Doe',
      email: 'jane@example.com'
    });

    expect(result).toEqual({ submittedEmail: 'jane@example.com' });
    expect(fakePage.gotos[0]?.url).toBe('https://example.com/contact');
    expect(fakeInteractor.typed).toEqual([
      { selector: '#name', value: 'Jane Doe', options: { required: true, ...defaultFillOptions } },
      { selector: '#email', value: 'jane@example.com', options: { required: true, ...defaultFillOptions } }
    ]);
    expect(fakeInteractor.clicks).toEqual([{ selector: '#submit' }]);
    expect(fakePage.waitedNavigations).toHaveLength(1);
  });

  it('supports literal/resolved field values and the defineFormFillerTask alias', async () => {
    const { context, fakePage, fakeInteractor } = makeContext();
    fakePage
      .setSelector('#first')
      .setSelector('#last')
      .setSelector('#submit');

    const task = defineFormFillerTask<{ firstName: string; lastName: string }>({
      fields: [
        { selector: '#first', inputKey: 'firstName' },
        { selector: '#last', value: input => input.lastName.toUpperCase() }
      ],
      submit: { selector: '#submit' }
    });

    await task(context, {
      firstName: 'Jane',
      lastName: 'Doe'
    });

    expect(fakeInteractor.typed).toEqual([
      { selector: '#first', value: 'Jane', options: { required: true, ...defaultFillOptions } },
      { selector: '#last', value: 'DOE', options: { required: true, ...defaultFillOptions } }
    ]);
    expect(fakeInteractor.clicks).toEqual([{ selector: '#submit' }]);
  });

  it('throws when a required field has no input value', async () => {
    const { context, fakePage } = makeContext();
    fakePage
      .setSelector('#name')
      .setSelector('#submit');

    const task = defineFormTask<{ name?: string }>({
      fields: [{ selector: '#name', inputKey: 'name' }],
      submit: { selector: '#submit' }
    });

    await expect(task(context, {})).rejects.toThrow('missing a value');
  });
});