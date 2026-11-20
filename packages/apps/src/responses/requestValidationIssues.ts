import type { z } from 'zod/v4';
import { pathRequestFields, type PathRequestFieldsOptions } from '../endpoints/assertPathRequestFields.js';
import type { ValidationFailureResponse } from './validationFailure.js';

export interface RequestValidationIssuesOptions extends Pick<PathRequestFieldsOptions, 'path' | 'paramFields'> {
  /** The issues from validating the endpoint's RequestContent. */
  issues: readonly z.core.$ZodIssue[];
}

const sections = new Set<PropertyKey>(['params', 'query', 'body', 'headers']);

function issueFields(issue: z.core.$ZodIssue): readonly string[] {
  const [section, field] = issue.path;
  if (issue.path.length > 0 && !sections.has(section)) return [''];
  if (typeof field === 'string') return [field];
  // Zod puts extra keys on their containing object, with the submitted names in keys.
  if (issue.code === 'unrecognized_keys' && issue.path.length <= 1 && issue.keys.length > 0) return issue.keys;
  return [''];
}

/** Maps nested request-content issues to their owning flat field. The empty path denotes a form-level issue. */
export function requestValidationIssues({ path, paramFields, issues }: RequestValidationIssuesOptions): ValidationFailureResponse['issues'] {
  const parameters = new Map(pathRequestFields({ path, paramFields }).map(({ param, field }) => [param, field]));
  return issues.flatMap(issue => issueFields(issue).map(field => ({
    path: issue.path[0] === 'params' ? parameters.get(field) ?? field : field,
    message: issue.message,
    code: issue.code,
  })));
}
