export default {
  id: 'public-export',
  description:
    'Update public package exports, barrels, and package export-map entries while preserving ESM, CJS, and type declaration importability.',

  instructions: `
Generate or update public export wiring for this TypeScript library.

Repository-specific rules:
- Inspect package.json, src/index.ts, src/prebuilt/index.ts, src/blocks/index.ts, and the build script before writing.
- Keep public APIs intentional; do not export internals unless the user asks or existing convention clearly exposes the area.
- Preserve package exports for root, ./prebuilt, and ./blocks unless explicitly requested.
- When adding a new package entrypoint, update package.json exports and the tsup build command consistently.
- Keep ESM, CJS, and .d.ts outputs importable from the same public paths.
- Update docs and examples when a public import path changes.
- Add or update tests/examples when export behavior matters.

General safety rules:
- Follow existing repo patterns.
- Use existing imports, naming, function style, and test style.
- Do not invent package entrypoints or public APIs without a user requirement.
- Do not touch generated dist files directly; build output should be produced by npm run build.
- Do not touch unrelated files.
- Do not include secrets.
- Run or describe the relevant typecheck/build command after changes.

Additional user instructions:
{{instructions}}
`.trim(),

  output: {
    pathTemplates: [
      {
        key: 'root-index',
        pathTemplate: 'src/index.ts',
        description: 'Root public export barrel.',
      },
      {
        key: 'prebuilt-index',
        pathTemplate: 'src/prebuilt/index.ts',
        description: 'Prebuilt component export barrel.',
      },
      {
        key: 'blocks-index',
        pathTemplate: 'src/blocks/index.ts',
        description: 'Block helper export barrel.',
      },
      {
        key: 'package-json',
        pathTemplate: 'package.json',
        description: 'Package exports map, files, and build entrypoints.',
      },
      {
        key: 'usage-docs',
        pathTemplate: 'README.md',
        description: 'Import path and package export documentation.',
      },
    ],
    maxFiles: 5,
  },

  parameters: {
    name: {
      description: 'Exported area or entrypoint name, for example prebuilt, blocks, transport, or custom entrypoint name.',
      required: true,
    },
    instructions: {
      description: 'What should be exported, whether it is public or internal, and any import path requirements.',
      required: false,
    },
  },

  examples: [
    'src/index.ts',
    'src/prebuilt/index.ts',
    'src/blocks/index.ts',
    'package.json',
    'README.md',
  ],

  context: [
    {
      kind: 'path',
      path: 'package.json',
      description: 'Package export map, build script, files list, and publishing metadata.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/index.ts',
      description: 'Root public export surface.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/prebuilt/index.ts',
      description: 'Prebuilt export surface.',
      required: false,
    },
    {
      kind: 'path',
      path: 'src/blocks/index.ts',
      description: 'Blocks export surface.',
      required: false,
    },
    {
      kind: 'pattern',
      pattern: 'examples/**/*.ts',
      description: 'Import path usage examples.',
      limit: 6,
    },
    {
      kind: 'path',
      path: 'docs/PUBLISHING.md',
      description: 'Private package publishing guidance.',
      required: false,
    },
  ],

  keywordContexts: [
    {
      keywords: ['esm', 'cjs', 'commonjs', 'module', 'require', 'import'],
      description: 'Dual module output and package importability context.',
      context: [
        {
          kind: 'path',
          path: 'package.json',
          required: false,
        },
        {
          kind: 'path',
          path: 'tsconfig.json',
          required: false,
        },
        {
          kind: 'path',
          path: 'docs/PUBLISHING.md',
          required: false,
        },
      ],
    },
    {
      keywords: ['prebuilt', 'blocks', 'entrypoint', 'subpath'],
      description: 'Current package subpath export conventions.',
      context: [
        {
          kind: 'path',
          path: 'src/prebuilt/index.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'src/blocks/index.ts',
          required: false,
        },
        {
          kind: 'path',
          path: 'package.json',
          required: false,
        },
      ],
    },
  ],

  tooling: {
    allowGetExistingCode: true,
    allowFindFiles: true,
    allowSearchRepo: true,
  },
};
