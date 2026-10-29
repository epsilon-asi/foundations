import type { NativeKeyboardDriver } from '../drivers.js';
import { loadNut } from './loadNut.js';

function keyName(key: string): string {
  const normalized = key.toLowerCase();
  if (normalized === 'enter' || normalized === 'return') return 'ENTER';
  if (normalized === 'escape' || normalized === 'esc') return 'ESCAPE';
  if (normalized === 'meta' || normalized === 'command' || normalized === 'cmd') return 'LEFT_META';
  if (normalized === 'control' || normalized === 'ctrl') return 'LEFT_CONTROL';
  if (normalized === 'shift') return 'LEFT_SHIFT';
  if (normalized === 'alt' || normalized === 'option') return 'LEFT_ALT';
  return key.toUpperCase();
}

export class NutNativeKeyboardDriver implements NativeKeyboardDriver {
  async type(text: string): Promise<void> {
    const nut = await loadNut();
    await nut.keyboard.type(text);
  }

  async pressKey(key: string): Promise<void> {
    const nut = await loadNut();
    await nut.keyboard.pressKey(this.resolveKey(nut.Key, key));
  }

  async pressShortcut(keys: readonly string[]): Promise<void> {
    const nut = await loadNut();
    const resolved = keys.map(key => this.resolveKey(nut.Key, key));
    await nut.keyboard.pressKey(...resolved);
    if (nut.keyboard.releaseKey !== undefined) {
      await nut.keyboard.releaseKey(...resolved.slice().reverse());
    }
  }

  private resolveKey(keyMap: Record<string, unknown> | undefined, key: string): unknown {
    return keyMap?.[keyName(key)] ?? key;
  }
}
