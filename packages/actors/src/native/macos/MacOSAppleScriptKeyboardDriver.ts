import type { NativeKeyboardDriver } from '../drivers.js';
import { appleScriptString } from '../utils/appleScriptEscape.js';
import { MacOSAppleScriptClient } from './MacOSAppleScriptClient.js';

const MODIFIERS: Record<string, string> = {
  meta: 'command down',
  command: 'command down',
  cmd: 'command down',
  control: 'control down',
  ctrl: 'control down',
  shift: 'shift down',
  alt: 'option down',
  option: 'option down'
};

const KEY_CODES: Record<string, number> = {
  enter: 36,
  return: 36,
  tab: 48,
  space: 49,
  backspace: 51,
  delete: 51,
  forwarddelete: 117,
  escape: 53,
  esc: 53,
  left: 123,
  arrowleft: 123,
  right: 124,
  arrowright: 124,
  down: 125,
  arrowdown: 125,
  up: 126,
  arrowup: 126,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121
};

/**
 * Drives the keyboard through macOS System Events. Requires the running process
 * to have Accessibility permission in System Settings.
 */
export class MacOSAppleScriptKeyboardDriver implements NativeKeyboardDriver {
  constructor(private readonly client: MacOSAppleScriptClient) {}

  async type(text: string, options: { delayMs?: number } = {}): Promise<void> {
    if (text.length === 0) return;
    if (options.delayMs === undefined || options.delayMs <= 0) {
      await this.run(`keystroke ${appleScriptString(text)}`);
      return;
    }
    const delaySeconds = (options.delayMs / 1000).toFixed(3);
    const lines = Array.from(text).map(char => `keystroke ${appleScriptString(char)}\n  delay ${delaySeconds}`);
    await this.run(lines.join('\n  '));
  }

  async pressKey(key: string): Promise<void> {
    await this.run(this.keyCommand(key, []));
  }

  async pressShortcut(keys: readonly string[]): Promise<void> {
    const modifiers: string[] = [];
    let mainKey: string | undefined;
    for (const key of keys) {
      const modifier = MODIFIERS[key.toLowerCase()];
      if (modifier !== undefined) {
        modifiers.push(modifier);
      } else {
        mainKey = key;
      }
    }
    if (mainKey === undefined) {
      throw new Error(`Native keyboard shortcut needs at least one non-modifier key: ${keys.join('+')}`);
    }
    await this.run(this.keyCommand(mainKey, modifiers));
  }

  private keyCommand(key: string, modifiers: readonly string[]): string {
    const using = modifiers.length === 0 ? '' : ` using {${modifiers.join(', ')}}`;
    const code = KEY_CODES[key.toLowerCase()];
    if (code !== undefined) return `key code ${code}${using}`;
    if (Array.from(key).length !== 1) {
      throw new Error(`Unsupported native key: ${key}`);
    }
    const char = modifiers.length === 0 ? key : key.toLowerCase();
    return `keystroke ${appleScriptString(char)}${using}`;
  }

  private async run(body: string): Promise<void> {
    await this.client.execute(`tell application "System Events"\n  ${body}\nend tell`);
  }
}
