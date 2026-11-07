import { describe, expect, it } from 'vitest';
import {
  builtInVariables,
  parseVarArgs,
  referencedVariables,
  renderPath,
  renderString,
  resolveVariables,
  toKebab,
  toPascal,
} from '../../src/project-templates/render.js';
import { type ProjectTemplate, ProjectTemplateSchema } from '../../src/project-templates/schema.js';

function template(variables: Record<string, unknown> = {}): ProjectTemplate {
  return ProjectTemplateSchema.parse({ id: 'svc', description: 'A service', variables });
}

describe('renderString', () => {
  it('fills every occurrence of each variable', () => {
    expect(renderString('{{a}}-{{b}}-{{a}}', { a: '1', b: '2' })).toBe('1-2-1');
  });

  it('allows spaces inside the braces', () => {
    expect(renderString('{{ a }}|{{a  }}|{{  a}}', { a: 'x' })).toBe('x|x|x');
  });

  it('leaves text without placeholders untouched', () => {
    expect(renderString('plain { text } {single}', {})).toBe('plain { text } {single}');
  });

  it('does not treat JSX double braces as variables', () => {
    const jsx = '<div style={{ color: "red" }} />';
    expect(renderString(jsx, {})).toBe(jsx);
  });

  it('ignores names that are not identifiers', () => {
    expect(renderString('{{1abc}} {{a-b}} {{}}', {})).toBe('{{1abc}} {{a-b}} {{}}');
  });

  it('inserts values literally, including $ patterns and braces', () => {
    expect(renderString('{{a}}', { a: '$& $1 {{b}}' })).toBe('$& $1 {{b}}');
  });

  it('throws on an unknown variable, naming it and where it was found', () => {
    expect(() => renderString('x {{nope}}', {}, 'src/index.ts.tmpl')).toThrow(
      "Unknown variable '{{nope}}' in src/index.ts.tmpl",
    );
  });

  it('accepts an empty-string value', () => {
    expect(renderString('[{{a}}]', { a: '' })).toBe('[]');
  });
});

describe('renderPath', () => {
  it('fills variables and drops .tmpl', () => {
    expect(renderPath('src/{{PascalName}}Server.ts.tmpl', { PascalName: 'OrdersApi' })).toBe('src/OrdersApiServer.ts');
  });

  it('keeps paths without variables or .tmpl as they are', () => {
    expect(renderPath('src/__tests__/a.test.ts', {})).toBe('src/__tests__/a.test.ts');
  });

  it('only drops .tmpl at the end', () => {
    expect(renderPath('a.tmpl.json', {})).toBe('a.tmpl.json');
  });

  it('fills variables in folder names', () => {
    expect(renderPath('{{name}}/{{name}}.txt', { name: 'x' })).toBe('x/x.txt');
  });

  it('names the path when a variable is unknown', () => {
    expect(() => renderPath('src/{{missing}}.ts', {})).toThrow("Unknown variable '{{missing}}' in src/{{missing}}.ts");
  });
});

describe('referencedVariables', () => {
  it('lists each name once in order of first appearance', () => {
    expect(referencedVariables('{{b}} {{a}} {{ b }} {{c}}')).toEqual(['b', 'a', 'c']);
  });

  it('is empty when there are none', () => {
    expect(referencedVariables('style={{ color: "red" }}')).toEqual([]);
  });
});

describe('parseVarArgs', () => {
  it('parses key=value pairs', () => {
    expect(parseVarArgs(['port=8080', 'region=eu'])).toEqual({ port: '8080', region: 'eu' });
  });

  it('splits on the first = only', () => {
    expect(parseVarArgs(['url=http://x?a=b'])).toEqual({ url: 'http://x?a=b' });
  });

  it('allows an empty value', () => {
    expect(parseVarArgs(['suffix='])).toEqual({ suffix: '' });
  });

  it('returns an empty object for no arguments', () => {
    expect(parseVarArgs([])).toEqual({});
  });

  it.each(['port', '=8080', ''])('rejects %j', (arg) => {
    expect(() => parseVarArgs([arg])).toThrow(`Expected key=value, got '${arg}'`);
  });

  it('rejects a key given twice', () => {
    expect(() => parseVarArgs(['a=1', 'a=2'])).toThrow("Variable 'a' was given more than once");
  });
});

