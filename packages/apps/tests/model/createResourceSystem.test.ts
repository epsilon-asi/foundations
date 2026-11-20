import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createResourceSystem } from '../../src/model/createResourceSystem.js';
import type { CreateOnly, Defaulted, Editable, Readable, UpdateOnly, WriteOnly } from '../../src/model/access.js';

describe('resource model variants', () => {
  const { Resource, Prop, ref, resolve } = createResourceSystem();

  @Resource()
  class Item {
    @Prop.string({ crud: 'editable', min: 1 }) name!: Editable<string>;
    @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
    @Prop(z.array(z.string()).default([]), { crud: 'editable' }) labels!: Defaulted<Editable<string[]>>;
    @Prop.date({ crud: 'readable' }) createdAt!: Readable<Date>;
    @Prop.string() privateKey!: string;
    @Prop(z.array(ref(() => Item)), { crud: 'editable' }) children!: Editable<Item[]>;
  }

  it('keeps strict input, applied defaults and nested read projection on each side of the wire', () => {
    const model = resolve(Item);
    const input = { name: 'A', password: 'pass', children: [{ name: 'B', password: 'pass2', children: [] }] };
    const result = model.create.parse(input);
    expect(result.children[0].labels).toEqual([]);
    expectTypeOf(result.children[0].labels).toEqualTypeOf<string[]>();
    expect(model.create.safeParse({ ...input, children: [{ ...input, privateKey: 'extra' }] }).success).toBe(false);
    const createdAt = new Date('2026-11-19T12:00:00Z');
    const row = { ...result, privateKey: 'hidden', createdAt, children: [{ ...result.children[0], children: [], privateKey: 'nested', createdAt }] };
    const wire = model.wire.read.encode(row);
    expect(wire).toEqual({ name: 'A', labels: [], createdAt: createdAt.toISOString(), children: [
      { name: 'B', labels: [], createdAt: createdAt.toISOString(), children: [] },
    ] });
    expect(model.wire.read.decode(wire)).toEqual(model.read.parse(row));
    expect(model.wire.create.decode(input)).toEqual(result);
  });

  it('caches a resolved resource in its own system', () => {
    expect(resolve(Item)).toBe(resolve(Item));
    expect(() => createResourceSystem().resolve(Item)).toThrow();
  });

  it('decodes and encodes sparse updates without evaluating create fallbacks', () => {
    const initialDate = vi.fn(() => new Date(0));
    const initialRank = vi.fn(() => 1);
    @Resource()
    class Schedule {
      @Prop(z.date().nullable().prefault(initialDate), { crud: 'editable' }) starts!: Defaulted<Editable<Date | null>>;
      @Prop(z.int().positive().catch(initialRank).refine(n => n !== 7), { crud: 'editable' }) rank!: Editable<number>;
      @Prop.string({ crud: 'createOnly' }) source!: CreateOnly<string>;
      @Prop.boolean({ crud: 'updateOnly' }) paused!: UpdateOnly<boolean>;
    }
    const model = resolve(Schedule);
    expectTypeOf<z.input<typeof model.wire.update>>().toEqualTypeOf<{ starts?: string | null; rank?: string; paused?: string }>();
    expectTypeOf<z.output<typeof model.update>>().toEqualTypeOf<{ starts?: Date | null; rank?: number; paused?: boolean }>();
    expect(model.update.parse({})).toStrictEqual({});
    expect(model.wire.update.decode({ paused: 'false' })).toStrictEqual({ paused: false });
    expect(model.wire.update.encode({ rank: 2 })).toStrictEqual({ rank: '2' });
    expect(model.wire.update.safeParse({ rank: '0' }).success).toBe(false);
    expect(model.wire.update.safeParse({ rank: '7' }).success).toBe(false);
    expect(model.update.safeParse({ source: 'new' }).success).toBe(false);
    expect(model.wire.update.safeParse({ source: 'new' }).success).toBe(false);
    expect(model.wire.update.decode({ starts: null })).toStrictEqual({ starts: null });
    const starts = new Date('2026-11-19T00:00:00Z');
    expect(model.wire.update.encode({ starts })).toStrictEqual({ starts: starts.toISOString() });
    expect(initialDate).not.toHaveBeenCalled();
    expect(initialRank).not.toHaveBeenCalled();
    expect(model.wire.create.decode({ rank: '0', source: 'first' })).toStrictEqual({
      rank: 1, starts: new Date(0), source: 'first',
    });
  });

  it('uses strict update grants and omits defaults throughout recursive resource arrays', () => {
    const { update, wire } = resolve(Item);
    const patch = { children: [{ password: 'replacement', children: [{ labels: ['one'] }] }] };
    expect(update.parse(patch)).toStrictEqual(patch);
    expect(wire.update.decode(patch)).toStrictEqual(patch);
    expect(wire.update.encode(patch)).toStrictEqual(patch);
    for (const invalid of [{ children: [{ createdAt: new Date() }] }, { children: [{ privateKey: 'hidden' }] },
      { children: [{ name: '' }] }, { privateKey: 'hidden' }]) {
      expect(update.safeParse(invalid).success).toBe(false);
      expect(wire.update.safeParse(invalid).success).toBe(false);
    }
  });

  it('validates supplied replacement objects and array entries without firing nested fallbacks', () => {
    const fallback = vi.fn(() => 1);
    @Resource()
    class Form {
      @Prop(z.object({ count: z.int().default(fallback) }), { crud: 'editable' }) settings!: Editable<{ count: number }>;
      @Prop(z.array(z.int().positive().catch(fallback)), { crud: 'editable' }) ranks!: Editable<number[]>;
    }
    const { update, wire } = resolve(Form);
    expect(wire.update.decode({ settings: { count: '2' }, ranks: ['3'] })).toEqual({ settings: { count: 2 }, ranks: [3] });
    expect(update.safeParse({ settings: {} }).success).toBe(false);
    expect(wire.update.safeParse({ settings: { count: '2', extra: 'rejected' } }).success).toBe(false);
    expect(wire.update.safeParse({ ranks: ['0'] }).success).toBe(false);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('rejects a wider inherited grant both directly and through a nested reference', () => {
    class Credentials {
      @Prop.string({ crud: 'writeOnly' }) password!: WriteOnly<string>;
    }
    @Resource()
    class Exposed extends Credentials {
      @Prop.string({ crud: 'readable' }) override password!: Readable<string>;
    }
    @Resource()
    class Envelope {
      @Prop.nested(() => Exposed, { crud: 'readable' }) detail!: Readable<Exposed>;
    }
    expect(() => resolve(Envelope)).toThrow('Exposed.password widens inherited access');
    expect(() => resolve(Exposed)).toThrow('Exposed.password widens inherited access');
  });

  it('allows a subclass to narrow an inherited grant', () => {
    class Ordinary {}
    @Resource()
    class Base extends Ordinary {
      @Prop.string({ crud: 'editable' }) name!: Editable<string>;
    }
    @Resource()
    class Derived extends Base {
      @Prop.string({ crud: 'readable' }) override name!: Readable<string>;
    }
    const model = resolve(Derived);
    expect(model.wire.read.parse({ name: 'visible' })).toEqual({ name: 'visible' });
    expect(model.wire.create.safeParse({ name: 'forbidden' }).success).toBe(false);
  });

  it('rejects references from a different system before exposing its stored fields', () => {
    const other = createResourceSystem();
    @other.Resource()
    class Packet {
      @other.Prop(ref(() => Item), { crud: 'readable' }) item!: Readable<Item>;
    }
    expect(() => other.resolve(Packet)).toThrow(/this resource system's ref\(\).*Packet.item/);
  });

  it('walks nested shorthands, inline objects, nullable bounds and shorthand defaults', () => {
    @Resource()
    class Detail {
      @Prop.number({ crud: 'editable', min: 1 }) count!: Editable<number>;
      @Prop.string() hidden!: string;
    }
    @Resource()
    class Packet {
      @Prop.nested(() => Detail, { crud: 'editable' }) detail!: Editable<Detail>;
      @Prop(z.object({ enabled: z.boolean(), on: z.date().nullable() }), { crud: 'editable' })
      flags!: Editable<{ enabled: boolean; on: Date | null }>;
      @Prop.date({ crud: 'editable', default: new Date(0) }) since!: Defaulted<Editable<Date>>;
    }
    const model = resolve(Packet);
    const input = { detail: { count: '3' }, flags: { enabled: 'false', on: null } };
    const value = model.wire.create.decode(input);
    expect(value).toEqual({ detail: { count: 3 }, flags: { enabled: false, on: null }, since: new Date(0) });
    expect(model.wire.create.encode(value)).toEqual({ ...input, since: new Date(0).toISOString() });
    expect(model.wire.create.safeParse({ ...input, detail: { count: '0' } }).success).toBe(false);
    expect(model.wire.read.parse({ ...input, detail: { count: '3', hidden: 'NO' } }).detail).toEqual({ count: 3 });
  });

  it('projects a nested default before it reaches a reader', () => {
    @Resource()
    class Note {
      @Prop.string({ crud: 'readable' }) text!: Readable<string>;
      @Prop.string() privateMemo!: string;
    }
    @Resource()
    class Page {
      @Prop(ref(() => Note).default({ text: 'draft', privateMemo: 'hidden' }), { crud: 'readable' })
      note!: Defaulted<Readable<Note>>;
    }
    const page = resolve(Page);
    expect(page.read.parse({})).toEqual({ note: { text: 'draft' } });
    expect(page.wire.read.parse({})).toEqual({ note: { text: 'draft' } });
  });

  it('preserves checks on the default wrapper for stored and wire values', () => {
    @Resource()
    class Order {
      @Prop(z.number().default(1).refine(value => value > 0), { crud: 'editable' }) count!: Defaulted<Editable<number>>;
    }
    const model = resolve(Order);
    expect(model.create.safeParse({ count: 0 }).success).toBe(false);
    expect(model.wire.create.safeParse({ count: '0' }).success).toBe(false);
    expect(model.wire.read.parse({})).toEqual({ count: 1 });
  });

  it('rejects unsupported visible schema kinds with the resource and field path', () => {
    @Resource()
    class Bad {
      @Prop(z.map(z.string(), z.string()), { crud: 'editable' }) values!: Editable<Map<string, string>>;
    }
    expect(() => resolve(Bad)).toThrow(/map.*Bad.values/);
  });
});
