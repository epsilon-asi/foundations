
# `@your-scope/mui7-react19-ui`

A publish-ready component library starter for React 19 and Material UI 7 with:

- TypeScript-first component APIs
- Storybook for docs and isolated development
- Dual ESM + CJS package output
- Declaration files for downstream consumers
- Peer dependency boundaries for React, MUI, and Emotion
- Vitest + Testing Library
- GitHub Actions CI and npm trusted-publishing workflow

## What is in here

- `UiProvider` and `createUiTheme()` for app-level theming
- `ActionButton` for common CTA/loading interactions
- `StatCard` for dashboard metrics
- `EmptyState` for empty/error/no-data experiences
- `PageSection` for consistent page-level layout blocks

## Quick start

```bash
npm install
npm run storybook
```

Build the package:

```bash
npm run build
```

Type-check:

```bash
npm run typecheck
```

Run tests once:

```bash
npm run test:run
```

Create a local publish tarball preview:

```bash
npm run pack:check
```

## Consumer installation

In a downstream UI app, install the library and its peers if they are not already present:

```bash
npm install @your-scope/mui7-react19-ui react react-dom @mui/material @emotion/react @emotion/styled
```

## Usage

```tsx
import {
  ActionButton,
  EmptyState,
  PageSection,
  StatCard,
  UiProvider,
  createUiTheme
} from '@your-scope/mui7-react19-ui';

const theme = createUiTheme({
  palette: {
    primary: {
      main: '#0f766e'
    }
  }
});

export function App() {
  return (
    <UiProvider theme={theme}>
      <PageSection
        title="Overview"
        subtitle="A starter library you can use downstream."
        action={<ActionButton size="small">Create report</ActionButton>}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <StatCard
            title="Monthly revenue"
            value="$128,400"
            trendLabel="+12.4%"
            description="Compared to the previous 30 days"
          />

          <EmptyState
            title="No invoices yet"
            description="Create your first invoice to see recent activity here."
            action={<ActionButton>New invoice</ActionButton>}
          />
        </div>
      </PageSection>
    </UiProvider>
  );
}
```

## Package structure

```text
src/
  components/
    ActionButton/
    EmptyState/
    PageSection/
    StatCard/
  theme/
  test/
  index.ts
.storybook/
.github/workflows/
```

## Publishing

### First publish from your machine

1. Change the package name in `package.json` from `@your-scope/mui7-react19-ui` to your real npm scope/package.
2. Run:
   ```bash
   npm login
   npm publish --access public
   ```

### Recommended CI publish flow

This starter includes `.github/workflows/release.yml` for npm trusted publishing from GitHub Actions.

Before using it:

1. Rename the package in `package.json`.
2. Push the repository to GitHub.
3. In npm package settings, configure this repository/workflow as a **Trusted Publisher**.
4. Create and push a semver tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The workflow will install dependencies, run type-checking and tests, build the package, and publish to npm with provenance enabled.

## Storybook

Start Storybook locally:

```bash
npm run storybook
```

Create a static build:

```bash
npm run build-storybook
```

You can deploy `storybook-static/` to any static host.

## Notes for downstream apps

- The library treats `react`, `react-dom`, `@mui/material`, `@emotion/react`, and `@emotion/styled` as peer dependencies so your consuming apps own those versions.
- The package exports both ESM and CJS entry points and ships `.d.ts` files.
- If a downstream app uses Next.js SSR/App Router, keep following MUI’s official integration guidance in that app for cache/SSR setup.

## Rename checklist

Before publishing for real, update:

- `name` in `package.json`
- README package name and install command
- repository metadata if you want to add it
- npm trusted publisher settings





