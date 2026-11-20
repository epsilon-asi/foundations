declare const read: unique symbol;
declare const write: unique symbol;
declare const defaulted: unique symbol;
declare const id: unique symbol;
declare const tenant: unique symbol;
declare const secret: unique symbol;

export type DefaultAxis = typeof defaulted;
export type IdAxis = typeof id;
export type ReadAxis = typeof read;
export type SecretAxis = typeof secret;
export type TenantAxis = typeof tenant;
export type WriteAxis = typeof write;

export type WriteOperation = 'create' | 'update';
export type FieldOperation = 'read' | WriteOperation;

// Optional phantom keys let fields accept plain values. Each grant carries the
// underlying value type so a projection can recover it without the flavor.
type Access<T, Operation extends WriteOperation> = {
  readonly [read]?: T;
  readonly [write]?: { readonly [K in Operation]: T };
  readonly [defaulted]?: true;
  readonly [id]?: T;
  readonly [tenant]?: T;
  readonly [secret]?: true;
};

export type AccessAxis = keyof Access<unknown, WriteOperation>;

type Flavor<T, Axis extends keyof Access<T, WriteOperation>, Operation extends WriteOperation = WriteOperation> =
  T extends null | undefined ? T : T & Pick<Access<T, Operation>, Axis>;

/** Visible in reads and set by the server. */
export type Readable<T> = Flavor<T, typeof read>;

/** The server-set primary key, visible in reads and used by item routes. */
export type Id<T> = Flavor<T, typeof read | typeof id>;

/** The owning tenant's ID, visible in reads and supplied by the tenant context. */
export type Tenant<T> = Flavor<T, typeof read | typeof tenant>;

/** Visible in reads and writable on create and update. */
export type Editable<T> = Flavor<T, typeof read | typeof write>;

/** Visible in reads and writable only on create. */
export type CreateOnly<T> = Flavor<T, typeof read | typeof write, 'create'>;

/** Visible in reads and writable only on update. */
export type UpdateOnly<T> = Flavor<T, typeof read | typeof write, 'update'>;

/** Writable on create and update and omitted from reads. */
export type WriteOnly<T> = Flavor<T, typeof write>;

/** Explicitly declares a server-only field with the same type as an unmarked field. */
export type Internal<T> = T;

/** Marks a server-only field as sensitive for redaction and encrypted storage. */
export type Secret<T> = Flavor<T, typeof secret>;

/** Marks a schema-supplied default while preserving the field's access grants. */
export type Defaulted<T> = Flavor<T, typeof defaulted>;
