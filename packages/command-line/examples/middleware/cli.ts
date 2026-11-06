import { Argument, CliCommand, Command, type CommandContext, type Provided } from '../../src/index.js';
import { auth, store, timing } from './middleware.js';

/**
 * A small CLI built around middleware: steps that run around every command
 * they are used on, and hand values to it.
 *
 * - `timing` is used on the root, so it wraps every command.
 * - `store` is used on `items`, so it runs for `items list` and `items add`
 *   and its `--store-url` flag belongs to `items`. `list` lists it too,
 *   because its `run()` reads `store`; it still runs only once.
 * - `auth` is used on `add` only. It depends on `store`, adds `--token`,
 *   and stops the command with exit code 2 when no token is given.
 *
 * Each command declares the values it reads with `Provided`, and `@Command`
 * checks that its `use` provides them.
 *
 *   npx tsx examples/middleware/main.ts items list
 *   npx tsx examples/middleware/main.ts items add "third item" --token abcd1234 -l debug
 *   npx tsx examples/middleware/main.ts items add "third item"        # exits 2
 */

type StoreContext = CommandContext<StoreDemo, Provided<typeof store>>;
type AuthContext = CommandContext<StoreDemo, Provided<typeof auth>>;

@Command({ description: 'List the items in the store.', use: [store] })
export class ListCommand extends CliCommand<StoreDemo, Provided<typeof store>> {
  run({ io, store: items }: StoreContext): void {
    io.stdout(this.render({ url: items.url, items: items.list() }));
  }
}

@Command({ description: 'Add an item to the store.', use: [auth] })
export class AddCommand extends CliCommand<StoreDemo, Provided<typeof auth>> {
  @Argument.string({ description: 'the item to add' })
  item!: string;

  run({ io, store: items, user }: AuthContext): void {
    items.add(this.item);
    io.stdout(this.render({ added: this.item, by: user, count: items.list().length }));
  }
}

@Command({
  name: 'items',
  description: 'Work with the items in the store.',
  use: [store],
  commands: [ListCommand, AddCommand],
})
export class ItemsCommand {}

/**
 * The root reads its version from the nearest package.json, which for this
 * example is the library's own, so the name and description are given here.
 */
@Command({
  name: 'store-demo',
  description: 'Middleware example: shared steps that run around every command.',
  package: import.meta.url,
  use: [timing],
  commands: [ItemsCommand],
})
export class StoreDemo {}
