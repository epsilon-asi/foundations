import type {FilterQuery, FindOptions, IndexFilterQuery, Loaded, QueryOrderMap,} from '@mikro-orm/core';
import {SqlEntityRepository} from '@mikro-orm/postgresql';

type FindWhere<
    Entity extends object,
    Using extends string = never,
> = [Using] extends [never]
    ? FilterQuery<Entity>
    : IndexFilterQuery<Entity, Using>;

export type FindManyOptions<
    Entity extends object,
    Using extends string = never,
> = {
    /** Zero-based page number. */
    page: number;

    perPage: number;

    /** Request/controller-level filter. */
    filter?: FindWhere<Entity, Using>;

    sort?: QueryOrderMap<Entity>;
};

export type FindManyServiceLevelOptions<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = never,
    Excludes extends string = never,
    Using extends string = never,
> = {
    /**
     * Service-enforced filter.
     * It is ANDed with the request-level `filter`.
     */
    where?: FindWhere<Entity, Using>;

    options?: FindOptions<Entity, Hint, Fields, Excludes> & {
        using?: Using | Using[];
    };
};

export type FindManyCompleteOptions<
    Entity extends object,
    Hint extends string = never,
    Fields extends string = never,
    Excludes extends string = never,
    Using extends string = never,
> =
    FindManyOptions<Entity, Using>
    & FindManyServiceLevelOptions<
    Entity,
    Hint,
    Fields,
    Excludes,
    Using
>;

export class FindManyRepository<
    Entity extends object,
> extends SqlEntityRepository<Entity> {
    buildPopulate<Hint extends string = never>(
        defaults?: FindOptions<Entity, Hint>['populate'],
        overrides?: FindOptions<Entity, Hint>['populate'],
    ): FindOptions<Entity, Hint>['populate'] {
        // An explicit caller opt-out wins.
        if (overrides === false) {
            return false;
        }

        // Disabled defaults can be replaced by an explicit caller hint.
        if (defaults === false) {
            return overrides ?? false;
        }

        const merged = [
            ...(defaults ?? []),
            ...(overrides ?? []),
        ];

        if (merged.length === 0) {
            return undefined;
        }

        // Avoid loading the same relation twice.
        return [...new Set(merged)] as FindOptions<Entity, Hint>['populate'];
    }

    async getMany<
        Hint extends string = never,
        Fields extends string = never,
        Excludes extends string = never,
        Using extends string = never,
    >(
        opts: FindManyCompleteOptions<
            Entity,
            Hint,
            Fields,
            Excludes,
            Using
        >,
    ): Promise<
        [Loaded<Entity, Hint, Fields, Excludes>[], number]
    > {
        const {
            page,
            perPage,
            where,
            options,
            filter,
            sort,
        } = opts;

        if (!Number.isInteger(page) || page < 0) {
            throw new RangeError(
                'page must be a non-negative integer',
            );
        }

        if (!Number.isInteger(perPage) || perPage < 1) {
            throw new RangeError(
                'perPage must be a positive integer',
            );
        }

        // Explicit top-level sort wins over options.orderBy.
        const orderBy =
            sort && Object.keys(sort).length > 0
                ? sort
                : options?.orderBy;

        const findOptions:
            FindOptions<Entity, Hint, Fields, Excludes>
            & {
            using?: Using | Using[];
        } = {
            ...options,
            ...(orderBy === undefined ? {} : {orderBy}),
            limit: perPage,
            offset: page * perPage,
        };

        return this.findAndCount<
            Hint,
            Fields,
            Excludes,
            Using
        >(
            this.mergeWhere(filter, where),
            findOptions,
        );
    }

    private mergeWhere<Using extends string = never>(
        filter?: FindWhere<Entity, Using>,
        where?: FindWhere<Entity, Using>,
    ): FindWhere<Entity, Using> {
        if (filter !== undefined && where !== undefined) {
            return {
                $and: [filter, where],
            } as FindWhere<Entity, Using>;
        }

        return (filter ?? where ?? {}) as FindWhere<Entity, Using>;
    }
}