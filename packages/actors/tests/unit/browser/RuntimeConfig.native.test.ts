import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeRuntimeConfig } from '../../../src/browser/RuntimeConfig.js';

function createUserDataDir(): string {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'paf-native-config-'));
  fs.mkdirSync(path.join(userDataDir, 'Default'));
  return userDataDir;
}

describe('native RuntimeConfig normalization', () => {
  it('preserves backward compatibility when native config is omitted', () => {
    const config = normalizeRuntimeConfig({
      browser: {
        mode: 'existing-profile',
        userDataDir: createUserDataDir(),
        profileDirectory: 'Default',
        headless: false
      }
    });

    expect(config.native).toBeUndefined();
  });

  it('normalizes native macOS automation defaults when opted in', () => {
    const config = normalizeRuntimeConfig({
      browser: {
        mode: 'existing-profile',
        userDataDir: createUserDataDir(),
        profileDirectory: 'Default',
        headless: false
      },
      native: {
        templatesDir: '/tmp/templates'
      }
    });

    expect(config.native).toMatchObject({
      enabled: true,
      platform: 'macos',
      templatesDir: '/tmp/templates',
      imageConfidence: 0.9,
      mouse: {
        jitterPixels: 3,
        minJitterPixels: 2
      },
      macos: {
        targetApplicationName: 'Google Chrome',
        osascriptTimeoutMs: 15_000,
        preferAppleScriptForWindows: true,
        preferVisualTemplatesForDialogs: false
      },
      coordinateCalibration: {
        enabled: true,
        markerSizePx: 22,
        timeoutMs: 15_000,
        cacheTtlMs: 60_000
      }
    });
  });
});
