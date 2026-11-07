import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatValidation,
  validateTemplate,
  validateTemplates,
  type ValidationResult,
} from '../../src/project-templates/validate.js';
import { manifest, useTempDir, writeTemplate } from '../helpers/templateFixtures.js';

const tmp = useTempDir();

describe('validateTemplate', () => {
  it('passes a template that uses built-ins and every declared variable', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest(
        'svc',
        '  port:\n    description: Port\n    default: "3000"\n' +
          '  topic:\n    description: Topic\n    required: true\n' +
          '  suffix:\n    description: Suffix\n',
      ),
      files: {
        'package.json.tmpl': '{"name": "{{packageName}}", "port": {{port}}}',
        'src/{{PascalName}}{{suffix}}.ts.tmpl': 'export const TOPIC = "{{topic}}";',
        'App.tsx': '<div style={{ color: "red" }}>{{whatever}}</div>',
      },
    });

    await expect(validateTemplate(dir)).resolves.toEqual([]);
  });

  it('reports a missing manifest', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: null, files: { a: '' } });
    await expect(validateTemplate(dir)).resolves.toEqual([`${dir} has no template.yaml`]);
  });

  it('reports a manifest that does not match the schema', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: 'id: svc\n', files: { a: '' } });
    const errors = await validateTemplate(dir);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('template.yaml');
  });

  it('reports an id that is not the folder name', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('other'), files: { a: '' } });
    const errors = await validateTemplate(dir);
    expect(errors).toEqual([expect.stringContaining("id 'other' must match its folder name 'svc'")]);
  });

  it('reports a missing files/ folder', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), filesDir: false });
    await expect(validateTemplate(dir)).resolves.toEqual([`${dir} has no files/ folder`]);
  });

  it('reports an empty files/ folder', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc') });
    mkdirSync(join(dir, 'files', 'empty'));
    await expect(validateTemplate(dir)).resolves.toEqual(['files/ is empty']);
  });

  it('reports a symlink', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), files: { 'a.txt': '' } });
    symlinkSync(join(dir, 'files', 'a.txt'), join(dir, 'files', 'b.txt'));
    await expect(validateTemplate(dir)).resolves.toEqual([
      'b.txt: only regular files and folders are supported in a template',
    ]);
  });

  it('reports every unknown variable in paths and .tmpl contents', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc'),
      files: {
        '{{folder}}/a.txt': '',
        'b.txt.tmpl': '{{one}} {{name}} {{two}} {{one}}',
      },
    });

    await expect(validateTemplate(dir)).resolves.toEqual([
      'files/b.txt.tmpl: unknown variable {{one}}',
      'files/b.txt.tmpl: unknown variable {{two}}',
      'files/{{folder}}/a.txt (path): unknown variable {{folder}}',
    ]);
  });

  it('does not check variables in files without .tmpl', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), files: { 'a.txt': '{{unknown}}' } });
    await expect(validateTemplate(dir)).resolves.toEqual([]);
  });

  it('reports a declared variable that is never used', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc', '  port:\n    description: Port\n'),
      files: { 'a.txt': '{{port}} is not rendered here' },
    });
    await expect(validateTemplate(dir)).resolves.toEqual(["variable 'port' is declared but never used"]);
  });

  it('counts a variable used only in a path as used', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc', '  folder:\n    description: Folder\n    default: src\n'),
      files: { '{{folder}}/a.txt': '' },
    });
    await expect(validateTemplate(dir)).resolves.toEqual([]);
  });

  it('reports a default that uses a declared variable', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest(
        'svc',
        '  a:\n    description: A\n    default: x\n  b:\n    description: B\n    default: "{{a}}-{{name}}"\n',
      ),
      files: { 'a.txt.tmpl': '{{a}} {{b}}' },
    });
    await expect(validateTemplate(dir)).resolves.toEqual([
      "variable 'b': its default may only use name, packageName, PascalName, not {{a}}",
    ]);
  });

  it('reports a trial render where two files end up at the same path', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), files: { 'a.txt': '', 'a.txt.tmpl': '' } });
    await expect(validateTemplate(dir)).resolves.toEqual([
      "trial render: a.txt and a.txt.tmpl both render to 'a.txt'",
    ]);
  });

  it('reports a trial render where an optional variable with no default leaves an invalid path', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc', '  folder:\n    description: Folder\n'),
      files: { 'src/{{folder}}/a.txt': '' },
    });
    await expect(validateTemplate(dir)).resolves.toEqual([
      "trial render: src/{{folder}}/a.txt renders to 'src//a.txt', which is not a valid path inside the project",
    ]);
  });

  it('trial-renders required variables with a value', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc', '  folder:\n    description: Folder\n    required: true\n'),
      files: { 'src/{{folder}}/a.txt': '' },
    });
    await expect(validateTemplate(dir)).resolves.toEqual([]);
  });
});

