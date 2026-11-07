import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertTargetDir, type PlannedFile, planFiles, walkFiles, writeFiles } from '../../src/project-templates/apply.js';
import { loadTemplate } from '../../src/project-templates/registry.js';
import { manifest, useTempDir, writeTemplate } from '../helpers/templateFixtures.js';

const tmp = useTempDir();

const VARS = { name: 'orders-api', packageName: 'orders-api', PascalName: 'OrdersApi', port: '8080' };

async function fixture(files: Record<string, string | Uint8Array>) {
  const dir = writeTemplate(join(tmp.path, 'templates'), 'svc', {
    manifest: manifest('svc', '  port:\n    description: Port\n    default: "3000"\n'),
    files,
  });
  return loadTemplate(dir);
}

function target(...parts: string[]): string {
  return join(tmp.path, 'out', ...parts);
}

describe('walkFiles', () => {
  it('lists nested files with / separators, sorted', async () => {
    const template = await fixture({ 'b.txt': '', 'a/z.txt': '', 'a/b/c.txt': '' });
    await expect(walkFiles(template.filesDir)).resolves.toEqual(['a/b/c.txt', 'a/z.txt', 'b.txt']);
  });

  it('includes dotfiles', async () => {
    const template = await fixture({ '.gitignore': 'node_modules\n', '.github/ci.yml': '' });
    await expect(walkFiles(template.filesDir)).resolves.toEqual(['.github/ci.yml', '.gitignore']);
  });

  it('skips empty folders', async () => {
    const template = await fixture({ 'a.txt': '' });
    mkdirSync(join(template.filesDir, 'empty'));
    await expect(walkFiles(template.filesDir)).resolves.toEqual(['a.txt']);
  });

  it('rejects symlinks', async () => {
    const template = await fixture({ 'a.txt': '' });
    symlinkSync(join(template.filesDir, 'a.txt'), join(template.filesDir, 'link.txt'));
    await expect(walkFiles(template.filesDir)).rejects.toThrow(
      'link.txt: only regular files and folders are supported in a template',
    );
  });
});

describe('planFiles', () => {
  it('renders .tmpl files and copies the rest', async () => {
    const template = await fixture({
      'package.json.tmpl': '{"name": "{{packageName}}"}',
      'tsconfig.json': '{"x": "{{packageName}}"}',
    });

    const plan = await planFiles(template, target(), VARS);

    expect(plan).toEqual([
      {
        source: join(template.filesDir, 'package.json.tmpl'),
        sourcePath: 'package.json.tmpl',
        path: 'package.json',
        target: target('package.json'),
        render: true,
        contents: '{"name": "orders-api"}',
      },
      {
        source: join(template.filesDir, 'tsconfig.json'),
        sourcePath: 'tsconfig.json',
        path: 'tsconfig.json',
        target: target('tsconfig.json'),
        render: false,
      },
    ]);
  });

  it('renders variables in file and folder names', async () => {
    const template = await fixture({ 'src/{{PascalName}}/{{PascalName}}Server.ts.tmpl': 'export const PORT = {{port}};' });

    const [file] = await planFiles(template, target(), VARS);

    expect(file).toMatchObject({
      path: 'src/OrdersApi/OrdersApiServer.ts',
      target: target('src', 'OrdersApi', 'OrdersApiServer.ts'),
      contents: 'export const PORT = 8080;',
    });
  });

  it('does not render variables in files without .tmpl', async () => {
    const jsx = 'export const A = () => <div style={{ color: "red" }}>{{name}}</div>;';
    const template = await fixture({ 'App.tsx': jsx });

    const [file] = await planFiles(template, target(), VARS);

    expect(file).toMatchObject({ path: 'App.tsx', render: false });
    expect(file?.contents).toBeUndefined();
  });

  it('writes nothing', async () => {
    const template = await fixture({ 'a.txt.tmpl': '{{name}}' });
    await planFiles(template, target(), VARS);
    expect(existsSync(target())).toBe(false);
  });

  it('fails on an unknown variable in a .tmpl file, naming the file', async () => {
    const template = await fixture({ 'src/index.ts.tmpl': '{{nope}}' });
    await expect(planFiles(template, target(), VARS)).rejects.toThrow(
      "Unknown variable '{{nope}}' in src/index.ts.tmpl",
    );
  });

  it('fails on an unknown variable in a path', async () => {
    const template = await fixture({ '{{nope}}.txt': '' });
    await expect(planFiles(template, target(), VARS)).rejects.toThrow("Unknown variable '{{nope}}' in {{nope}}.txt");
  });

  it('fails when two files render to the same path', async () => {
    const template = await fixture({ 'a.txt': '', 'a.txt.tmpl': '' });
    await expect(planFiles(template, target(), VARS)).rejects.toThrow("a.txt and a.txt.tmpl both render to 'a.txt'");
  });

  it('fails when a variable renders a path outside the project', async () => {
    const template = await fixture({ '{{port}}/a.txt': '' });
    await expect(planFiles(template, target(), { ...VARS, port: '..' })).rejects.toThrow(
      "{{port}}/a.txt renders to '../a.txt', which is not a valid path inside the project",
    );
  });

  it('fails when an empty variable leaves an empty path segment', async () => {
    const template = await fixture({ 'src/{{port}}/a.txt': '' });
    await expect(planFiles(template, target(), { ...VARS, port: '' })).rejects.toThrow(
      "src/{{port}}/a.txt renders to 'src//a.txt'",
    );
  });

  it('fails when a file name renders empty', async () => {
    const template = await fixture({ '{{port}}.tmpl': '' });
    await expect(planFiles(template, target(), { ...VARS, port: '' })).rejects.toThrow("renders to ''");
  });

  it('fails when a variable renders an absolute path', async () => {
    const template = await fixture({ '{{port}}etc/passwd': '' });
    await expect(planFiles(template, target(), { ...VARS, port: '/' })).rejects.toThrow(
      'which is not a valid path inside the project',
    );
  });

  it('allows a variable that adds subfolders', async () => {
    const template = await fixture({ 'src/{{port}}.ts': '' });
    const [file] = await planFiles(template, target(), { ...VARS, port: 'a/b' });
    expect(file?.path).toBe('src/a/b.ts');
  });

  it('is empty for an empty files/ folder', async () => {
    const template = await fixture({});
    await expect(planFiles(template, target(), VARS)).resolves.toEqual([]);
  });
});

