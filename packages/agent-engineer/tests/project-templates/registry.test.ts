import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getTemplate,
  listTemplates,
  loadTemplate,
  TEMPLATES_DIR,
  templateFolders,
} from '../../src/project-templates/registry.js';
import { manifest, useTempDir, writeTemplate } from '../helpers/templateFixtures.js';

const tmp = useTempDir();

describe('TEMPLATES_DIR', () => {
  it('is the package templates/ folder', () => {
    expect(TEMPLATES_DIR).toMatch(/[/\\]agent-engineer[/\\]templates$/);
    expect(existsSync(TEMPLATES_DIR)).toBe(true);
  });
});

describe('loadTemplate', () => {
  it('loads the manifest with its folders', async () => {
    const dir = writeTemplate(tmp.path, 'svc', {
      manifest: manifest('svc', '  port:\n    description: Port\n    default: "3000"\n'),
    });

    await expect(loadTemplate(dir)).resolves.toEqual({
      id: 'svc',
      description: 'The svc template',
      variables: { port: { description: 'Port', required: false, default: '3000' } },
      dir,
      filesDir: join(dir, 'files'),
    });
  });

  it('fails without a template.yaml', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: null });
    await expect(loadTemplate(dir)).rejects.toThrow(`${dir} has no template.yaml`);
  });

  it('fails on a manifest that does not match the schema', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: 'id: svc\n' });
    await expect(loadTemplate(dir)).rejects.toThrow(join(dir, 'template.yaml'));
  });

  it('fails on a manifest that is not valid YAML', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: 'id: [svc\n' });
    await expect(loadTemplate(dir)).rejects.toThrow();
  });

  it('fails when the id is not the folder name', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('other') });
    await expect(loadTemplate(dir)).rejects.toThrow("id 'other' must match its folder name 'svc'");
  });

  it('fails without a files/ folder', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), filesDir: false });
    await expect(loadTemplate(dir)).rejects.toThrow(`${dir} has no files/ folder`);
  });

  it('fails when files is a file, not a folder', async () => {
    const dir = writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), filesDir: false });
    writeFileSync(join(dir, 'files'), 'not a folder');
    await expect(loadTemplate(dir)).rejects.toThrow(`${dir} has no files/ folder`);
  });
});

describe('templateFolders', () => {
  it('lists folders sorted, skipping hidden folders and files', async () => {
    writeTemplate(tmp.path, 'zeta', { manifest: manifest('zeta') });
    writeTemplate(tmp.path, 'alpha', { manifest: manifest('alpha') });
    mkdirSync(join(tmp.path, '.git'));
    writeFileSync(join(tmp.path, 'README.md'), '# templates');

    await expect(templateFolders(tmp.path)).resolves.toEqual(['alpha', 'zeta']);
  });

  it('fails when the root does not exist', async () => {
    await expect(templateFolders(join(tmp.path, 'missing'))).rejects.toThrow();
  });
});

describe('listTemplates', () => {
  it('loads every template sorted by id', async () => {
    writeTemplate(tmp.path, 'producer', { manifest: manifest('producer') });
    writeTemplate(tmp.path, 'consumer', { manifest: manifest('consumer') });

    const templates = await listTemplates(tmp.path);
    expect(templates.map((t) => t.id)).toEqual(['consumer', 'producer']);
  });

  it('is empty for an empty root', async () => {
    await expect(listTemplates(tmp.path)).resolves.toEqual([]);
  });

  it('fails when one template is invalid', async () => {
    writeTemplate(tmp.path, 'good', { manifest: manifest('good') });
    writeTemplate(tmp.path, 'bad', { manifest: manifest('wrong') });

    await expect(listTemplates(tmp.path)).rejects.toThrow("id 'wrong' must match its folder name 'bad'");
  });

  it('lists the built-in templates', async () => {
    const ids = (await listTemplates()).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['consumer', 'express-api', 'producer', 'react-mui']));
  });
});

describe('getTemplate', () => {
  it('returns the template with the id', async () => {
    writeTemplate(tmp.path, 'consumer', { manifest: manifest('consumer') });
    writeTemplate(tmp.path, 'producer', { manifest: manifest('producer') });

    await expect(getTemplate('producer', tmp.path)).resolves.toMatchObject({ id: 'producer' });
  });

  it('lists the available ids for an unknown id', async () => {
    writeTemplate(tmp.path, 'consumer', { manifest: manifest('consumer') });
    writeTemplate(tmp.path, 'producer', { manifest: manifest('producer') });

    await expect(getTemplate('nope', tmp.path)).rejects.toThrow(
      "Unknown template 'nope'. Available: consumer, producer",
    );
  });

  it('says when there are no templates', async () => {
    await expect(getTemplate('nope', tmp.path)).rejects.toThrow("Unknown template 'nope'. Available: (none)");
  });

  it('does not resolve ids outside the root', async () => {
    writeTemplate(tmp.path, 'outside', { manifest: manifest('outside') });
    const root = join(tmp.path, 'root');
    writeTemplate(root, 'inside', { manifest: manifest('inside') });

    await expect(getTemplate('../outside', root)).rejects.toThrow("Unknown template '../outside'");
  });

  it('does not treat a hidden folder as a template', async () => {
    writeTemplate(tmp.path, '.hidden', { manifest: manifest('hidden') });
    await expect(getTemplate('.hidden', tmp.path)).rejects.toThrow("Unknown template '.hidden'");
  });

  it('fails when the requested template is invalid', async () => {
    writeTemplate(tmp.path, 'svc', { manifest: manifest('svc'), filesDir: false });
    await expect(getTemplate('svc', tmp.path)).rejects.toThrow('has no files/ folder');
  });
});