describe('validateTemplates', () => {
  it('is valid when every template is', async () => {
    writeTemplate(tmp.path, 'consumer', { manifest: manifest('consumer'), files: { 'a.txt': '' } });
    writeTemplate(tmp.path, 'producer', { manifest: manifest('producer'), files: { 'a.txt': '' } });

    await expect(validateTemplates(tmp.path)).resolves.toEqual({
      root: tmp.path,
      errors: [],
      valid: true,
      templates: [
        { folder: 'consumer', errors: [] },
        { folder: 'producer', errors: [] },
      ],
    });
  });

  it('reports each failing template and stays invalid', async () => {
    writeTemplate(tmp.path, 'good', { manifest: manifest('good'), files: { 'a.txt': '' } });
    writeTemplate(tmp.path, 'bad', { manifest: manifest('bad'), files: { 'a.txt.tmpl': '{{nope}}' } });

    const result = await validateTemplates(tmp.path);

    expect(result.valid).toBe(false);
    expect(result.templates).toEqual([
      { folder: 'bad', errors: ['files/a.txt.tmpl: unknown variable {{nope}}'] },
      { folder: 'good', errors: [] },
    ]);
  });

  it('is invalid when there are no templates', async () => {
    await expect(validateTemplates(tmp.path)).resolves.toMatchObject({
      valid: false,
      errors: [`no templates found in ${tmp.path}`],
    });
  });

  it('is invalid when the root does not exist', async () => {
    const result = await validateTemplates(join(tmp.path, 'missing'));
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('ignores files and hidden folders in the root', async () => {
    writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), files: { 'a.txt': '' } });
    writeFileSync(join(tmp.path, 'README.md'), '');
    mkdirSync(join(tmp.path, '.cache'));

    const result = await validateTemplates(tmp.path);
    expect(result.valid).toBe(true);
    expect(result.templates.map((t) => t.folder)).toEqual(['svc']);
  });

  it('passes the built-in templates', async () => {
    const result = await validateTemplates();
    expect(formatValidation(result)).toContain('template(s) valid.');
    expect(result.valid).toBe(true);
  });
});

describe('formatValidation', () => {
  it('prints ok for each valid template', () => {
    const result: ValidationResult = {
      root: '/t',
      errors: [],
      valid: true,
      templates: [{ folder: 'a', errors: [] }],
    };
    expect(formatValidation(result)).toBe('Validating templates in /t\n  ok      a\n1 template(s) valid.\n');
  });

  it('prints failures with their errors', () => {
    const result: ValidationResult = {
      root: '/t',
      errors: [],
      valid: false,
      templates: [
        { folder: 'a', errors: [] },
        { folder: 'b', errors: ['first', 'second'] },
      ],
    };
    expect(formatValidation(result)).toBe(
      'Validating templates in /t\n' +
        '  ok      a\n' +
        '  failed  b\n' +
        '            - first\n' +
        '            - second\n' +
        '1 of 2 template(s) failed.\n',
    );
  });

  it('prints root errors', () => {
    const result: ValidationResult = { root: '/t', errors: ['no templates found in /t'], valid: false, templates: [] };
    expect(formatValidation(result)).toBe(
      'Validating templates in /t\n  error: no templates found in /t\n0 of 0 template(s) failed.\n',
    );
  });
});
