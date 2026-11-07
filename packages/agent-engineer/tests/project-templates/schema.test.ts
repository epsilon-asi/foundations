import { describe, expect, it } from 'vitest';
import { ProjectTemplateSchema } from '../../src/project-templates/schema.js';

function issues(input: unknown): string[] {
  const result = ProjectTemplateSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('ProjectTemplateSchema', () => {
  it('accepts a minimal manifest and defaults variables to {}', () => {
    expect(ProjectTemplateSchema.parse({ id: 'express-api', description: 'Express backend' })).toEqual({
      id: 'express-api',
      description: 'Express backend',
      variables: {},
    });
  });

  it('defaults required to false and leaves default unset', () => {
    const parsed = ProjectTemplateSchema.parse({
      id: 'svc',
      description: 'x',
      variables: { port: { description: 'Port' } },
    });
    expect(parsed.variables.port).toEqual({ description: 'Port', required: false });
  });

  it.each(['react-mui', 'consumer', 'api2', 'a-b-c'])('accepts the id %j', (id) => {
    expect(issues({ id, description: 'x' })).toEqual([]);
  });

  it.each(['', 'React-MUI', 'express_api', '-api', 'api-', 'a--b', '../escape', 'a/b'])('rejects the id %j', (id) => {
    expect(issues({ id, description: 'x' })).toEqual(['id: id must be kebab-case (e.g. express-api)']);
  });

  it('requires a description', () => {
    expect(issues({ id: 'svc' })).toHaveLength(1);
    expect(issues({ id: 'svc', description: '' })).toHaveLength(1);
  });

  it('requires a description on each variable', () => {
    expect(issues({ id: 'svc', description: 'x', variables: { port: {} } })).toHaveLength(1);
  });

  it('rejects unusable variable names', () => {
    expect(issues({ id: 'svc', description: 'x', variables: { '1port': { description: 'p' } } })).toEqual([
      "variables.1port: variable '1port' must start with a letter and contain only letters, digits and _",
    ]);
  });

  it.each(['name', 'packageName', 'PascalName'])('rejects declaring the built-in %s', (key) => {
    expect(issues({ id: 'svc', description: 'x', variables: { [key]: { description: 'n' } } })).toEqual([
      `variables.${key}: variable '${key}' is built in and cannot be declared`,
    ]);
  });

  it('rejects a variable that is both required and has a default', () => {
    expect(
      issues({ id: 'svc', description: 'x', variables: { port: { description: 'p', required: true, default: '1' } } }),
    ).toEqual(["variables.port: variable 'port' cannot be required and have a default"]);
  });

  it('rejects a non-string default', () => {
    expect(issues({ id: 'svc', description: 'x', variables: { port: { description: 'p', default: 3000 } } })).toHaveLength(1);
  });
});
