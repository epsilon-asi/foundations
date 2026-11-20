import { describe, expect, it, jest } from '@jest/globals';
import { createChainBinding, MiddlewareError, type ChainCleanup } from './index.js';

type Value = { status: number };
type Result = { response: Value };
type Next = (values?: object) => Promise<Result>;
interface Step {
  name: string;
  use?: readonly Step[];
  provides?: readonly string[];
  handle(ctx: { trace: string; defer(cleanup: ChainCleanup): void }, next: Next): Result | Value | Promise<Result | Value>;
}
const bind = () => createChainBinding<Step, Value, Result>({
  subject: 'request', reservedKeys: ['trace'], wrap: response => ({ response }),
  isStop: (v): v is Value => typeof v === 'object' && v !== null && 'status' in v,
  successful: response => response.status < 400,
});
const pass: Step['handle'] = (_ctx, next) => next();
const base = { trace: 't1' };

describe('chain binding', () => {
  it('resolves one immutable, dependency-ordered chain and gives concurrent runs independent state', async () => {
    const binding = bind();
    const events: string[] = [];
    const outer = binding.define({ name: 'outer', provides: ['actor'], async handle(ctx, next) {
      ctx.defer(() => events.push(ctx.trace));
      const result = await next({ actor: ctx.trace });
      expect(Object.isFrozen(result)).toBe(true);
      return result;
    } });
    const use = [outer];
    const inner = binding.define({ name: 'inner', use, handle: pass });
    use.length = 0;
    const chain = binding.resolve([inner, outer]);
    expect(chain).toEqual([outer, inner]);
    expect(Object.isFrozen(chain)).toBe(true);
    const run = (trace: string) => binding.run({ chain, base: { trace }, run: (ctx, defer) => {
      expect(Object.isFrozen(ctx)).toBe(true);
      expect(ctx.actor).toBe(trace);
      defer(() => events.push('terminal:' + trace));
      return { status: 201 };
    } });
    expect(await Promise.all([run('a'), run('b')])).toEqual([{ status: 201 }, { status: 201 }]);
    for (const id of ['a','b']) expect(events.filter(e => e.endsWith(id))).toEqual(['terminal:' + id, id]);
  });

  it('checks definitions and rejects foreign identities, duplicate declarations and reserved keys before execution', async () => {
    const one = bind(), two = bind();
    const step = one.define({ name: 'a', provides: ['actor'], handle: pass });
    expect(one.isMiddleware(step)).toBe(true);
    expect(two.isMiddleware(step)).toBe(false);
    expect(() => two.define({ name: 'b', use: [step], handle: pass })).toThrow(/use\[0\]/);
    expect(() => two.resolve([step])).toThrow(/different middleware binding/);
    await expect(two.run({ chain: one.resolve([step]), base, run: () => ({ status: 201 }) })).rejects.toThrow(/Resolve/);
    for (const bad of [{name: ''}, {handle: 'no'}, {use: 'no'}, {provides: [1]}]) {
      expect(() => one.define({ name: 'b', handle: pass, ...bad } as Step)).toThrow(MiddlewareError);
    }
    expect(() => one.resolve([step, one.define({ name: 'b', provides: ['actor'], handle: pass })])).toThrow(/"a" already provides/);
    expect(() => one.resolve([one.define({ name: 'b', provides: ['trace'], handle: pass })])).toThrow(/request context/);
  });

  it('preserves the stop value and original failure when deferred work also fails', async () => {
    const binding = bind(), stop = { status: 401 }, failure = new Error('terminal failed');
    const warn = jest.fn();
    const outer = binding.define({ name: 'cleanup', handle(ctx, next) {
      ctx.defer(() => { throw new Error('cleanup failed'); });
      return next();
    } });
    const reject = binding.define({ name: 'reject', handle: () => stop });
    const run = jest.fn((): Value => { throw failure; });
    await expect(binding.run({ chain: binding.resolve([outer, reject]), base, run, warn })).resolves.toBe(stop);
    expect(run).not.toHaveBeenCalled();
    await expect(binding.run({ chain: binding.resolve([outer]), base, run, warn })).rejects.toBe(failure);
    expect(warn).toHaveBeenCalledTimes(2);
    await expect(binding.run({ chain: binding.resolve([outer]), base, run: () => ({ status: 201 }) })).rejects.toThrow(/cleanup failed/);
    await expect(binding.run({ chain: binding.resolve([outer]), base, run: (_ctx, defer) => {
      defer(() => { throw 'second'; });
      return { status: 201 };
    } })).rejects.toThrow(AggregateError);
  });

  it('rejects forged and duplicate next results and context collisions', async () => {
    const binding = bind();
    const run = (...steps: Step[]) => binding.run({
      chain: binding.resolve(steps), base, run: () => ({ status: 200 }),
    });
    const step = (handle: Step['handle']) => binding.define({ name: 'step', handle });
    await expect(run(step(async (_ctx, next) => { await next(); return next(); }))).rejects.toThrow(/more than once/);
    await expect(run(step(() => ({ response: { status: 201 } })))).rejects.toThrow(/result of next/);
    await expect(run(step((_ctx, next) => next({ trace: 'new' })))).rejects.toThrow(/request context/);
    await expect(run(step((_ctx, next) => next({ actor: 1 })), step((_ctx, next) => next({ actor: 2 })))).rejects.toThrow(/already provides/);
    await expect(run(step((_ctx, next) => next([])))).rejects.toThrow(/object of values/);
    await expect(run(step((_ctx, next) => next({ [Symbol()]: 0 })))).rejects.toThrow(/symbol keys/);
    await expect(run(step(ctx => { ctx.defer(null as never); return { status: 201 }; }))).rejects.toThrow(/not a function/);
  });

  it('waits for downstream work even when a handler returns early and refuses calls after completion', async () => {
    const binding = bind();
    let lateNext!: Next, lateDefer!: (cleanup: ChainCleanup) => void;
    let finish!: (value: Value) => void;
    const pending = new Promise<Value>(resolve => { finish = resolve; });
    const step = binding.define({ name: 'early', handle(ctx, next) {
      lateNext = next;
      lateDefer = ctx.defer;
      void next();
      return { status: 200 };
    } });
    const run = binding.run({ chain: binding.resolve([step]), base, run: () => pending });
    await Promise.resolve();
    finish({ status: 201 });
    await expect(run).rejects.toThrow(/before next\(\) had finished/);
    await expect(lateNext()).rejects.toThrow(/after its handler/);
    expect(() => lateDefer(() => {})).toThrow(/after the request had finished/);
  });
});
