import {defineMiddleware} from '../../src/index.js';

/** A stand-in for a real service client, so the example runs without one. */
export class ItemStore {
    readonly #items = ['first item', 'second item'];

    public constructor(public readonly url: string) {
    }

    list(): readonly string[] {
        return [...this.#items];
    }

    add(item: string): void {
        this.#items.push(item);
    }

    close(): void {
    }
}

/**
 * Wraps the whole run and logs how long it took. It provides nothing, so a
 * command never has to list it: it is used once, on the root.
 */
export const timing = defineMiddleware({
    name: 'timing',
    async handle(ctx, next) {
        const started = performance.now();
        try {
            return await next();
        } finally {
            ctx.logger.debug(`${ctx.definition.name} took ${(performance.now() - started).toFixed(1)}ms`);
        }
    },
});

/**
 * Opens the store, closes it once the command has finished, and provides it
 * as `store`. It owns the `--store-url` flag, which is added to the command
 * where `store` first appears.
 */
export const store = defineMiddleware({
    name: 'store',
    options: {
        storeUrl: {
            type: 'string',
            default: 'memory://items',
            env: 'STORE_DEMO_URL',
            description: 'where the items are kept',
        },
    },
    handle: (ctx, next) => {
        const opened = new ItemStore(ctx.options.storeUrl);
        ctx.logger.debug(`opened ${opened.url}`);

        ctx.defer(() => {
            opened.close();
            ctx.logger.debug(`closed ${opened.url}`);
        });

        return next({store: opened});
    },
});

/**
 * Stops the command with exit code 2 unless a token is given, and otherwise
 * provides the `user` it belongs to. It depends on `store`, so `ctx.store` is
 * available here and `store` always runs first.
 */
export const auth = defineMiddleware({
    name: 'auth',
    use: [store],
    options: {
        token: {
            type: 'string',
            short: 't',
            env: 'STORE_DEMO_TOKEN',
            description: 'access token for changes'
        },
    },
    handle: (ctx, next) => {
        const {token} = ctx.options;
        if (token === undefined) {
            ctx.io.stderr('error: changing items needs a token: pass --token or set STORE_DEMO_TOKEN\n');
            return 2;
        }

        ctx.logger.debug(`checking the token against ${ctx.store.url}`);
        return next({user: `user-${token.slice(0, 4)}`});
    },
});
