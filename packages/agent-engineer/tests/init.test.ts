import { runCli } from '@epsilon-asi/command-line';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentEngineer } from '../src/cli.js';
import { captureIO } from './helpers/captureIO.js';
import { useConfigSandbox } from './helpers/configSandbox.js';
import { manifest, writeTemplate } from './helpers/templateFixtures.js';

// The command reads TEMPLATES_DIR; point it at fixture templates so these
// tests do not depend on what the real templates contain.
const fixtures = await vi.hoisted(async () => {
  const { mkdtempSync, realpathSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return { root: join(realpathSync(mkdtempSync(join(tmpdir(), 'agent-engineer-init-'))), 'templates') };
});

vi.mock('../src/project-templates/registry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/project-templates/registry.js')>()),
  TEMPLATES_DIR: fixtures.root,
}));

const sandbox = useConfigSandbox();

function writeFixtures(): void {
  rmSync(fixtures.root, { recursive: true, force: true });
  writeTemplate(fixtures.root, 'express-api', {
    manifest: manifest(
      'express-api',
      '  port:\n    description: Port to listen on\n    default: "3000"\n',
      'Express backend',
    ),
    files: {
      'package.json.tmpl': '{"name": "{{packageName}}"}\n',
      'tsconfig.json': '{"compilerOptions": {}}\n',
      'src/{{PascalName}}Server.ts.tmpl': 'export const PORT = Number(process.env.PORT ?? {{port}});\n',
    },
  });
  writeTemplate(fixtures.root, 'consumer', {
    manifest: manifest('consumer', '  source:\n    description: Where messages come from\n    required: true\n', 'Message consumer'),
    files: { 'src/index.ts.tmpl': 'export const SOURCE = "{{source}}";\n' },
  });
  writeTemplate(fixtures.root, 'plain', {
    manifest: manifest('plain', '  note:\n    description: A note\n', 'No defaults'),
    files: { 'NOTE.md.tmpl': 'note: {{note}}\n' },
  });
}

async function init(...argv: string[]) {
  const { io, stdout, stderr } = captureIO();
  const exitCode = await runCli(AgentEngineer, ['init', ...argv], { io });
  return { exitCode, stdout: stdout(), stderr: stderr() };
}

function read(...parts: string[]): string {
  return readFileSync(join(sandbox.cwd, ...parts), 'utf8');
}

beforeEach(writeFixtures);

afterAll(() => {
  rmSync(join(fixtures.root, '..'), { recursive: true, force: true });
});

