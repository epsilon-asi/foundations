import path from 'node:path';

import { z } from 'zod';

import { omitUndefined } from '../../../shared/objects.js';
import { parseWithSchema, readJsonFile } from '../../filesystem/configReaders.js';
import type { NodePackageManifest, NodeVersionSnapshot } from './nodeTypescript.contracts.js';

const EMPTY_STRING_MAP: Readonly<Record<string, string>> = Object.freeze({});

const stringMapSchema = z.record(z.string(), z.string());

const packageManifestSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    type: z.string().optional(),
    packageManager: z.string().optional(),
    scripts: stringMapSchema.optional(),
    dependencies: stringMapSchema.optional(),
    devDependencies: stringMapSchema.optional(),
    peerDependencies: stringMapSchema.optional(),
    optionalDependencies: stringMapSchema.optional(),
    engines: stringMapSchema.optional(),
    workspaces: z
      .union([z.array(z.string()), z.object({ packages: z.array(z.string()).optional() }).transform(omitUndefined)])
      .optional(),
  })
  .transform(omitUndefined);

/** Reads and validates `<repoPath>/package.json`. */
export async function readPackageManifest(repoPath: string): Promise<NodePackageManifest> {
  const filePath = path.join(repoPath, 'package.json');
  return parseWithSchema(packageManifestSchema, await readJsonFile(filePath), filePath);
}

export function extractVersionSnapshot(manifest: NodePackageManifest): NodeVersionSnapshot {
  return {
    name: manifest.name ?? null,
    version: manifest.version ?? null,
    packageManager: manifest.packageManager ?? null,
    engines: manifest.engines ?? EMPTY_STRING_MAP,
    dependencies: manifest.dependencies ?? EMPTY_STRING_MAP,
    devDependencies: manifest.devDependencies ?? EMPTY_STRING_MAP,
    peerDependencies: manifest.peerDependencies ?? EMPTY_STRING_MAP,
    optionalDependencies: manifest.optionalDependencies ?? EMPTY_STRING_MAP,
  };
}

export function getScriptDefinitions(manifest: NodePackageManifest): Readonly<Record<string, string>> {
  return manifest.scripts ?? EMPTY_STRING_MAP;
}

/** The exact declared version range of `packageName`, searching every dependency bucket in npm's precedence order. */
export function getDeclaredDependencyVersion(manifest: NodePackageManifest, packageName: string): string | null {
  const name = packageName.trim();
  const buckets = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];
  for (const bucket of buckets) {
    const version = bucket?.[name];
    if (version !== undefined) {
      return version;
    }
  }
  return null;
}
