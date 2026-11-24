import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    markdown: 'src/components/Markdown/index.ts',
    code: 'src/components/CodeBlock/index.ts',
    diff: 'src/components/DiffView/index.ts',
    theme: 'src/theme/index.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  external: [
    'react',
    'react-dom',
    '@emotion/react',
    '@emotion/styled',
    '@mui/material',
    '@mui/material/styles',
    '@mui/x-date-pickers',
    '@mui/system',
    'dayjs'
  ],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js'
    };
  }
});
