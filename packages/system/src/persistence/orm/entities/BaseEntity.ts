import {EntityRepositoryType} from "@mikro-orm/core";
import {FindManyRepository} from "../repositories/FindMany";
export class BaseEntity {
    [EntityRepositoryType]?: FindManyRepository<typeof this>;
}