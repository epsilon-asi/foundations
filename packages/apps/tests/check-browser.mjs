import assert from 'node:assert/strict';
import { checkBrowserBundle } from '../../../scripts/testing/browser-bundle.mjs';

await checkBrowserBundle(new URL('./browser/common.ts', import.meta.url));
await assert.rejects(
  checkBrowserBundle(new URL('./browser/node-only.mjs', import.meta.url)),
  /Forbidden browser import "node:fs"/,
);
