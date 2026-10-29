import type { SelectFileOptions } from '../types.js';
import type { FileDialogAccessibilityStrategy } from '../NativeFileDialogService.js';
import { MacOSAppleScriptClient } from './MacOSAppleScriptClient.js';

export class MacOSFileDialogAccessibilityStrategy implements FileDialogAccessibilityStrategy {
  constructor(private readonly client: MacOSAppleScriptClient, private readonly defaultAppName = 'Google Chrome') {}

  async selectFile(filePath: string, options: SelectFileOptions): Promise<void> {
    await this.client.selectFileInOpenDialog(filePath, options.appName ?? this.defaultAppName, options.timeoutMs);
  }
}
