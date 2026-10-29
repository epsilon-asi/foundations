# Private publishing

## npm private packages

1. Replace the placeholder scope:

```bash
npm pkg set name=@your-real-org/slack
```

2. Authenticate:

```bash
npm login
```

3. Verify locally:

```bash
npm run verify
npm pack --dry-run
```

4. Publish privately:

```bash
npm publish --access restricted
```

## GitHub Packages

1. Update `package.json` name to your GitHub org scope.
2. Copy `.npmrc.example` to `.npmrc` and set the registry for that scope.
3. Authenticate with `NODE_AUTH_TOKEN`.
4. Publish:

```bash
npm publish
```

## Versioning guidance

Use semantic versioning:

- Patch: bug fixes, docs, tests.
- Minor: new prebuilt components or optional fields.
- Major: breaking type changes, removed exports, changed payload shapes.

## Consumer install

```bash
npm install @your-real-org/slack
```

A consuming service can use the package without `@slack/web-api` if it only builds payloads or uses incoming webhooks. Install `@slack/web-api` in the consuming service only when using Slack Web API delivery.
