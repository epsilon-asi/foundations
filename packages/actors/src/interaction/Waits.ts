import type { PageAdapter } from './PageAdapter.js';

export async function waitUntilVisible(page: PageAdapter, selector: string, timeoutMs = 15_000): Promise<void> {
  await page.waitFor(selector, { timeout: timeoutMs, visible: true });
}
