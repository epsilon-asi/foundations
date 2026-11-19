import { toCamelCase, type FieldOutputOf } from '@epsilon-asi/foundation';
import type { uiExtension } from '../model/extensions/ui.js';

interface ResourceField {
  /** Declared resource name, such as ApiKey. */
  resource: string;
  /** Field name in the resource model. */
  field: string;
}

export interface FieldMessageKeysOptions extends ResourceField {
  /** Resolved UI hints. Omitted text keys derive from the resource and field names. */
  ui?: FieldOutputOf<typeof uiExtension>;
}

export interface EnumOptionMessageKeyOptions extends ResourceField {
  /** Declared enum value as stored in the resource field. */
  value: string | number;
}

function fieldKey({ resource, field }: ResourceField) {
  return `${toCamelCase(resource)}.${field}`;
}

/** Resolves the label, placeholder and helper text keys for a resource field. */
export function fieldMessageKeys({ resource, field, ui }: FieldMessageKeysOptions) {
  const base = fieldKey({ resource, field });
  return {
    label: ui?.label ?? base,
    placeholder: ui?.placeholder ?? `${base}.placeholder`,
    helperText: ui?.helperText ?? `${base}.helper`,
  };
}

/** Derives the default label key for an enum option from its declared value. */
export function enumOptionMessageKey({ resource, field, value }: EnumOptionMessageKeyOptions) {
  return `${fieldKey({ resource, field })}.${value}`;
}
