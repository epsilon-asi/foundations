import { z } from 'zod/v4';
import { immutableClone } from '../clone';
import { createDecoratorRegistry } from '../index';

type ReferenceSchema = {
  class: {};
  property: {
    reference: {
      metadata: { value: unknown };
      target: unknown;
    };
  };
  method: {};
  accessor: {};
};

function makeReference(namespace: string) {
  const registry = createDecoratorRegistry<ReferenceSchema>({ namespace });
  return { registry, Reference: registry.for<Record<string, unknown>>().property('reference') };
}

// cloneDeep shares functions by reference (see cloneAndSnapshot.test.ts), so those values, and
// everything reachable from them, still belong to the caller. immutableClone must not freeze them.
describe('immutableClone and values shared by reference', () => {
  it('does not freeze a function it shares with the input', () => {
    const handler = () => 'ok';
    const cloned = immutableClone({ handler });

    expect(cloned.handler).toBe(handler);
    expect(Object.isFrozen(handler)).toBe(false);
  });

  it('does not freeze objects reachable through a shared function', () => {
    const handler = Object.assign(() => 'ok', { cache: { hits: 0 } });
    immutableClone({ handler });

    expect(Object.isFrozen(handler.cache)).toBe(false);
  });

  it('does not freeze a shared class, its prototype, or its static state', () => {
    class Entity {
      static instances: string[] = [];
    }

    immutableClone({ type: Entity });

    expect(Object.isFrozen(Entity)).toBe(false);
    expect(Object.isFrozen(Entity.prototype)).toBe(false);
    expect(Object.isFrozen(Entity.instances)).toBe(false);
    expect(() => Entity.instances.push('created')).not.toThrow();
  });

  it('does not freeze or read an object behind a getter', () => {
    const registry = { entries: [] as string[] };
    let reads = 0;
    const source = {};
    Object.defineProperty(source, 'registry', {
      enumerable: true,
      get: () => {
        reads += 1;
        return registry;
      },
    });

    immutableClone({ source });

    expect(Object.isFrozen(registry)).toBe(false);
    expect(reads).toBe(0);
  });

  it('still freezes the data it cloned around a shared function', () => {
    const handler = () => 'ok';
    const cloned = immutableClone({ handler, options: { retries: 1 }, tags: ['a'] });

    expect(Object.isFrozen(cloned)).toBe(true);
    expect(Object.isFrozen(cloned.options)).toBe(true);
    expect(Object.isFrozen(cloned.tags)).toBe(true);
  });
});

describe('decorator metadata holding shared references', () => {
  it('records a class reference without freezing the class', () => {
    const { registry, Reference } = makeReference('shared-class');

    class Target {
      static seen: string[] = [];
    }

    class Holder {
      @Reference({ value: Target })
      target!: unknown;
    }

    const [record] = registry.read(Holder).propertyRecords('reference');
    expect((record.metadata as { value: unknown }).value).toBe(Target);
    expect(Object.isFrozen(Target)).toBe(false);
    expect(Object.isFrozen(Target.prototype)).toBe(false);
    expect(Object.isFrozen(Target.seen)).toBe(false);
  });

  // Keep last: while the bug exists, this corrupts zod for the rest of this file.
  it('leaves zod usable after a zod schema is recorded as metadata', () => {
    const { Reference } = makeReference('shared-zod');

    class Input {
      @Reference({ value: z.string().min(3) })
      handle!: string;
    }

    expect(Input).toBeDefined();
    expect(() => z.string().email()).not.toThrow();
    expect(z.string().email().safeParse('ray@example.com').success).toBe(true);
  });
});
