import { createTypeRegistry } from '@epsilon-asi/foundation';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { messageKeys } from '../../src/i18n/messageKeys.js';
import { crudExtension } from '../../src/model/extensions/crud.js';
import { uiExtension } from '../../src/model/extensions/ui.js';

const { Type, Prop, resolve, ref } = createTypeRegistry().use(crudExtension).use(uiExtension);

it('lists explicit resource keys and inherited field hints in declaration order, deduplicated', () => {
  class Entry {
    @Prop.string({ crud: 'readable', ui: { label: 'catalog.item', helperText: 'catalog.hint' } }) name!: string;
  }
  @Type({ name: 'CatalogItem', ui: { label: 'catalog.item', plural: 'catalog.items' } })
  class Item extends Entry {
    @Prop.string({ crud: { access: 'writeOnly' }, ui: { placeholder: 'catalog.hint' } }) password!: string;
    @Prop.string({ crud: 'secret', ui: { label: 'private.token' } }) token!: string;
    @Prop.string({ crud: { access: 'internal' } }) staffNote!: string;
    @Prop.string() providerId!: string;
    @Prop.string({ crud: 'editable', ui: { input: 'text' } }) title!: string;
  }

  const keys = messageKeys(resolve(Item));
  expect(keys).toEqual([
    'catalog.item', 'catalog.items', 'catalogItem.name.placeholder', 'catalog.hint',
    'catalogItem.password', 'catalogItem.password.helper',
    'catalogItem.title', 'catalogItem.title.placeholder', 'catalogItem.title.helper',
  ]);
  expect(Object.isFrozen(keys)).toBe(true);
});

it('uses stored string and numeric enum values under the original field key', () => {
  enum Priority { Low, High }
  const stage = z.union([z.literal('pendingReview').optional(), z.literal('LIVE'), z.null()]);
  class Task {
    @Prop(stage, { crud: 'editable', ui: { label: 'workflow.stage' } }) stage!: z.output<typeof stage>;
    @(Prop.enum(Priority, { crud: 'createOnly' })) priority!: Priority;
  }

  expect(messageKeys(resolve(Task))).toEqual([
    'workflow.stage', 'task.stage.placeholder', 'task.stage.helper', 'task.stage.pendingReview', 'task.stage.LIVE',
    'task.priority', 'task.priority.placeholder', 'task.priority.helper', 'task.priority.0', 'task.priority.1',
  ]);
});

it('finds a missing translation in a small catalog', () => {
  class Invitation {
    @Prop.string({ crud: 'writeOnly', ui: { label: 'invites.code', placeholder: 'invites.prompt', helperText: 'invites.help' } })
    code!: string;
  }
  const keys = messageKeys(resolve(Invitation));
  const complete = { 'invites.code': 'Code', 'invites.prompt': 'Enter your code', 'invites.help': 'Use the code in your invitation.' };
  const missing = { 'invites.code': 'Code', 'invites.prompt': 'Enter your code' };
  expect(keys.filter(key => !Object.hasOwn(complete, key))).toEqual([]);
  expect(keys.filter(key => !Object.hasOwn(missing, key))).toEqual(['invites.help']);
});

it('includes a recursive reference field without evaluating its target', () => {
  const target = vi.fn((): typeof Category => Category);
  class Category {
    @Prop(ref(target).optional(), { crud: 'readable' }) parent?: Category;
  }
  expect(messageKeys(resolve(Category))).toEqual(['category.parent', 'category.parent.placeholder', 'category.parent.helper']);
  expect(target).not.toHaveBeenCalled();
});

it('only includes type-level labels that were explicitly supplied', () => {
  @Type({ ui: { plural: 'catalog.categories' } })
  class Category {}
  class Hidden {
    @Prop.string({ crud: 'internal', ui: { label: 'notes.internal' } }) note!: string;
  }
  expect(messageKeys(resolve(Category))).toEqual(['catalog.categories']);
  expect(messageKeys(resolve(Hidden))).toEqual([]);
});
