import { checkBrowserBundle } from '../../../scripts/testing/browser-bundle.mjs';

await checkBrowserBundle(new URL('./browser/common.ts', import.meta.url));
