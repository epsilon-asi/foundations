import type { NativeKeyboardDriver } from './drivers.js';
import type { NativeKeyboard, NativeKeyboardTypeOptions } from './types.js';

export class DefaultNativeKeyboard implements NativeKeyboard {
  constructor(private readonly driver: NativeKeyboardDriver) {}

  async type(text: string, options: NativeKeyboardTypeOptions = {}): Promise<void> {
    await this.driver.type(text, options.delayMs === undefined ? undefined : { delayMs: options.delayMs });
  }

  async pressKey(key: string): Promise<void> {
    await this.driver.pressKey(key);
  }

  async pressShortcut(keys: readonly string[]): Promise<void> {
    await this.driver.pressShortcut(keys);
  }
}
