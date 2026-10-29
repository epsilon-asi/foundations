import { describe, expect, it } from 'vitest';
import { matchesWindow, matcherToString } from '../../../src/native/WindowMatcher.js';
import type { NativeWindowInfo } from '../../../src/native/types.js';

const windowInfo: NativeWindowInfo = {
  title: 'Upwork - Google Chrome',
  appName: 'Google Chrome',
  bundleId: 'com.google.Chrome',
  role: 'AXWindow',
  region: { x: 0, y: 0, width: 1200, height: 800 }
};

describe('WindowMatcher', () => {
  it('matches exact title, app name, bundle id, role, includes, and regex', () => {
    expect(matchesWindow(windowInfo, { title: 'Upwork - Google Chrome' })).toBe(true);
    expect(matchesWindow(windowInfo, { appName: 'Google Chrome', titleIncludes: 'Upwork' })).toBe(true);
    expect(matchesWindow(windowInfo, { bundleId: 'com.google.Chrome', role: 'AXWindow' })).toBe(true);
    expect(matchesWindow(windowInfo, { titleRegex: /Upwork/ })).toBe(true);
    expect(matchesWindow(windowInfo, { titleRegex: 'Google Chrome$' })).toBe(true);
  });

  it('rejects non-matching window attributes', () => {
    expect(matchesWindow(windowInfo, { appName: 'Safari' })).toBe(false);
    expect(matchesWindow(windowInfo, { titleIncludes: 'LinkedIn' })).toBe(false);
    expect(matchesWindow(windowInfo, { titleRegex: /^Safari/ })).toBe(false);
  });

  it('summarizes matchers for diagnostics', () => {
    expect(matcherToString({ appName: 'Google Chrome', titleIncludes: 'Upwork' })).toBe('app=Google Chrome, titleIncludes=Upwork');
    expect(matcherToString({})).toBe('<any window>');
  });
});
