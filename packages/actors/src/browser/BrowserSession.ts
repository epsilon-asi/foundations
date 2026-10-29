import type { BrowserRuntimeConfig } from './RuntimeConfig.js';
import type { BrowserContextLike, BrowserLike, PageLike } from './PuppeteerLike.js';

export type BrowserSessionKind = 'launched' | 'connected';

export class BrowserSession {
  readonly connectionMode: BrowserSessionKind;

  constructor(
    readonly browser: BrowserLike,
    readonly context: BrowserContextLike,
    readonly page: PageLike,
    readonly profile: BrowserRuntimeConfig,
    readonly kind: BrowserSessionKind = profile.mode === 'remote-debugging' ? 'connected' : 'launched'
  ) {
    this.connectionMode = kind;
  }

  shouldCloseOnFinish(): boolean {
    if (this.kind === 'connected' && this.profile.mode === 'remote-debugging') {
      return this.profile.closeBrowserOnFinish === true || this.profile.disconnectOnFinish !== false;
    }

    // In launched mode, closeBrowserOnFinish=false means "detach but keep Chrome running".
    return true;
  }

  async close(): Promise<void> {
    if (this.kind === 'connected') {
      if (this.profile.mode === 'remote-debugging' && this.profile.closeBrowserOnFinish === true && this.profile.disconnectOnFinish === false) {
        await this.browser.close();
        return;
      }

      if (this.profile.mode === 'remote-debugging' && this.profile.disconnectOnFinish === false) {
        return;
      }

      await this.browser.disconnect?.();
      return;
    }

    if (this.profile.closeBrowserOnFinish === false) {
      await this.browser.disconnect?.();
      return;
    }

    await this.browser.close();
  }
}