describe('toKebab / toPascal', () => {
  it.each([
    ['orders-api', 'orders-api', 'OrdersApi'],
    ['orders_api', 'orders-api', 'OrdersApi'],
    ['orders.api', 'orders-api', 'OrdersApi'],
    ['OrdersApi', 'orders-api', 'OrdersApi'],
    ['ordersApi', 'orders-api', 'OrdersApi'],
    ['APIServer', 'api-server', 'ApiServer'],
    ['orders--api__v2', 'orders-api-v2', 'OrdersApiV2'],
    ['orders', 'orders', 'Orders'],
  ])('%s → %s / %s', (input, kebab, pascal) => {
    expect(toKebab(input)).toBe(kebab);
    expect(toPascal(input)).toBe(pascal);
  });
});

describe('builtInVariables', () => {
  it('derives packageName and PascalName from the name', () => {
    expect(builtInVariables('orders-api')).toEqual({
      name: 'orders-api',
      packageName: 'orders-api',
      PascalName: 'OrdersApi',
    });
  });

  it('keeps the name exactly as given', () => {
    expect(builtInVariables('OrdersApi').name).toBe('OrdersApi');
  });

  it.each(['', '1orders', '-orders', '../escape', 'a/b', 'has space', '.hidden'])('rejects the name %j', (name) => {
    expect(() => builtInVariables(name)).toThrow(`Invalid project name '${name}'`);
  });
});

describe('resolveVariables', () => {
  it('returns only the built-ins when the template declares nothing', () => {
    expect(resolveVariables(template(), 'orders-api', {})).toEqual({
      name: 'orders-api',
      packageName: 'orders-api',
      PascalName: 'OrdersApi',
    });
  });

  it('prefers a given value over the default', () => {
    const vars = resolveVariables(template({ port: { description: 'Port', default: '3000' } }), 'a', { port: '8080' });
    expect(vars.port).toBe('8080');
  });

  it('falls back to the default', () => {
    const vars = resolveVariables(template({ port: { description: 'Port', default: '3000' } }), 'a', {});
    expect(vars.port).toBe('3000');
  });

  it('renders built-ins in a default', () => {
    const vars = resolveVariables(
      template({ worker: { description: 'Worker', default: '{{packageName}}-worker ({{PascalName}})' } }),
      'OrdersApi',
      {},
    );
    expect(vars.worker).toBe('orders-api-worker (OrdersApi)');
  });

  it('rejects a default that uses another declared variable', () => {
    expect(() =>
      resolveVariables(
        template({ a: { description: 'A', default: 'x' }, b: { description: 'B', default: '{{a}}' } }),
        'svc',
        {},
      ),
    ).toThrow("Unknown variable '{{a}}' in the default of 'b'");
  });

  it('accepts a given value for a required variable', () => {
    const vars = resolveVariables(template({ topic: { description: 'Topic', required: true } }), 'a', { topic: 't' });
    expect(vars.topic).toBe('t');
  });

  it('accepts an empty value for a required variable', () => {
    const vars = resolveVariables(template({ topic: { description: 'Topic', required: true } }), 'a', { topic: '' });
    expect(vars.topic).toBe('');
  });

  it('lists every missing required variable with its description', () => {
    expect(() =>
      resolveVariables(
        template({
          a: { description: 'First', required: true },
          b: { description: 'Second', required: true },
          c: { description: 'Third', default: 'x' },
        }),
        'svc',
        {},
      ),
    ).toThrow("Template 'svc' requires a=<value> (First), b=<value> (Second)");
  });

  it('uses an empty string for an optional variable with no default', () => {
    const vars = resolveVariables(template({ suffix: { description: 'Suffix' } }), 'a', {});
    expect(vars.suffix).toBe('');
  });

  it('rejects variables the template does not declare, listing the declared ones', () => {
    expect(() =>
      resolveVariables(template({ port: { description: 'Port', default: '1' } }), 'a', { prot: '1', x: '2' }),
    ).toThrow("Template 'svc' has no variable 'prot', 'x' (declared: port)");
  });

  it('says so when the template declares no variables', () => {
    expect(() => resolveVariables(template(), 'a', { port: '1' })).toThrow(
      "Template 'svc' has no variable 'port' (it declares none)",
    );
  });

  it('rejects giving a built-in', () => {
    expect(() => resolveVariables(template(), 'a', { name: 'other' })).toThrow("has no variable 'name'");
  });

  it('rejects an invalid project name before anything else', () => {
    expect(() => resolveVariables(template(), '../x', {})).toThrow("Invalid project name '../x'");
  });
});
