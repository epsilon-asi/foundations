import { z } from 'zod';

import { omitUndefined } from '../../../shared/objects.js';
import { parseWithSchema, readTomlFile } from '../../filesystem/configReaders.js';
import type { PythonProjectManifest, PythonVersionSnapshot } from './python.contracts.js';

const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);
const EMPTY_STRING_MAP: Readonly<Record<string, string>> = Object.freeze({});
const EMPTY_GROUPS: Readonly<Record<string, readonly string[]>> = Object.freeze({});

const stringArraySchema = z.array(z.string());
const stringMapSchema = z.record(z.string(), z.string());

const dependencyGroupsSchema = z
  .record(z.string(), z.array(z.union([z.string(), z.object({ 'include-group': z.string() })])))
  .transform((groups) =>
    Object.fromEntries(
      Object.entries(groups).map(([name, entries]) => [
        name,
        entries.filter((entry): entry is string => typeof entry === 'string'),
      ]),
    ),
  );

const pyprojectSchema = z
  .looseObject({
    project: z
      .looseObject({
        name: z.string().optional(),
        version: z.string().optional(),
        'requires-python': z.string().optional(),
        dependencies: stringArraySchema.optional(),
        'optional-dependencies': z.record(z.string(), stringArraySchema).optional(),
        scripts: stringMapSchema.optional(),
        'gui-scripts': stringMapSchema.optional(),
      })
      .transform((project) =>
        omitUndefined({
          name: project.name,
          version: project.version,
          requiresPython: project['requires-python'],
          dependencies: project.dependencies,
          optionalDependencies: project['optional-dependencies'],
          scripts: project.scripts,
          guiScripts: project['gui-scripts'],
        }),
      )
      .optional(),
    'dependency-groups': dependencyGroupsSchema.optional(),
    'build-system': z
      .looseObject({ requires: stringArraySchema.optional(), 'build-backend': z.string().optional() })
      .transform((buildSystem) =>
        omitUndefined({ requires: buildSystem.requires, buildBackend: buildSystem['build-backend'] }),
      )
      .optional(),
    tool: z
      .looseObject({ uv: z.looseObject({ package: z.boolean().optional() }).transform(omitUndefined).optional() })
      .transform(omitUndefined)
      .optional(),
  })
  .transform((pyproject): PythonProjectManifest =>
    omitUndefined({
      project: pyproject.project,
      dependencyGroups: pyproject['dependency-groups'],
      buildSystem: pyproject['build-system'],
      tool: pyproject.tool,
    }),
  );

/** Reads and validates a `pyproject.toml` file. */
export async function readPyprojectToml(filePath: string): Promise<PythonProjectManifest> {
  return parseWithSchema(pyprojectSchema, await readTomlFile(filePath), filePath);
}

export function extractVersionSnapshot(manifest: PythonProjectManifest): PythonVersionSnapshot {
  return {
    name: manifest.project?.name ?? null,
    version: manifest.project?.version ?? null,
    requiresPython: manifest.project?.requiresPython ?? null,
    dependencies: manifest.project?.dependencies ?? EMPTY_STRING_ARRAY,
    optionalDependencies: manifest.project?.optionalDependencies ?? EMPTY_GROUPS,
    dependencyGroups: manifest.dependencyGroups ?? EMPTY_GROUPS,
    buildBackend: manifest.buildSystem?.buildBackend ?? null,
    buildRequirements: manifest.buildSystem?.requires ?? EMPTY_STRING_ARRAY,
  };
}

export function getPythonScriptDefinitions(manifest: PythonProjectManifest): Readonly<Record<string, string>> {
  return manifest.project?.scripts ?? EMPTY_STRING_MAP;
}

/** PEP 503 normalized distribution name. */
function normalizeDistributionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_.]+/g, '-');
}

function extractDependencyName(specifier: string): string | null {
  const name = /^\s*([A-Za-z0-9_.-]+)/.exec(specifier)?.[1];
  return name === undefined ? null : normalizeDistributionName(name);
}

/** Whether `packageName` appears in project, optional, dependency-group, or build-system requirements. */
export function hasDeclaredDependency(manifest: PythonProjectManifest, packageName: string): boolean {
  const normalized = normalizeDistributionName(packageName);
  const specifiers = [
    ...(manifest.project?.dependencies ?? EMPTY_STRING_ARRAY),
    ...Object.values(manifest.project?.optionalDependencies ?? EMPTY_GROUPS).flat(),
    ...Object.values(manifest.dependencyGroups ?? EMPTY_GROUPS).flat(),
    ...(manifest.buildSystem?.requires ?? EMPTY_STRING_ARRAY),
  ];
  return specifiers.some((specifier) => extractDependencyName(specifier) === normalized);
}

/** Whether the manifest opts into uv (`[tool.uv]` or the `uv_build` backend). */
export function hasUvConfiguration(manifest: PythonProjectManifest): boolean {
  return manifest.tool?.uv !== undefined || manifest.buildSystem?.buildBackend === 'uv_build';
}

/** Whether uv builds and installs the project itself, which also makes `[project.scripts]` runnable. */
export function isBuildableProject(manifest: PythonProjectManifest): boolean {
  return manifest.buildSystem !== undefined || manifest.tool?.uv?.package === true;
}
