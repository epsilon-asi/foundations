import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  extractRequiredVersion,
  findRequiredVersion,
  listTerraformFiles,
} from '../../../src/repo-runner/runners/terraform/terraformConfigReader.js';
import { makeTempDir } from '../helpers/testUtils.js';

describe('terraformConfigReader', () => {
  it('extracts the required_version constraint', () => {
    expect(extractRequiredVersion('terraform {\n  required_version = ">= 1.6.0, < 2.0"\n}\n')).toBe('>= 1.6.0, < 2.0');
    expect(extractRequiredVersion('terraform {\n  # required_version = "1.0"\n}\n')).toBeNull();
    expect(extractRequiredVersion('variable "x" {}\n')).toBeNull();
  });

  it('lists only root-level *.tf files, sorted', async () => {
    const dir = await makeTempDir('tf');
    await mkdir(path.join(dir, 'modules.tf'));
    await mkdir(path.join(dir, 'nested'));
    await Promise.all(
      ['versions.tf', 'main.tf', 'main.tf.json', 'README.md', 'nested/inner.tf'].map((file) =>
        writeFile(path.join(dir, file), '', 'utf8'),
      ),
    );

    await expect(listTerraformFiles(dir)).resolves.toEqual(['main.tf', 'versions.tf']);
    await expect(listTerraformFiles(path.join(dir, 'missing'))).resolves.toEqual([]);
  });

  it('finds the first required_version across files', async () => {
    const dir = await makeTempDir('tf-version');
    await writeFile(path.join(dir, 'a.tf'), 'variable "x" {}\n', 'utf8');
    await writeFile(path.join(dir, 'b.tf'), 'terraform {\n  required_version = "~> 1.9"\n}\n', 'utf8');

    await expect(findRequiredVersion(dir, ['a.tf', 'b.tf'])).resolves.toBe('~> 1.9');
    await expect(findRequiredVersion(dir, ['a.tf'])).resolves.toBeNull();
  });
});
