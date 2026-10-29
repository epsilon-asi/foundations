import type { NativeMouseButton, NativePoint, NativeRegion, NativeSize, NativeWindowInfo } from './types.js';

export interface NativeMouseDriver {
  getPosition(): Promise<NativePoint>;
  move(point: NativePoint): Promise<void>;
  click(button: NativeMouseButton): Promise<void>;
}

export interface NativeKeyboardDriver {
  type(text: string, options?: { delayMs?: number }): Promise<void>;
  pressKey(key: string): Promise<void>;
  pressShortcut(keys: readonly string[]): Promise<void>;
}

export interface NativeScreenDriver {
  width(): Promise<number>;
  height(): Promise<number>;
}

export interface NativeWindowHandle {
  info(): Promise<NativeWindowInfo>;
  focus(): Promise<void>;
  minimize(): Promise<void>;
  restore(): Promise<void>;
  move(point: NativePoint): Promise<void>;
  resize(size: NativeSize): Promise<void>;
  setFullscreen?(fullscreen: boolean): Promise<void>;
  toggleFullscreen?(): Promise<void>;
}

export interface NativeWindowDriver {
  list(): Promise<NativeWindowHandle[]>;
  active?(): Promise<NativeWindowHandle | null>;
}

export interface AppleScriptExecutor {
  execute(script: string, options?: { timeoutMs?: number }): Promise<string>;
}
