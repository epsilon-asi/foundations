import {createDecoratorRegistry} from "@epsilon-asi/foundation";

import {config} from "dotenv";

export enum EnvVarType {
    string = "string",
    number = "number",
    boolean = "boolean",
}
export type LoadEnvironmentPropertyMetadata =  {
    type?: EnvVarType,
    name?: string,
    required?: boolean
}
export type LoadEnvironmentDecorators = {
    class: {},
    method: {},
    property: {
        EnvVar: {
            metadata:LoadEnvironmentPropertyMetadata
            target: string | boolean | number
        },
    },
    accessor: {}
}


const registry = createDecoratorRegistry<LoadEnvironmentDecorators>()
const LoadEnvironmentRegistry = registry.for<Record<string, string | boolean | number | undefined>>();
const EnvVar = LoadEnvironmentRegistry.property('EnvVar');
export const StringEnvVar = (args?:Partial<Parameters<typeof EnvVar>>)=>EnvVar({
    ...args,
    type: EnvVarType.string
})
export const BooleanEnvVar =  (args?:Partial<Parameters<typeof EnvVar>>)=>EnvVar({
    ...args,
    type: EnvVarType.boolean
})
export const NumberEnvVar = (args?:Partial<Parameters<typeof EnvVar>>)=>EnvVar({
    ...args,
    type: EnvVarType.number
})

const loadEnvVars = (instance: Record<string, any>, opts?: {
    envFile?: string,
})=> {
    config({
        path: opts?.envFile ?? opts?.envFile,
    })
    const snapshot = registry.read(instance);
    for (const record of snapshot.propertyRecords('EnvVar')) {
        const {type, name, required} =  (record.metadata as LoadEnvironmentPropertyMetadata);
        let envVarName: string = name ?? (record.memberName as string).replace(/[a-z][A-Z]/g, letter => `${letter[0]}_${letter[1]}`).toUpperCase();
        let envVarType: EnvVarType = type ?? EnvVarType.string;
        let envVarIsRequired: boolean = !required;

        let envVarValue = process.env[envVarName];
        if (envVarValue == undefined && envVarIsRequired) {
            throw Error(`Failed to initiate environment due to missing var: ${envVarName}`)
        } else {
            switch (envVarType) {
                case EnvVarType.number:
                    instance[record.memberName as keyof typeof instance] = Number(process.env[envVarName] ?? 0)
                    break;
                case EnvVarType.boolean:
                    instance[record.memberName as keyof typeof instance] = (process.env[envVarName] === "true");
                    break;
                case EnvVarType.string:
                    instance[record.memberName as keyof typeof instance] = String(process.env[envVarName] ?? "")
                    break;
            }
        }
    }
}
//
//
// export class TestImpl {
//     @EnvVar({
//         required: true
//     })
//     testVar1!: string
//
//     @EnvVar({
//         type: EnvVarType.boolean,
//     })
//     testVarBool!: boolean
//
//     @EnvVar({
//         type: EnvVarType.number,
//         name: "TEST_VARIABLE_NUMBER_BABY",
//         required: false
//     })
//     testVarNumber!: number
// }
//
// const testEnv = new TestImpl()
// loadEnvVars(testEnv)
// console.log(testEnv)

export {
    EnvVar,
    loadEnvVars
}