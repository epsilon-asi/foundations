import type { Logger } from '../logging/Logger.js';
import type { NativeWindowDriver, NativeWindowHandle } from './drivers.js';

export class FallbackNativeWindowDriver implements NativeWindowDriver {
  constructor(
    private readonly primary: NativeWindowDriver,
    private readonly fallback: NativeWindowDriver,
    private readonly logger?: Logger
  ) {}

  async list(): Promise<NativeWindowHandle[]> {
    try {
      return await this.primary.list();
    } catch (error) {
      this.logger?.debug('Primary native window driver failed; using fallback driver.', { error });
      return this.fallback.list();
    }
  }

  async active(): Promise<NativeWindowHandle | null> {
    if (this.primary.active !== undefined) {
      try {
        return await this.primary.active();
      } catch (error) {
        this.logger?.debug('Primary native active-window lookup failed; using fallback driver.', { error });
      }
    }
    return this.fallback.active === undefined ? null : this.fallback.active();
  }
}