describe('assertTargetDir', () => {
  it('accepts a missing folder', async () => {
    await expect(assertTargetDir(target(), false)).resolves.toBeUndefined();
  });

  it('accepts an empty folder', async () => {
    mkdirSync(target(), { recursive: true });
    await expect(assertTargetDir(target(), false)).resolves.toBeUndefined();
  });

  it('rejects a folder that is not empty', async () => {
    mkdirSync(target(), { recursive: true });
    writeFileSync(target('existing.txt'), '');
    await expect(assertTargetDir(target(), false)).rejects.toThrow(
      `${target()} is not empty; pass --force to write into it anyway`,
    );
  });

  it('accepts a folder that is not empty with force', async () => {
    mkdirSync(target(), { recursive: true });
    writeFileSync(target('existing.txt'), '');
    await expect(assertTargetDir(target(), true)).resolves.toBeUndefined();
  });

  it('rejects a file, even with force', async () => {
    mkdirSync(join(tmp.path, 'out-parent'), { recursive: true });
    const file = join(tmp.path, 'out-parent', 'file');
    writeFileSync(file, '');
    await expect(assertTargetDir(file, true)).rejects.toThrow(`${file} exists and is not a folder`);
  });
});

describe('writeFiles', () => {
  it('writes rendered and copied files, creating folders', async () => {
    const template = await fixture({
      'package.json.tmpl': '{"name": "{{packageName}}"}',
      'src/deep/a.txt': 'copied {{name}}',
    });
    const plan = await planFiles(template, target(), VARS);

    await writeFiles(plan, target(), { force: false });

    expect(readFileSync(target('package.json'), 'utf8')).toBe('{"name": "orders-api"}');
    expect(readFileSync(target('src', 'deep', 'a.txt'), 'utf8')).toBe('copied {{name}}');
    expect(readdirSync(target()).sort()).toEqual(['package.json', 'src']);
  });

  it('copies binary files byte for byte', async () => {
    const bytes = new Uint8Array([0, 255, 1, 254, 0x7b, 0x7b, 0x6e, 0x7d, 0x7d]);
    const template = await fixture({ 'logo.png': bytes });
    const plan = await planFiles(template, target(), VARS);

    await writeFiles(plan, target(), { force: false });

    expect(new Uint8Array(readFileSync(target('logo.png')))).toEqual(bytes);
  });

  it.skipIf(process.platform === 'win32')('keeps the permissions of copied and rendered files', async () => {
    const template = await fixture({ 'run.sh': '#!/bin/sh\n', 'start.sh.tmpl': '#!/bin/sh\necho {{name}}\n' });
    chmodSync(join(template.filesDir, 'run.sh'), 0o755);
    chmodSync(join(template.filesDir, 'start.sh.tmpl'), 0o755);
    const plan = await planFiles(template, target(), VARS);

    await writeFiles(plan, target(), { force: false });

    expect(statSync(target('run.sh')).mode & 0o111).not.toBe(0);
    expect(statSync(target('start.sh')).mode & 0o111).not.toBe(0);
  });

  it('refuses a folder that is not empty and writes nothing', async () => {
    const template = await fixture({ 'a.txt': 'new' });
    const plan = await planFiles(template, target(), VARS);
    mkdirSync(target(), { recursive: true });
    writeFileSync(target('existing.txt'), 'keep');

    await expect(writeFiles(plan, target(), { force: false })).rejects.toThrow('is not empty');
    expect(readdirSync(target())).toEqual(['existing.txt']);
  });

  it('overwrites and keeps other files with force', async () => {
    const template = await fixture({ 'a.txt': 'new' });
    const plan = await planFiles(template, target(), VARS);
    mkdirSync(target(), { recursive: true });
    writeFileSync(target('a.txt'), 'old');
    writeFileSync(target('existing.txt'), 'keep');

    await writeFiles(plan, target(), { force: true });

    expect(readFileSync(target('a.txt'), 'utf8')).toBe('new');
    expect(readFileSync(target('existing.txt'), 'utf8')).toBe('keep');
  });

  it('refuses a plan entry outside the target folder', async () => {
    const template = await fixture({ 'a.txt': '' });
    const escaping: PlannedFile = {
      source: join(template.filesDir, 'a.txt'),
      sourcePath: 'a.txt',
      path: '../a.txt',
      target: join(tmp.path, 'a.txt'),
      render: false,
    };

    await expect(writeFiles([escaping], target(), { force: false })).rejects.toThrow(`is outside ${target()}`);
    expect(existsSync(join(tmp.path, 'a.txt'))).toBe(false);
  });
});
