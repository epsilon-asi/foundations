# Changelog

## 0.1.0

- `pythonToTypeScript` and `typeScriptToPython`, with `createConverter` to bind shared options.
- Python front end: typing, `typing_extensions`, `collections.abc`, dataclasses, pydantic v2 (and v1 `Config`),
  attrs, msgspec, enums with `auto()`, NamedTuple, TypedDict (class and functional syntax), Protocol, NewType,
  ParamSpec, TypeVarTuple and PEP 695 syntax.
- TypeScript front end on the TypeScript 5/6 compiler API, with checker-evaluated utility, mapped, conditional,
  `keyof`, indexed-access and `typeof` types.
- Python output for 3.11 through 3.14 with `typing_extensions` fallbacks; TypedDict, dataclass, pydantic and
  Protocol object styles.
- TypeScript output in `json` and `runtime` modes, with union, enum, const enum and `as const` object enum styles.
- Diagnostics for every lossy or restructured conversion; `strict` mode.
