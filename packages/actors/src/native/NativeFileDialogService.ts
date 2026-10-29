import fs from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '../logging/Logger.js';
import { NativeFileDialogError } from './errors.js';
import type { NativeImageFinder, NativeKeyboard, NativeMouse, SelectFileOptions } from './types.js';
import { centerOf } from './utils/geometry.js';
import { redactPath } from './utils/redactNative.js';

export interface FileDialogAccessibilityStrategy {
  selectFile(filePath: string, options: SelectFileOptions): Promise<void>;
}

export interface NativeFileDialogServiceDependencies {
  keyboard: NativeKeyboard;
  mouse?: NativeMouse;
  images?: NativeImageFinder;
  accessibility?: FileDialogAccessibilityStrategy;
  logger?: Logger;
  defaultTimeoutMs?: number;
  revealFilePathsInLogs?: boolean;
}

export class DefaultNativeFileDialogService {
  constructor(private readonly deps: NativeFileDialogServiceDependencies) {}

  async selectFile(filePath: string, options: SelectFileOptions = {}): Promise<void> {
    const absolutePath = path.resolve(filePath);
    await this.assertFileExists(absolutePath);

    const strategy = options.strategy ?? 'auto';
    const failures: unknown[] = [];

    if (strategy === 'applescript' || strategy === 'auto') {
      if (this.deps.accessibility !== undefined) {
        try {
          await this.deps.accessibility.selectFile(absolutePath, options);
          this.logSuccess('applescript', absolutePath);
          return;
        } catch (error) {
          failures.push(error);
          if (strategy === 'applescript') throw this.wrapFailure('applescript', absolutePath, failures);
        }
      } else if (strategy === 'applescript') {
        throw new NativeFileDialogError('AppleScript file-dialog strategy is not available.', { strategy });
      }
    }

    if (strategy === 'visual' || strategy === 'auto') {
      if (this.deps.images !== undefined && this.deps.mouse !== undefined) {
        try {
          await this.selectFileVisually(absolutePath, options);
          this.logSuccess('visual', absolutePath);
          return;
        } catch (error) {
          failures.push(error);
          if (strategy === 'visual') throw this.wrapFailure('visual', absolutePath, failures);
        }
      } else if (strategy === 'visual') {
        throw new NativeFileDialogError('Visual file-dialog strategy requires image finder and native mouse dependencies.', { strategy });
      }
    }

    if (strategy === 'keyboard' || strategy === 'auto') {
      try {
        await this.selectFileWithKeyboard(absolutePath, options);
        this.logSuccess('keyboard', absolutePath);
        return;
      } catch (error) {
        failures.push(error);
      }
    }

    throw this.wrapFailure(strategy, absolutePath, failures);
  }

  private async assertFileExists(filePath: string): Promise<void> {
    const stat = await fs.stat(filePath).catch(() => null);
    console.log(filePath);
    console.log(stat);
    if (stat === null || !stat.isFile()) {
      throw new NativeFileDialogError('Cannot select file because the path does not exist or is not a file.', {
        filePath: redactPath(filePath, this.deps.revealFilePathsInLogs)
      });
    }
  }

  private async selectFileVisually(filePath: string, options: SelectFileOptions): Promise<void> {
    if (this.deps.images === undefined || this.deps.mouse === undefined) {
      throw new NativeFileDialogError('Visual file-dialog strategy requires image finder and native mouse dependencies.');
    }

    if (options.inputFieldTemplate !== undefined) {
      const input = await this.deps.images.waitForTemplate(options.inputFieldTemplate, this.imageSearchOptions(options));
      await this.deps.mouse.click(centerOf(input.region));
    } else {
      await this.deps.keyboard.pressShortcut(['Meta', 'Shift', 'G']);
    }

    await this.deps.keyboard.type(filePath);
    await this.deps.keyboard.pressKey('Enter');

    if ((options.clickOpen ?? true) && options.openButtonTemplate !== undefined) {
      const openButton = await this.deps.images.waitForTemplate(options.openButtonTemplate, this.imageSearchOptions(options));
      await this.deps.mouse.click(centerOf(openButton.region));
    } else if (options.clickOpen ?? true) {
      await this.deps.keyboard.pressKey('Enter');
    }
  }

  private async selectFileWithKeyboard(filePath: string, options: SelectFileOptions): Promise<void> {
    await this.deps.keyboard.pressShortcut(['Meta', 'Shift', 'G']);
    await this.deps.keyboard.type(filePath);
    await this.deps.keyboard.pressKey('Enter');
    if (options.clickOpen ?? true) {
      await this.deps.keyboard.pressKey('Enter');
    }
  }

  private imageSearchOptions(options: SelectFileOptions) {
    const searchOptions: { timeoutMs?: number; intervalMs?: number } = {};
    if (options.timeoutMs !== undefined) searchOptions.timeoutMs = options.timeoutMs;
    if (options.intervalMs !== undefined) searchOptions.intervalMs = options.intervalMs;
    return searchOptions;
  }

  private wrapFailure(strategy: string, filePath: string, failures: unknown[]): NativeFileDialogError {
    return new NativeFileDialogError('Failed to select a file in the native file dialog.', {
      strategy,
      filePath: redactPath(filePath, this.deps.revealFilePathsInLogs),
      failures
    });
  }

  private logSuccess(strategy: string, filePath: string): void {
    this.deps.logger?.debug('Selected file in native dialog.', {
      strategy,
      filePath: redactPath(filePath, this.deps.revealFilePathsInLogs)
    });
  }
}
