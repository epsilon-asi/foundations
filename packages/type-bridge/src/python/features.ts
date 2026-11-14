import type { PythonVersion } from '../options.js';

/**
 * The Python version each typing feature first appeared in the standard library. The minimum supported target is
 * 3.11, so everything older (`X | Y`, `list[int]`, `Self`, `NotRequired`, `StrEnum`, `kw_only`, `*Ts`) is always
 * available. A feature newer than the target is imported from `typing_extensions` or written the older way.
 */
export const FEATURE_VERSIONS = {
  /** `type X = ...` and `class C[T]:` (PEP 695). */
  typeParamSyntax: '3.12',
  /** `TypeVar(..., infer_variance=True)`. */
  inferVariance: '3.12',
  /** `ReadOnly` TypedDict keys (PEP 705). */
  readOnly: '3.13',
  /** Type parameter defaults (PEP 696). */
  typeVarDefaults: '3.13',
  /** `warnings.deprecated` (PEP 702). */
  deprecated: '3.13',
  /** Annotations are evaluated lazily (PEP 649), so forward references need no quotes. */
  deferredAnnotations: '3.14',
  /** `closed=` / `extra_items=` on TypedDict (PEP 728). Not in a released standard library yet. */
  typedDictExtraItems: '3.15',
} as const satisfies Record<string, string>;

export type Feature = keyof typeof FEATURE_VERSIONS;

export function versionAtLeast(version: string, min: string): boolean {
  const [a = 0, b = 0] = version.split('.').map(Number);
  const [c = 0, d = 0] = min.split('.').map(Number);
  return a !== c ? a > c : b >= d;
}

export class Features {
  readonly version: PythonVersion;

  constructor(version: PythonVersion) {
    this.version = version;
  }

  has(feature: Feature): boolean {
    return versionAtLeast(this.version, FEATURE_VERSIONS[feature]);
  }
}

/** `typing` names that are newer than the oldest supported target, by the feature that introduced them. */
export const TYPING_NAME_FEATURE: Record<string, Feature | undefined> = {
  ReadOnly: 'readOnly',
};
