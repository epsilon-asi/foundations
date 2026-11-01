import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RepoConfigParseError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import {
  extractVersionSnapshot,
  getPythonScriptDefinitions,
  hasDeclaredDependency,
  hasUvConfiguration,
  isBuildableProject,
  readPyprojectToml,
} from '../../../src/repo-runner/runners/python/pyprojectTomlReader.js';
import { fixturePath, makeTempDir } from '../helpers/testUtils.js';

async function writePyproject(content: string): Promise<string> {
  const filePath = path.join(await makeTempDir('pyproject'), 'pyproject.toml');
  await writeFile(filePath, content, 'utf8');
  return filePath;
}

const fixturePyproject = (name: string): string => path.join(fixturePath(name), 'pyproject.toml');

describe('pyprojectTomlReader', () => {
  it('parses a uv pyproject into camelCase manifest fields', async () => {
    const manifest = await readPyprojectToml(fixturePyproject('python-uv-basic'));

    expect(manifest).toEqual({
      project: {
        name: 'python-uv-basic-fixture',
        version: '0.1.0',
        requiresPython: '>=3.11',
        dependencies: ['requests>=2.32.0'],
        optionalDependencies: { cli: ['rich>=13.7.0'] },
        scripts: { hello: 'example:main' },
      },
      dependencyGroups: { dev: ['pytest>=8.0.0', 'ruff>=0.6.0', 'mypy>=1.11.0'] },
      buildSystem: { requires: ['setuptools>=69.0.0'], buildBackend: 'setuptools.build_meta' },
      tool: { uv: { package: true } },
    });
    expect(getPythonScriptDefinitions(manifest)).toEqual({ hello: 'example:main' });
  });

  it('extracts a version snapshot with empty defaults', async () => {
    const snapshot = extractVersionSnapshot(await readPyprojectToml(fixturePyproject('python-uv-basic')));

    expect(snapshot).toMatchObject({
      name: 'python-uv-basic-fixture',
      requiresPython: '>=3.11',
      buildBackend: 'setuptools.build_meta',
      buildRequirements: ['setuptools>=69.0.0'],
    });
    expect(extractVersionSnapshot({})).toEqual({
      name: null,
      version: null,
      requiresPython: null,
      dependencies: [],
      optionalDependencies: {},
      dependencyGroups: {},
      buildBackend: null,
      buildRequirements: [],
    });
    expect(getPythonScriptDefinitions({})).toEqual({});
  });

  it('detects dependencies across project, optional groups, dependency groups, and build-system', async () => {
    const manifest = await readPyprojectToml(fixturePyproject('python-uv-basic'));

    expect(hasDeclaredDependency(manifest, 'requests')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'rich')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'ruff')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'pytest')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'setuptools')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'does-not-exist')).toBe(false);
    expect(hasUvConfiguration(manifest)).toBe(true);
    expect(isBuildableProject(manifest)).toBe(true);
  });

  it('compares dependency names using PEP 503 normalization', async () => {
    const manifest = await readPyprojectToml(
      await writePyproject('[project]\nname = "x"\ndependencies = ["Zope.Interface>=5", "typing_extensions"]\n'),
    );

    expect(hasDeclaredDependency(manifest, 'zope-interface')).toBe(true);
    expect(hasDeclaredDependency(manifest, 'Typing-Extensions')).toBe(true);
  });

  it('reports non-buildable uv projects correctly', async () => {
    const manifest = await readPyprojectToml(fixturePyproject('python-uv-no-build'));

    expect(hasUvConfiguration(manifest)).toBe(true);
    expect(isBuildableProject(manifest)).toBe(false);
  });

  it('recognises non-uv projects', async () => {
    const manifest = await readPyprojectToml(fixturePyproject('python-non-uv'));

    expect(hasUvConfiguration(manifest)).toBe(false);
    expect(isBuildableProject(manifest)).toBe(true);
  });

  it('supports uv_build backends and ignores malformed dependency specifiers', async () => {
    const manifest = await readPyprojectToml(
      await writePyproject(
        '[project]\nname = "uv-build-only"\ndependencies = [" ; invalid"]\n\n[build-system]\nrequires = ["hatchling>=1"]\nbuild-backend = "uv_build"\n',
      ),
    );

    expect(hasUvConfiguration(manifest)).toBe(true);
    expect(hasDeclaredDependency(manifest, 'invalid')).toBe(false);
  });

  it('accepts PEP 735 include-group entries and keeps only requirement strings', async () => {
    const manifest = await readPyprojectToml(
      await writePyproject(
        '[dependency-groups]\ntest = ["pytest"]\ndev = [{ include-group = "test" }, "ruff"]\n\n[tool.uv]\n',
      ),
    );

    expect(manifest.dependencyGroups).toEqual({ test: ['pytest'], dev: ['ruff'] });
    expect(manifest.tool).toEqual({ uv: {} });
  });

  it('keeps unrelated tool tables', async () => {
    const manifest = await readPyprojectToml(
      await writePyproject('[tool.ruff]\nline-length = 100\n\n[tool.uv]\npackage = false\ndev-dependencies = []\n'),
    );

    expect(manifest.tool).toEqual({ ruff: { 'line-length': 100 }, uv: { package: false, 'dev-dependencies': [] } });
  });

  it('throws RepoConfigParseError when tool.uv is not a table', async () => {
    const filePath = await writePyproject('[tool]\nuv = "bad"\n');

    await expect(readPyprojectToml(filePath)).rejects.toBeInstanceOf(RepoConfigParseError);
    await expect(readPyprojectToml(filePath)).rejects.toThrow(/tool\.uv: /);
  });

  it('throws RepoConfigParseError on invalid toml content', async () => {
    await expect(readPyprojectToml(await writePyproject('not = [valid'))).rejects.toBeInstanceOf(RepoConfigParseError);
  });

  it('throws RepoConfigParseError naming the invalid project.scripts entry', async () => {
    const filePath = await writePyproject('[project]\nname = "x"\n[project.scripts]\ncli = 1\n');

    await expect(readPyprojectToml(filePath)).rejects.toThrow(/project\.scripts\.cli: /);
  });
});
