import type { NativeScreenDriver } from '../drivers.js';
import { MacOSAppleScriptClient } from './MacOSAppleScriptClient.js';

/**
 * Reads the main display size from the Finder desktop bounds.
 */
export class MacOSAppleScriptScreenDriver implements NativeScreenDriver {
  private cached: { width: number; height: number } | undefined;

  constructor(private readonly client: MacOSAppleScriptClient) {}

  async width(): Promise<number> {
    return (await this.size()).width;
  }

  async height(): Promise<number> {
    return (await this.size()).height;
  }

  private async size(): Promise<{ width: number; height: number }> {
    if (this.cached !== undefined) return this.cached;
    const output = await this.client.execute('tell application "Finder" to get bounds of window of desktop');
    const parts = output.split(',').map(part => Number(part.trim()));
    const [left, top, right, bottom] = parts;
    if (parts.length !== 4 || left === undefined || top === undefined || right === undefined || bottom === undefined || parts.some(n => !Number.isFinite(n))) {
      throw new Error(`Unexpected desktop bounds from Finder: ${output}`);
    }
    this.cached = { width: right - left, height: bottom - top };
    return this.cached;
  }
}
