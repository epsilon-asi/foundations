import { describe, expect, it } from 'vitest';
import type { AppleScriptExecutor } from '../../../src/native/drivers.js';
import { MacOSAppleScriptClient } from '../../../src/native/macos/MacOSAppleScriptClient.js';

class FakeExecutor implements AppleScriptExecutor {
  scripts: string[] = [];
  result = '';
  async execute(script: string): Promise<string> {
    this.scripts.push(script);
    return this.result;
  }
}

describe('MacOSAppleScriptClient', () => {
  it('escapes app names, titles, and file paths in generated scripts', async () => {
    const executor = new FakeExecutor();
    const client = new MacOSAppleScriptClient({ executor });

    await client.setFullscreen({ appName: 'Google "Chrome"', title: 'A "quoted" window' }, true);
    await client.selectFileInOpenDialog('/Users/me/A "quoted" file.pdf', 'Google "Chrome"');

    expect(executor.scripts[0]).toContain('process "Google \\"Chrome\\""');
    expect(executor.scripts[0]).toContain('"A \\"quoted\\" window"');
    expect(executor.scripts[1]).toContain('set targetPath to "/Users/me/A \\"quoted\\" file.pdf"');
  });

  it('parses boolean window-open output', async () => {
    const executor = new FakeExecutor();
    executor.result = 'true';
    const client = new MacOSAppleScriptClient({ executor });

    await expect(client.isWindowOpen({ appName: 'Google Chrome', titleIncludes: 'Upwork' })).resolves.toBe(true);
    expect(executor.scripts[0]).toContain('name of candidateWindow contains "Upwork"');
  });
});
