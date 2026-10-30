import type { StorybookConfig } from '@storybook/react-vite';

// Storybook lives outside `src/` and is never part of the tsup build or the
// published `dist` — it is a local preview tool for Block Kit layouts only.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  // Registered by its preset entry: listing the bare package name makes
  // Storybook auto-load the addon's `./preview` export on top of the one the
  // preset already adds, which duplicates the import and breaks the build.
  addons: ['@tightknitai/storybook-addon-slack-block-kit/preset'],
  core: {
    disableTelemetry: true
  },
  typescript: {
    // Stories render Block Kit JSON, not documented React components.
    reactDocgen: false
  },
  // Vite finds deps to pre-bundle by crawling the story files, but these
  // stories never import React or the renderer themselves (the addon's
  // decorator does), so the CommonJS ones have to be listed explicitly.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      include: [
        ...(viteConfig.optimizeDeps?.include ?? []),
        'react',
        'react/jsx-runtime',
        'react-dom',
        'slack-blocks-to-jsx',
        '@tightknitai/slack-block-kit-validator'
      ]
    }
  })
};

export default config;
