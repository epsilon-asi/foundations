import { ZodType } from "zod/v4";
import {createDecoratorRegistry} from "../factory";
export class ValidatableClass<T = any> {}

type ValidatableDecorators = {
    class:{
        Validatable: {
            metadata: {
                schema: ZodType
            }
        }
    },
    property: {

    },
    method: {},
    accessor: {},
}
const registry = createDecoratorRegistry<ValidatableDecorators>({ namespace: 'crud-example' });
const ValidatableRegistry = registry.for<ValidatableClass>()


// import {createDecoratorRegistry} from "../factory";
// export class ValidatableClass<T = any> {}
//
// type CrudDecorators = {
//     class:{
//         crud: {
//             metadata: {
//                 aiTool?: boolean,
//                 listable?: boolean,
//                 filters?: string[],
//                 sorting?: string[],
//             }
//         }
//     },
//     property: {
//         CrudID: {
//             metadata: {
//                 editable: false,
//             },
//             target: string
//         },
//         CrudProperty: {
//             metadata: {
//                 editable: boolean | "onCreate" | "onEdit",
//                 source?: "body" | "param" | "query" | "header" // Defaults to body.
//             },
//             target: string | boolean | number | Date,
//         },
//     },
//     method: {},
//     accessor: {},
// }
// const registry = createDecoratorRegistry<CrudDecorators>({ namespace: 'crud-example' });
// const ValidatableRegistry = registry.for<ValidatableClass>()
// const CRUD = ValidatableRegistry.class('crud');
// const CrudProperty = ValidatableRegistry.property('CrudProperty');
// const CrudID =  ValidatableRegistry.property('CrudID');
//
//
// @CRUD({
//     aiTool: true,
//     listable: true,
//     filters: [],
//     sorting: [],
// })
// export class CrudExample {
//     @CrudID({
//         editable: false
//     })
//     id!: string
//
//     @CrudProperty({
//         editable: false
//     })
//     property!: string
//
//     @CrudProperty({
//         editable: true,
//     })
//     other!: string
// }
//
// const x = registry.read(CrudExample);
