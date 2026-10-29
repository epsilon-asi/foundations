import {BaseEntity} from "./BaseEntity";
import {Entity, ManyToOne, PrimaryKey, Property, SerializedPrimaryKey} from '@mikro-orm/decorators/es';
import {v7} from "uuid";


abstract class TrackableEntity extends BaseEntity {
    @PrimaryKey()
    @SerializedPrimaryKey()
    @Property()
    id: string = v7();

    @Property({
        default: 'now',
        onCreate: () => new Date(),
        type: 'datetime'
    })
    createdAt?: Date;

    @Property({
        default: 'now',
        onUpdate: () => new Date(),
        type: 'datetime'
    })
    updatedAt?: Date;
}

@Entity()
export class ExampleOwner extends TrackableEntity {
    @Property({type: 'text'})
    displayName!: string;
}

@Entity()
export class ExampleEntity extends TrackableEntity {
    @Property({type: 'text'})
    name!: string;

    @Property({type: 'boolean'})
    active = true;

    @Property({type: 'integer'})
    score = 0;

    @ManyToOne(() => ExampleOwner)
    owner!: ExampleOwner;
}
import {MikroORM, QueryOrder} from '@mikro-orm/postgresql';
import {FindManyRepository} from "../repositories/FindMany";



export async function initORM(): Promise<MikroORM> {
    return await MikroORM.init({
        entities: [
            TrackableEntity,
            ExampleOwner,
            ExampleEntity,
        ],
        entityRepository: FindManyRepository,
        clientUrl:
            process.env.DATABASE_URL
            ?? 'postgresql://postgres:postgres@localhost:5433/trader',

        debug: process.env.NODE_ENV === 'development',
    });
}

export default TrackableEntity;