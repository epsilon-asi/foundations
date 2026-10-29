import type {
  BrowserPoint,
  CalibrationOptions,
  CoordinateMapOptions,
  CoordinateTransform,
  NativeAutomation,
  NativeFileDialogService,
  NativeImageFinder,
  NativeImageMatch,
  NativeImageSearchOptions,
  NativeKeyboard,
  NativeMouse,
  NativeMouseClickOptions,
  NativeMouseMoveOptions,
  NativeRegion,
  NativeTemplateRef,
  NativeWindowInfo,
  NativeWindowService,
  ScreenPoint,
  SelectFileOptions,
  WaitOptions,
  WindowButtonOptions,
  WindowMatcher
} from './types.js';
import { DefaultNativeActionRegistry, registerDefaultNativeActions } from './NativeActionRegistry.js';
import { UnsupportedPlatformError } from './errors.js';
import type { Logger } from '../logging/Logger.js';
import type { PageLike } from '../browser/PuppeteerLike.js';

class UnsupportedNativeWindowService implements NativeWindowService {
  constructor(private readonly platform: NodeJS.Platform) {}
  async list(): Promise<NativeWindowInfo[]> { throw new UnsupportedPlatformError(this.platform); }
  async find(_matcher: WindowMatcher, _options?: WaitOptions): Promise<NativeWindowInfo | null> { throw new UnsupportedPlatformError(this.platform); }
  async waitFor(_matcher: WindowMatcher, _options?: WaitOptions): Promise<NativeWindowInfo> { throw new UnsupportedPlatformError(this.platform); }
  async isOpen(_matcher: WindowMatcher): Promise<boolean> { throw new UnsupportedPlatformError(this.platform); }
  async focus(_matcher: WindowMatcher): Promise<NativeWindowInfo> { throw new UnsupportedPlatformError(this.platform); }
  async ensureInView(_matcher: WindowMatcher): Promise<NativeWindowInfo> { throw new UnsupportedPlatformError(this.platform); }
  async setFullscreen(_matcher: WindowMatcher, _fullscreen: boolean, _options?: WindowButtonOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async toggleFullscreen(_matcher: WindowMatcher, _options?: WindowButtonOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async minimize(_matcher: WindowMatcher): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async restore(_matcher: WindowMatcher): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
}

class UnsupportedNativeFileDialogService implements NativeFileDialogService {
  constructor(private readonly platform: NodeJS.Platform) {}
  async selectFile(_filePath: string, _options?: SelectFileOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
}

class UnsupportedNativeMouse implements NativeMouse {
  constructor(private readonly platform: NodeJS.Platform) {}
  async moveTo(_point: ScreenPoint, _options?: NativeMouseMoveOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async click(_point: ScreenPoint, _options?: NativeMouseClickOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async clickRegion(_region: NativeRegion, _options?: NativeMouseClickOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async clickBrowserPoint(_page: PageLike, _point: BrowserPoint, _options?: NativeMouseClickOptions): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
}

class UnsupportedNativeKeyboard implements NativeKeyboard {
  constructor(private readonly platform: NodeJS.Platform) {}
  async type(_text: string): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async pressKey(_key: string): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
  async pressShortcut(_keys: readonly string[]): Promise<void> { throw new UnsupportedPlatformError(this.platform); }
}

class UnsupportedNativeCoordinateMapper {
  constructor(private readonly platform: NodeJS.Platform) {}
  async calibrate(_page: PageLike, _options?: CalibrationOptions): Promise<CoordinateTransform> { throw new UnsupportedPlatformError(this.platform); }
  async browserToScreen(_point: BrowserPoint, _options?: CoordinateMapOptions): Promise<ScreenPoint> { throw new UnsupportedPlatformError(this.platform); }
  async screenToBrowser(_point: ScreenPoint, _options?: CoordinateMapOptions): Promise<BrowserPoint> { throw new UnsupportedPlatformError(this.platform); }
  invalidate(): void {}
}

class UnsupportedNativeImageFinder implements NativeImageFinder {
  constructor(private readonly platform: NodeJS.Platform) {}
  async findTemplate(_template: string | NativeTemplateRef, _options?: NativeImageSearchOptions): Promise<NativeImageMatch | null> { throw new UnsupportedPlatformError(this.platform); }
  async waitForTemplate(_template: string | NativeTemplateRef, _options?: NativeImageSearchOptions): Promise<NativeImageMatch> { throw new UnsupportedPlatformError(this.platform); }
}

export function createUnsupportedNativeAutomation(platform: NodeJS.Platform, logger: Logger): NativeAutomation {
  const automation = {
    windows: new UnsupportedNativeWindowService(platform),
    fileDialogs: new UnsupportedNativeFileDialogService(platform),
    mouse: new UnsupportedNativeMouse(platform),
    keyboard: new UnsupportedNativeKeyboard(platform),
    coordinates: new UnsupportedNativeCoordinateMapper(platform),
    images: new UnsupportedNativeImageFinder(platform),
    actions: undefined as unknown as DefaultNativeActionRegistry
  } satisfies Omit<NativeAutomation, 'actions'> & { actions: DefaultNativeActionRegistry };

  const registry = new DefaultNativeActionRegistry(() => ({ automation, logger }));
  automation.actions = registerDefaultNativeActions(registry, automation, logger);
  return automation;
}
