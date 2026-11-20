type NamedKeys<Source> = keyof {
  [Key in keyof Source as {} extends Record<Key, unknown> ? never : Key]: Source[Key]
};

/** A named property keeps its optionality. Looking up an index signature can also find a missing key. */
export type DeclaredOption<Source, Key extends PropertyKey> = Source extends object ? Key extends keyof Source
  ? Source[Key] | (Key extends NamedKeys<Source> ? never : undefined) : undefined : undefined;
