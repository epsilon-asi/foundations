import type { Logger } from '../../logging/Logger.js';
import type { NativeWindowDriver, NativeWindowHandle } from '../drivers.js';
import type { NativePoint, NativeRegion, NativeSize, NativeWindowInfo } from '../types.js';
import { appleScriptString } from '../utils/appleScriptEscape.js';
import { MacOSAppleScriptClient } from './MacOSAppleScriptClient.js';

const FIELD_SEPARATOR = '\u001f';
const ROW_SEPARATOR = '\u001e';

function parseBoolean(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

class MacOSAccessibilityWindowHandle implements NativeWindowHandle {
  constructor(private readonly client: MacOSAppleScriptClient, private currentInfo: NativeWindowInfo) {}

  async info(): Promise<NativeWindowInfo> {
    return this.currentInfo;
  }

  async focus(): Promise<void> {
    await this.client.focusWindow(this.matcher(), this.currentInfo.appName ?? 'Google Chrome');
    this.currentInfo = { ...this.currentInfo, isFocused: true };
  }

  async minimize(): Promise<void> {
    await this.client.minimize(this.matcher(), this.currentInfo.appName ?? 'Google Chrome');
    this.currentInfo = { ...this.currentInfo, isMinimized: true };
  }

  async restore(): Promise<void> {
    await this.executeOnWindow(`set value of attribute "AXMinimized" of candidateWindow to false`);
    this.currentInfo = { ...this.currentInfo, isMinimized: false };
  }

  async move(point: NativePoint): Promise<void> {
    await this.executeOnWindow(`set position of candidateWindow to {${Math.round(point.x)}, ${Math.round(point.y)}}`);
    this.currentInfo = {
      ...this.currentInfo,
      region: { ...this.currentInfo.region, x: Math.round(point.x), y: Math.round(point.y) }
    };
  }

  async resize(size: NativeSize): Promise<void> {
    await this.executeOnWindow(`set size of candidateWindow to {${Math.round(size.width)}, ${Math.round(size.height)}}`);
    this.currentInfo = {
      ...this.currentInfo,
      region: { ...this.currentInfo.region, width: Math.round(size.width), height: Math.round(size.height) }
    };
  }

  async setFullscreen(fullscreen: boolean): Promise<void> {
    await this.client.setFullscreen(this.matcher(), fullscreen, this.currentInfo.appName ?? 'Google Chrome');
    this.currentInfo = { ...this.currentInfo, isFullscreen: fullscreen };
  }

  async toggleFullscreen(): Promise<void> {
    await this.client.toggleFullscreen(this.matcher(), this.currentInfo.appName ?? 'Google Chrome');
    if (this.currentInfo.isFullscreen === undefined) {
      this.currentInfo = { ...this.currentInfo };
    } else {
      this.currentInfo = { ...this.currentInfo, isFullscreen: !this.currentInfo.isFullscreen };
    }
  }

  private matcher() {
    const matcher: { appName?: string; title?: string } = {};
    if (this.currentInfo.appName !== undefined) matcher.appName = this.currentInfo.appName;
    matcher.title = this.currentInfo.title;
    return matcher;
  }

  private async executeOnWindow(action: string): Promise<void> {
    const appName = this.currentInfo.appName ?? 'Google Chrome';
    const title = this.currentInfo.title;
    const script = `
      tell application "System Events"
        tell process ${appleScriptString(appName)}
          repeat with candidateWindow in windows
            if name of candidateWindow is ${appleScriptString(title)} then
              ${action}
              return
            end if
          end repeat
        end tell
      end tell
    `;
    await this.client.execute(script);
  }
}

export class MacOSAccessibilityWindowDriver implements NativeWindowDriver {
  constructor(private readonly client: MacOSAppleScriptClient, private readonly logger?: Logger) {}

  async list(): Promise<NativeWindowHandle[]> {
    const script = `
      set fieldSeparator to ASCII character 31
      set rowSeparator to ASCII character 30
      set rows to {}
      tell application "System Events"
        repeat with appProcess in application processes
          set appName to name of appProcess
          repeat with candidateWindow in windows of appProcess
            set windowTitle to ""
            set px to 0
            set py to 0
            set windowWidth to 0
            set windowHeight to 0
            set minimizedValue to ""
            set fullscreenValue to ""
            try
              set windowTitle to name of candidateWindow
            end try
            try
              set windowPosition to position of candidateWindow
              set px to item 1 of windowPosition
              set py to item 2 of windowPosition
            end try
            try
              set windowSize to size of candidateWindow
              set windowWidth to item 1 of windowSize
              set windowHeight to item 2 of windowSize
            end try
            try
              set minimizedValue to (value of attribute "AXMinimized" of candidateWindow) as text
            end try
            try
              set fullscreenValue to (value of attribute "AXFullScreen" of candidateWindow) as text
            end try
            copy (appName & fieldSeparator & windowTitle & fieldSeparator & px & fieldSeparator & py & fieldSeparator & windowWidth & fieldSeparator & windowHeight & fieldSeparator & minimizedValue & fieldSeparator & fullscreenValue) to end of rows
          end repeat
        end repeat
      end tell
      set AppleScript's text item delimiters to rowSeparator
      return rows as text
    `;

    try {
      const output = await this.client.execute(script);
      if (output.length === 0) return [];
      return output.split(ROW_SEPARATOR)
        .map(row => this.parseRow(row))
        .filter((info): info is NativeWindowInfo => info !== null)
        .map(info => new MacOSAccessibilityWindowHandle(this.client, info));
    } catch (error) {
      this.logger?.debug('Failed to list windows through macOS Accessibility.', { error });
      throw error;
    }
  }

  private parseRow(row: string): NativeWindowInfo | null {
    const fields = row.split(FIELD_SEPARATOR);
    if (fields.length < 8) return null;
    const [appName, title, xRaw, yRaw, widthRaw, heightRaw, minimizedRaw, fullscreenRaw] = fields;
    if (appName === undefined || title === undefined || xRaw === undefined || yRaw === undefined || widthRaw === undefined || heightRaw === undefined) {
      return null;
    }

    const region: NativeRegion = {
      x: parseNumber(xRaw),
      y: parseNumber(yRaw),
      width: parseNumber(widthRaw),
      height: parseNumber(heightRaw)
    };
    const info: NativeWindowInfo = {
      appName,
      title,
      region
    };
    const isMinimized = parseBoolean(minimizedRaw ?? '');
    const isFullscreen = parseBoolean(fullscreenRaw ?? '');
    if (isMinimized !== undefined) info.isMinimized = isMinimized;
    if (isFullscreen !== undefined) info.isFullscreen = isFullscreen;
    return info;
  }
}
