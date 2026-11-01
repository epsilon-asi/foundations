import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { RepoConfigParseError } from '../../../src/repo-runner/errors/repoRunnerErrors.js';
import {
  extractVersionSnapshot,
  getDeclaredDependencyVersion,
  getScriptDefinitions,
  readPackageManifest,
} from '../../../src/repo-runner/runners/node-typescript/packageJsonReader.js';
import { fixturePath, makeTempDir } from '../helpers/testUtils.js';

async function repoWithManifest(manifest: unknown): Promise<string> {
  const repoPath = await makeTempDir('pkg');
  const text = typeof manifest === 'string' ? manifest : JSON.stringify(manifest);
  await writeFile(path.join(repoPath, 'package.json'), text, 'utf8');
  return repoPath;
}

describe('packageJsonReader', () => {
  it('reads a valid package.json into NodePackageManifest', async () => {
    const manifest = await readPackageManifest(fixturePath('node-basic'));

    expect(manifest.name).toBe('node-basic-fixture');
    expect(manifest.scripts?.build).toBe('node scripts/build.js');
  });

  it('keeps only the known fields and omits absent ones', async () => {
    const manifest = await readPackageManifest(
      await repoWithManifest({ name: 'x', description: 'dropped', bin: { x: 'cli.js' } }),
    );

    expect(manifest).toEqual({ name: 'x' });
  });

  it('returns an empty scripts object when scripts is absent', async () => {
    const manifest = await readPackageManifest(await repoWithManifest({ name: 'no-scripts', version: '1.0.0' }));

    expect(getScriptDefinitions(manifest)).toEqual({});
  });

  it('extracts dependency versions across all buckets', async () => {
    const manifest = await readPackageManifest(fixturePath('node-basic'));
    const versions = extractVersionSnapshot(manifest);

    expect(getDeclaredDependencyVersion(manifest, 'left-pad')).toBe('1.3.0');
    expect(getDeclaredDependencyVersion(manifest, ' typescript ')).toBe('^5.6.3');
    expect(getDeclaredDependencyVersion(manifest, 'react')).toBe('^18.3.0');
    expect(getDeclaredDependencyVersion(manifest, 'fsevents')).toBe('^2.3.3');
    expect(getDeclaredDependencyVersion(manifest, 'missing')).toBeNull();
    expect(versions).toMatchObject({
      name: 'node-basic-fixture',
      version: '1.0.0',
      packageManager: 'npm@10.8.2',
      engines: { node: '>=20' },
    });
  });

  it('fills an empty version snapshot for a minimal manifest', () => {
    expect(extractVersionSnapshot({})).toEqual({
      name: null,
      version: null,
      packageManager: null,
      engines: {},
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    });
  });

  it('preserves exact version strings and object-form workspaces', async () => {
    const manifest = await readPackageManifest(
      await repoWithManifest({
        name: 'workspace-example',
        dependencies: { example: 'workspace:*' },
        workspaces: { packages: ['packages/*'], nohoist: ['**/x'] },
      }),
    );

    expect(getDeclaredDependencyVersion(manifest, 'example')).toBe('workspace:*');
    expect(manifest.workspaces).toEqual({ packages: ['packages/*'] });
  });

  it('supports workspace arrays', async () => {
    const manifest = await readPackageManifest(
      await repoWithManifest({ name: 'workspace-array', workspaces: ['packages/*'] }),
    );

    expect(manifest.workspaces).toEqual(['packages/*']);
  });

  it('normalizes workspace objects without packages to an empty object', async () => {
    const manifest = await readPackageManifest(
      await repoWithManifest({ name: 'workspace-empty', workspaces: { nohoist: ['**/*'] } }),
    );

    expect(manifest.workspaces).toEqual({});
  });

  it('throws RepoConfigParseError naming the invalid field', async () => {
    const repoPath = await repoWithManifest({ name: 'bad-shape', scripts: { test: 1 } });

    await expect(readPackageManifest(repoPath)).rejects.toBeInstanceOf(RepoConfigParseError);
    await expect(readPackageManifest(repoPath)).rejects.toThrow(/scripts\.test: /);
  });

  it('throws RepoConfigParseError on invalid JSON', async () => {
    await expect(readPackageManifest(await repoWithManifest('{ invalid json'))).rejects.toBeInstanceOf(
      RepoConfigParseError,
    );
  });
});
