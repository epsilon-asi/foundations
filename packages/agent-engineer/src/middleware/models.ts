import {type ChainResult, defineMiddleware} from '@epsilon-asi/command-line';
import type {EngineerModels} from '../agents/workspace.js';

/**
 * Provides `models`, the chat models the engineer commands run their agents on. It provides `{}`, so each agent
 * uses its default, unless a middleware earlier in the chain already provided `models`: tests and evals pass one
 * to `runCli(AgentEngineer, argv, { use: [...] })` to run the CLI on a scripted or chosen model.
 */
export const models = defineMiddleware<[], {}, { models: EngineerModels }>({
    name: 'models',
    handle(ctx, next) {
        if ('models' in ctx) {
            return next() as Promise<ChainResult<{ models: EngineerModels }>>;
        }
        return next({models: {}});
    },
});

/** A middleware that provides `models` ahead of the `models` middleware, for `runCli`'s `use` option. */
export const provideModels = (provided: EngineerModels) =>
    defineMiddleware({
        name: 'provided-models',
        handle: (_ctx, next) => next({models: provided}),
    });
