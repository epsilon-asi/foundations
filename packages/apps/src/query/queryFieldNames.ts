const reservedNames = ['__proto__', 'prototype', 'constructor'] as const;
export const reservedQueryFields: ReadonlySet<string> = new Set(reservedNames);
export type QueryFieldName<Name> = Exclude<Extract<Name, string>, typeof reservedNames[number]>;

// An object literal can omit a declared field named toString or valueOf despite its inherited methods.
export type OptionalQueryFields<Fields extends object, Method extends keyof Fields = Extract<keyof Fields, keyof Object>> =
  Partial<Fields> | (Method extends unknown
    ? [Exclude<keyof Fields, Method>] extends [never] ? Record<string, never> : OptionalQueryFields<Omit<Fields, Method>>
    : never);