describe('agent-engineer init', () => {
  it('is listed in the root help', async () => {
    const { io, stdout } = captureIO();
    await expect(runCli(AgentEngineer, ['--help'], { io })).resolves.toBe(0);
    expect(stdout()).toMatch(/init \[options\] \[template\] \[name\] \[vars\.\.\.\]\s+Create a project from a project template/);
  });

  it('documents its options', async () => {
    const result = await init('--help');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--dir <dir>');
    expect(result.stdout).toContain('--dry-run');
    expect(result.stdout).toContain('--force');
  });

  describe('listing', () => {
    it('lists the templates with their variables when no template is given', async () => {
      const result = await init();

      expect(result).toEqual({
        exitCode: 0,
        stderr: '',
        stdout:
          'consumer     Message consumer\n' +
          '               source=  Where messages come from (required)\n' +
          'express-api  Express backend\n' +
          '               port=  Port to listen on (default: 3000)\n' +
          'plain        No defaults\n' +
          '               note=  A note\n',
      });
    });

    it('lists the templates as JSON', async () => {
      const result = await init('--format', 'json');

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual([
        {
          id: 'consumer',
          description: 'Message consumer',
          variables: { source: { description: 'Where messages come from', required: true } },
        },
        {
          id: 'express-api',
          description: 'Express backend',
          variables: { port: { description: 'Port to listen on', required: false, default: '3000' } },
        },
        { id: 'plain', description: 'No defaults', variables: { note: { description: 'A note', required: false } } },
      ]);
    });

    it('says when there are no templates', async () => {
      rmSync(fixtures.root, { recursive: true, force: true });
      mkdirSync(fixtures.root, { recursive: true });

      await expect(init()).resolves.toEqual({ exitCode: 0, stderr: '', stdout: 'No templates found.\n' });
    });

    it('fails when a template is invalid', async () => {
      writeTemplate(fixtures.root, 'broken', { manifest: manifest('wrong') });

      const result = await init();
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("id 'wrong' must match its folder name 'broken'");
    });
  });

  describe('creating a project', () => {
    it('renders the template into ./<name>', async () => {
      const result = await init('express-api', 'orders-api');

      expect(result).toEqual({
        exitCode: 0,
        stderr: '',
        stdout:
          'Created orders-api from express-api:\n' +
          '  package.json  (rendered)\n' +
          '  src/OrdersApiServer.ts  (rendered)\n' +
          '  tsconfig.json\n',
      });
      expect(read('orders-api', 'package.json')).toBe('{"name": "orders-api"}\n');
      expect(read('orders-api', 'src', 'OrdersApiServer.ts')).toBe(
        'export const PORT = Number(process.env.PORT ?? 3000);\n',
      );
      expect(read('orders-api', 'tsconfig.json')).toBe('{"compilerOptions": {}}\n');
    });

    it('uses key=value arguments over defaults', async () => {
      await expect(init('express-api', 'orders-api', 'port=8080')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('orders-api', 'src', 'OrdersApiServer.ts')).toContain('?? 8080');
    });

    it('derives packageName and PascalName from the name', async () => {
      await expect(init('express-api', 'OrdersAPI')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('OrdersAPI', 'package.json')).toBe('{"name": "orders-api"}\n');
      expect(existsSync(join(sandbox.cwd, 'OrdersAPI', 'src', 'OrdersApiServer.ts'))).toBe(true);
    });

    it('writes into --dir', async () => {
      const result = await init('express-api', 'orders-api', '--dir', 'services/orders');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^Created services[/\\]orders from express-api:/);
      expect(read('services', 'orders', 'package.json')).toBe('{"name": "orders-api"}\n');
      expect(existsSync(join(sandbox.cwd, 'orders-api'))).toBe(false);
    });

    it('writes into --dir . (the current folder) when it is empty', async () => {
      const result = await init('express-api', 'orders-api', '--dir', '.');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^Created \. from express-api:/);
      expect(read('package.json')).toBe('{"name": "orders-api"}\n');
    });

    it('accepts an absolute --dir', async () => {
      const dir = join(sandbox.project, 'elsewhere');
      await expect(init('express-api', 'orders-api', '--dir', dir)).resolves.toMatchObject({ exitCode: 0 });
      expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe('{"name": "orders-api"}\n');
    });

    it('writes into an empty existing folder', async () => {
      mkdirSync(join(sandbox.cwd, 'orders-api'));
      await expect(init('express-api', 'orders-api')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('orders-api', 'package.json')).toBe('{"name": "orders-api"}\n');
    });

    it('takes a required variable', async () => {
      await expect(init('consumer', 'orders-consumer', 'source=orders')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('orders-consumer', 'src', 'index.ts')).toBe('export const SOURCE = "orders";\n');
    });

    it('renders an optional variable with no default as empty', async () => {
      await expect(init('plain', 'p')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('p', 'NOTE.md')).toBe('note: \n');
    });

    it('prints JSON with --format json', async () => {
      const result = await init('express-api', 'orders-api', '--format', 'json');

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        template: 'express-api',
        dir: join(sandbox.cwd, 'orders-api'),
        dryRun: false,
        files: [
          { path: 'package.json', rendered: true },
          { path: 'src/OrdersApiServer.ts', rendered: true },
          { path: 'tsconfig.json', rendered: false },
        ],
      });
    });
  });

  describe('--dry-run', () => {
    it('prints the files without writing anything', async () => {
      const result = await init('express-api', 'orders-api', '--dry-run');

      expect(result).toEqual({
        exitCode: 0,
        stderr: '',
        stdout:
          'Would create orders-api from express-api:\n' +
          '  package.json  (rendered)\n' +
          '  src/OrdersApiServer.ts  (rendered)\n' +
          '  tsconfig.json\n',
      });
      expect(existsSync(join(sandbox.cwd, 'orders-api'))).toBe(false);
    });

    it('prints JSON with dryRun set', async () => {
      const result = await init('express-api', 'orders-api', '--dry-run', '-f', 'json');
      expect(JSON.parse(result.stdout)).toMatchObject({ dryRun: true });
      expect(existsSync(join(sandbox.cwd, 'orders-api'))).toBe(false);
    });

    it('still fails on a folder that is not empty', async () => {
      mkdirSync(join(sandbox.cwd, 'orders-api'));
      writeFileSync(join(sandbox.cwd, 'orders-api', 'x'), '');

      const result = await init('express-api', 'orders-api', '--dry-run');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('is not empty; pass --force');
    });

    it('still fails on a missing required variable', async () => {
      const result = await init('consumer', 'c', '--dry-run');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Template 'consumer' requires source=<value>");
    });
  });

  describe('--force', () => {
    it('writes into a folder that is not empty, keeping other files', async () => {
      mkdirSync(join(sandbox.cwd, 'orders-api'));
      writeFileSync(join(sandbox.cwd, 'orders-api', 'package.json'), 'old');
      writeFileSync(join(sandbox.cwd, 'orders-api', 'keep.txt'), 'keep');

      await expect(init('express-api', 'orders-api', '--force')).resolves.toMatchObject({ exitCode: 0 });
      expect(read('orders-api', 'package.json')).toBe('{"name": "orders-api"}\n');
      expect(read('orders-api', 'keep.txt')).toBe('keep');
    });
  });

  describe('errors', () => {
    it('fails on an unknown template, listing the available ones', async () => {
      const result = await init('nope', 'x');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error: Unknown template 'nope'. Available: consumer, express-api, plain\n");
    });

    it('fails without a project name', async () => {
      const result = await init('express-api');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('error: Missing project name: agent-engineer init express-api <name>\n');
    });

    it('fails on an invalid project name', async () => {
      const result = await init('express-api', '../escape');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid project name '../escape'");
      expect(existsSync(join(sandbox.project, 'escape'))).toBe(false);
    });

    it('fails on a missing required variable', async () => {
      const result = await init('consumer', 'c');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe(
        "error: Template 'consumer' requires source=<value> (Where messages come from)\n",
      );
      expect(existsSync(join(sandbox.cwd, 'c'))).toBe(false);
    });

    it('fails on a variable the template does not declare', async () => {
      const result = await init('express-api', 'orders-api', 'prot=8080');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error: Template 'express-api' has no variable 'prot' (declared: port)\n");
    });

    it('fails on an argument that is not key=value', async () => {
      const result = await init('express-api', 'orders-api', '8080');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error: Expected key=value, got '8080'\n");
    });

    it('fails on a folder that is not empty and leaves it untouched', async () => {
      mkdirSync(join(sandbox.cwd, 'orders-api'));
      writeFileSync(join(sandbox.cwd, 'orders-api', 'keep.txt'), 'keep');

      const result = await init('express-api', 'orders-api');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('is not empty; pass --force to write into it anyway');
      expect(readdirSync(join(sandbox.cwd, 'orders-api'))).toEqual(['keep.txt']);
    });

    it('writes nothing when a .tmpl file uses an unknown variable', async () => {
      writeTemplate(fixtures.root, 'typo', {
        manifest: manifest('typo'),
        files: { 'a.txt.tmpl': '{{name}}', 'b.txt.tmpl': '{{nmae}}' },
      });

      const result = await init('typo', 't');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error: Unknown variable '{{nmae}}' in b.txt.tmpl\n");
      expect(existsSync(join(sandbox.cwd, 't'))).toBe(false);
    });
  });
});
