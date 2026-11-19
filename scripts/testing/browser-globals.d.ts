// An explicit declaration reference to @types/node would introduce these
// globals even with ambient type packages disabled in the browser project.
type ExpectAbsent<T extends never> = T;
export type NodeGlobals = ExpectAbsent<Extract<'process' | 'Buffer', keyof typeof globalThis>>;
