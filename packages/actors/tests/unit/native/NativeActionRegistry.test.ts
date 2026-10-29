import { describe, expect, it } from 'vitest';
import { DefaultNativeActionRegistry, defineNativeAction } from '../../../src/native/NativeActionRegistry.js';
import { NativeAutomationError } from '../../../src/native/errors.js';
import { MemoryLogger } from '../../../src/logging/MemoryLogger.js';
import { createFakeNativeAutomation } from '../../fixtures/native/FakeNativeAutomation.js';

describe('DefaultNativeActionRegistry', () => {
  it('registers, lists, and runs typed native actions', async () => {
    const logger = new MemoryLogger();
    const automation = createFakeNativeAutomation(logger);
    const registry = new DefaultNativeActionRegistry(() => ({ automation, logger }));

    registry.register(defineNativeAction<{ value: number }, number>({
      name: 'math.double',
      description: 'Double a number.',
      run: async (_context, input) => input.value * 2
    }));

    expect(registry.list()).toEqual([{ name: 'math.double', description: 'Double a number.' }]);
    await expect(registry.run('math.double', { value: 21 })).resolves.toBe(42);
  });

  it('rejects duplicate and missing actions clearly', () => {
    const logger = new MemoryLogger();
    const automation = createFakeNativeAutomation(logger);
    const registry = new DefaultNativeActionRegistry(() => ({ automation, logger }));
    const action = defineNativeAction({ name: 'x', run: async () => undefined });

    registry.register(action);

    expect(() => registry.register(action)).toThrow(NativeAutomationError);
    expect(() => registry.get('missing')).toThrow(NativeAutomationError);
  });
});
