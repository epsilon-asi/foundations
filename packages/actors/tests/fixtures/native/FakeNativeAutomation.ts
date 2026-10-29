import type { PageLike } from '../../../src/browser/PuppeteerLike.js';
import { DefaultNativeActionRegistry, registerDefaultNativeActions } from '../../../src/native/NativeActionRegistry.js';
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
} from '../../../src/native/types.js';
import type { Logger } from '../../../src/logging/Logger.js';
import { MemoryLogger } from '../../../src/logging/MemoryLogger.js';

export class FakeNativeWindowService implements NativeWindowService {
  windows: NativeWindowInfo[] = [];
  focused: WindowMatcher[] = [];
  minimized: WindowMatcher[] = [];
  restored: WindowMatcher[] = [];
  fullscreenCalls: Array<{ matcher: WindowMatcher; fullscreen: boolean }> = [];

  async list(): Promise<NativeWindowInfo[]> { return this.windows; }
  async find(matcher: WindowMatcher, _options?: WaitOptions): Promise<NativeWindowInfo | null> {
    return this.windows.find(window => matcher.title === undefined || window.title === matcher.title) ?? null;
  }
  async waitFor(matcher: WindowMatcher, options?: WaitOptions): Promise<NativeWindowInfo> {
    const found = await this.find(matcher, options);
    if (found === null) throw new Error('Missing fake native window.');
    return found;
  }
  async isOpen(matcher: WindowMatcher): Promise<boolean> { return (await this.find(matcher)) !== null; }
  async focus(matcher: WindowMatcher): Promise<NativeWindowInfo> { this.focused.push(matcher); return this.waitFor(matcher); }
  async ensureInView(matcher: WindowMatcher): Promise<NativeWindowInfo> { this.focused.push(matcher); return this.waitFor(matcher); }
  async setFullscreen(matcher: WindowMatcher, fullscreen: boolean, _options?: WindowButtonOptions): Promise<void> { this.fullscreenCalls.push({ matcher, fullscreen }); }
  async toggleFullscreen(matcher: WindowMatcher, _options?: WindowButtonOptions): Promise<void> { this.fullscreenCalls.push({ matcher, fullscreen: true }); }
  async minimize(matcher: WindowMatcher): Promise<void> { this.minimized.push(matcher); }
  async restore(matcher: WindowMatcher): Promise<void> { this.restored.push(matcher); }
}

export class FakeNativeFileDialogService implements NativeFileDialogService {
  selected: Array<{ filePath: string; options?: SelectFileOptions }> = [];
  async selectFile(filePath: string, options?: SelectFileOptions): Promise<void> {
    const record: { filePath: string; options?: SelectFileOptions } = { filePath };
    if (options !== undefined) record.options = options;
    this.selected.push(record);
  }
}

export class FakeNativeMouse implements NativeMouse {
  moves: Array<{ point: ScreenPoint; options?: NativeMouseMoveOptions }> = [];
  clicks: Array<{ point: ScreenPoint; options?: NativeMouseClickOptions }> = [];
  regionClicks: Array<{ region: NativeRegion; options?: NativeMouseClickOptions }> = [];
  browserClicks: Array<{ page: PageLike; point: BrowserPoint; options?: NativeMouseClickOptions }> = [];
  async moveTo(point: ScreenPoint, options?: NativeMouseMoveOptions): Promise<void> { this.moves.push(options === undefined ? { point } : { point, options }); }
  async click(point: ScreenPoint, options?: NativeMouseClickOptions): Promise<void> { this.clicks.push(options === undefined ? { point } : { point, options }); }
  async clickRegion(region: NativeRegion, options?: NativeMouseClickOptions): Promise<void> { this.regionClicks.push(options === undefined ? { region } : { region, options }); }
  async clickBrowserPoint(page: PageLike, point: BrowserPoint, options?: NativeMouseClickOptions): Promise<void> { this.browserClicks.push(options === undefined ? { page, point } : { page, point, options }); }
}

export class FakeNativeKeyboard implements NativeKeyboard {
  typed: string[] = [];
  pressed: string[] = [];
  shortcuts: Array<readonly string[]> = [];
  async type(text: string): Promise<void> { this.typed.push(text); }
  async pressKey(key: string): Promise<void> { this.pressed.push(key); }
  async pressShortcut(keys: readonly string[]): Promise<void> { this.shortcuts.push(keys); }
}

export class FakeNativeImageFinder implements NativeImageFinder {
  matches = new Map<string, NativeImageMatch | null>();
  async findTemplate(template: string | NativeTemplateRef, _options?: NativeImageSearchOptions): Promise<NativeImageMatch | null> {
    return this.matches.get(typeof template === 'string' ? template : template.name) ?? null;
  }
  async waitForTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch> {
    const match = await this.findTemplate(template, options);
    if (match === null) throw new Error('Missing fake image match.');
    return match;
  }
}

export class FakeNativeCoordinateMapper {
  transform: CoordinateTransform = {
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
    calibratedAt: Date.now(),
    viewport: { innerWidth: 1000, innerHeight: 800, devicePixelRatio: 1 }
  };
  async calibrate(_page: PageLike, _options?: CalibrationOptions): Promise<CoordinateTransform> { return this.transform; }
  async browserToScreen(point: BrowserPoint, _options?: CoordinateMapOptions): Promise<ScreenPoint> {
    return { x: this.transform.offsetX + point.x * this.transform.scaleX, y: this.transform.offsetY + point.y * this.transform.scaleY };
  }
  async screenToBrowser(point: ScreenPoint, _options?: CoordinateMapOptions): Promise<BrowserPoint> {
    return { x: (point.x - this.transform.offsetX) / this.transform.scaleX, y: (point.y - this.transform.offsetY) / this.transform.scaleY };
  }
  invalidate(): void {}
}

export interface FakeNativeAutomationParts extends NativeAutomation {
  windows: FakeNativeWindowService;
  fileDialogs: FakeNativeFileDialogService;
  mouse: FakeNativeMouse;
  keyboard: FakeNativeKeyboard;
  images: FakeNativeImageFinder;
  coordinates: FakeNativeCoordinateMapper;
}

export function createFakeNativeAutomation(logger: Logger = new MemoryLogger()): FakeNativeAutomationParts {
  const automation = {
    windows: new FakeNativeWindowService(),
    fileDialogs: new FakeNativeFileDialogService(),
    mouse: new FakeNativeMouse(),
    keyboard: new FakeNativeKeyboard(),
    images: new FakeNativeImageFinder(),
    coordinates: new FakeNativeCoordinateMapper(),
    actions: undefined as unknown as DefaultNativeActionRegistry
  } satisfies FakeNativeAutomationParts;

  const registry = new DefaultNativeActionRegistry(() => ({ automation, logger }));
  automation.actions = registerDefaultNativeActions(registry, automation, logger);
  return automation;
}
