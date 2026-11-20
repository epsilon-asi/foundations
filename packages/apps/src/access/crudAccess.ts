import { ApiDefinitionError } from '../endpoints/ApiDefinitionError.js';
import { enabledCrudOperations, type CrudOperation, type EnabledCrudOperationsOptions } from '../endpoints/enabledCrudOperations.js';
import type { CrudField } from '../model/extensions/crud.js';
import { fieldOperations } from '../model/selectOperationFields.js';
import type { CreateInput, UpdateInput } from '../model/types.js';

const ruleKeys = {
  Create: ['create', 'write'],
  Get: ['read'],
  Update: ['update', 'write'],
  Delete: ['delete', 'write'],
  List: ['list', 'read'],
} as const satisfies Record<CrudOperation, readonly string[]>;

type RuleKey = (typeof ruleKeys)[CrudOperation][number];

/** Operation rules override their read or write default. Field rules apply separately. */
export type CrudAccessMap<Rule = string | object> = Partial<Record<RuleKey, Rule>> & {
  fields?: object;
};

// An index signature permits missing keys. Named properties retain their declared optionality.
type NamedKeys<Source> = keyof { [Key in keyof Source as string extends Key ? never : Key]: Source[Key] };
type Option<Source, Key extends PropertyKey> = Source extends object ? Key extends keyof Source
  ? Source[Key] | (Key extends NamedKeys<Source> ? never : undefined) : undefined : undefined;

type FirstRule<Access, Keys extends readonly RuleKey[]> =
  Keys extends readonly [infer Key extends RuleKey, ...infer Rest extends RuleKey[]]
    ? Exclude<Option<Access, Key>, undefined> | (undefined extends Option<Access, Key> ? FirstRule<Access, Rest> : never)
    : undefined;

type SelectedRule<Access, Operation extends CrudOperation> =
  Access extends unknown ? FirstRule<Access, (typeof ruleKeys)[Operation]> : never;

type AccessProperty<Rule> = undefined extends Rule ? { Access?: Exclude<Rule, undefined> } : { Access: Rule };

/** The declared access rule for one route, with the same precedence as the runtime selection. */
export type CrudRouteAccess<Options, Operation extends CrudOperation> =
  AccessProperty<SelectedRule<Option<Options, 'access'>, Operation>>;

// Shared writes require an opt-in. A widened override may enable a write, so its value is checked at definition time.
type DisabledWriteSetting<Options> = Options extends { tenancy: 'shared' } ? false | undefined : false;
type EnabledWriteFields<Options, Operation extends 'Create' | 'Update', Input> =
  [Option<Option<Options, 'operations'>, Operation>] extends [DisabledWriteSetting<Options>] ? never : keyof Input;

type WritableFields<Instance, Options> =
  | EnabledWriteFields<Options, 'Create', CreateInput<Instance>>
  | EnabledWriteFields<Options, 'Update', UpdateInput<Instance>>;

type CheckedFieldRules<Rules, Writable> = {
  [Name in keyof Rules]: string extends Name ? unknown : Name extends Writable ? unknown :
    [Option<Rules[Name], 'write'>] extends [undefined] ? unknown : { write?: undefined };
};

/** Checks declared field writes when the resolved resource carries its class type. */
export type CheckedFieldWriteAccess<Instance, Options> =
  [keyof Instance] extends [never] ? unknown : string extends keyof Instance ? unknown :
  Options extends { fields: ReadonlyMap<string, unknown> } ? {
    access?: {
      fields?: CheckedFieldRules<Option<Option<Options, 'access'>, 'fields'>, WritableFields<Instance, Options>>;
    };
  } : unknown;

export interface CrudAccessOptions<Rule = string | object> extends EnabledCrudOperationsOptions {
  name: string;
  access?: CrudAccessMap<Rule>;
  /** Resolved model fields for checking field-level write rules. */
  fields?: ReadonlyMap<string, CrudField>;
}

interface CrudAccessRuleOptions<Rule> {
  access?: CrudAccessMap<Rule>;
  operation: CrudOperation;
}

function ownRule<Rule>(access: CrudAccessMap<Rule> | undefined, key: RuleKey): Rule | undefined {
  return access && Object.hasOwn(access, key) ? access[key] : undefined;
}

/** Selects the declared rule for one CRUD operation. */
export function crudAccessRule<Rule>({ access, operation }: CrudAccessRuleOptions<Rule>): Rule | undefined {
  for (const key of ruleKeys[operation]) {
    const rule = ownRule(access, key);
    if (rule !== undefined) return rule;
  }
}

function hasRule(rule: unknown): boolean {
  if (typeof rule === 'string') return rule.trim().length > 0;
  if (Array.isArray(rule)) return rule.length > 0;
  if (rule === null || typeof rule !== 'object') return false;
  return Object.prototype.toString.call(rule) === '[object Object]' && Reflect.ownKeys(rule).length > 0;
}

/** Checks shared access and each field write rule against the enabled operations. */
export function validatedCrudOperations(options: CrudAccessOptions) {
  const operations = enabledCrudOperations(options);
  const access = Object.hasOwn(options, 'access') ? options.access : undefined;
  if (options.tenancy === 'shared' && operations.length === 0 && !Object.values(ruleKeys).flat().some(key => hasRule(ownRule(access, key)))) {
    throw new ApiDefinitionError(`Shared resource "${options.name}" requires an explicit CRUD access rule.`);
  }
  const selected = operations.map(operation => {
    const rule = crudAccessRule({ access, operation });
    if (options.tenancy === 'shared' && !hasRule(rule)) {
      const keys = ruleKeys[operation].map(key => `access.${key}`).join(' or ');
      throw new ApiDefinitionError(`Shared resource "${options.name}" requires an access rule for ${operation} (${keys}).`);
    }
    return { operation, rule };
  });

  const fieldRules = access && Object.hasOwn(access, 'fields') ? access.fields : undefined;
  if (!options.fields || !fieldRules) return selected;
  const createEnabled = operations.includes('Create');
  const updateEnabled = operations.includes('Update');
  for (const [name, rule] of Object.entries(fieldRules)) {
    if (!rule || !Object.hasOwn(rule, 'write') || rule.write === undefined) continue;
    const field = options.fields.get(name);
    if (!field) throw new ApiDefinitionError(`Resource "${options.name}" declares write access for unknown field "${name}".`);
    const grants = fieldOperations(field);
    const writable = (createEnabled && grants.includes('create')) || (updateEnabled && grants.includes('update'));
    if (!writable) {
      throw new ApiDefinitionError(`Resource "${options.name}" declares write access for field "${name}", which no enabled Create or Update operation can write.`);
    }
  }
  return selected;
}
