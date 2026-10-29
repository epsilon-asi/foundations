import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DefaultNativeFileDialogService, type FileDialogAccessibilityStrategy } from '../../../src/native/NativeFileDialogService.js';
import { NativeFileDialogError } from '../../../src/native/errors.js';
import type { NativeKeyboard, SelectFileOptions } from '../../../src/native/types.js';
import { FakeNativeImageFinder, FakeNativeMouse } from '../../fixtures/native/FakeNativeAutomation.js';

class FakeKeyboard implements NativeKeyboard {
  typed: string[] = [];
  pressed: string[] = [];
  shortcuts: Array<readonly string[]> = [];
  async type(text: string): Promise<void> { this.typed.push(text); }
  async pressKey(key: string): Promise<void> { this.pressed.push(key); }
  async pressShortcut(keys: readonly string[]): Promise<void> { this.shortcuts.push([...keys]); }
}

class FakeAccessibility implements FileDialogAccessibilityStrategy {
  calls: Array<{ filePath: string; options: SelectFileOptions }> = [];
  constructor(private readonly error?: Error) {}
  async selectFile(filePath: string, options: SelectFileOptions): Promise<void> {
    this.calls.push({ filePath, options });
    if (this.error !== undefined) throw this.error;
  }
}

async function createTempFile(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paf-dialog-'));
  const filePath = path.join(dir, 'résumé "quoted".pdf');
  await fs.writeFile(filePath, 'test');
  return filePath;
}

describe('DefaultNativeFileDialogService', () => {
  it('validates that the selected file exists', async () => {
    const service = new DefaultNativeFileDialogService({ keyboard: new FakeKeyboard() });

    await expect(service.selectFile('/definitely/missing/file.pdf')).rejects.toBeInstanceOf(NativeFileDialogError);
  });

  it('uses the AppleScript/accessibility strategy first in auto mode', async () => {
    const filePath = await createTempFile();
    const accessibility = new FakeAccessibility();
    const keyboard = new FakeKeyboard();
    const service = new DefaultNativeFileDialogService({ keyboard, accessibility });

    await service.selectFile(filePath, { appName: 'Google Chrome' });

    expect(accessibility.calls).toEqual([{ filePath, options: { appName: 'Google Chrome' } }]);
    expect(keyboard.typed).toEqual([]);
  });

  it('falls back to keyboard selection when accessibility fails in auto mode', async () => {
    const filePath = await createTempFile();
    const keyboard = new FakeKeyboard();
    const service = new DefaultNativeFileDialogService({
      keyboard,
      accessibility: new FakeAccessibility(new Error('permission denied'))
    });

    await service.selectFile(filePath);

    expect(keyboard.shortcuts).toEqual([['Meta', 'Shift', 'G']]);
    expect(keyboard.typed).toEqual([filePath]);
    expect(keyboard.pressed).toEqual(['Enter', 'Enter']);
  });

  it('can click visual templates for input and open button', async () => {
    const filePath = await createTempFile();
    const keyboard = new FakeKeyboard();
    const images = new FakeNativeImageFinder();
    const mouse = new FakeNativeMouse();
    images.matches.set('input.png', { region: { x: 10, y: 20, width: 100, height: 20 } });
    images.matches.set('open.png', { region: { x: 200, y: 300, width: 80, height: 30 } });
    const service = new DefaultNativeFileDialogService({ keyboard, images, mouse });

    await service.selectFile(filePath, {
      strategy: 'visual',
      inputFieldTemplate: 'input.png',
      openButtonTemplate: 'open.png'
    });

    expect(mouse.clicks.map(click => click.point)).toEqual([
      { x: 60, y: 30 },
      { x: 240, y: 315 }
    ]);
    expect(keyboard.typed).toEqual([filePath]);
    expect(keyboard.pressed).toEqual(['Enter']);
  });
});
