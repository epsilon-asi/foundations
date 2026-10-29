import type { BrowserSession } from '../browser/BrowserSession.js';
import type { PageLike } from '../browser/PuppeteerLike.js';
import type { RuntimeConfig } from '../browser/RuntimeConfig.js';
import type { Logger } from '../logging/Logger.js';

export type NativePlatform = 'macos';
export type NativeMouseButton = 'left' | 'right' | 'middle';
export type NativeFileDialogStrategy = 'auto' | 'applescript' | 'visual' | 'keyboard';
export type NativeWindowControlStrategy = 'auto' | 'accessibility' | 'visual';

export interface NativePoint {
  x: number;
  y: number;
}

export interface ScreenPoint extends NativePoint {}
export interface BrowserPoint extends NativePoint {}

export interface NativeSize {
  width: number;
  height: number;
}

export interface NativeRegion extends NativePoint, NativeSize {}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export interface WindowMatcher {
  appName?: string;
  title?: string;
  titleIncludes?: string;
  titleRegex?: RegExp | string;
  bundleId?: string;
  role?: string;
}

export interface NativeWindowInfo {
  id?: string | number;
  title: string;
  appName?: string;
  bundleId?: string;
  role?: string;
  region: NativeRegion;
  isFocused?: boolean;
  isMinimized?: boolean;
  isFullscreen?: boolean;
}

export interface EnsureWindowInViewOptions extends WaitOptions {
  restore?: boolean;
  focus?: boolean;
  moveIntoPrimaryDisplay?: boolean;
  minimumVisibleWidth?: number;
  minimumVisibleHeight?: number;
}

export interface WindowButtonOptions extends WaitOptions {
  strategy?: NativeWindowControlStrategy;
  fullscreenButtonTemplate?: string;
  searchRegionPaddingPx?: number;
}

export interface SelectFileOptions extends WaitOptions {
  appName?: string;
  dialogTitle?: string;
  openButtonTemplate?: string;
  inputFieldTemplate?: string;
  strategy?: NativeFileDialogStrategy;
  clickOpen?: boolean;
}

export interface NativeMouseMoveOptions {
  precise?: boolean;
  jitterPixels?: number;
  minJitterPixels?: number;
  moveSpeed?: number;
  disableHumanPath?: boolean;
}

export interface NativeMouseClickOptions extends NativeMouseMoveOptions {
  button?: NativeMouseButton;
  delayBeforeClickMs?: number;
  delayAfterMoveMs?: number;
  regionPaddingPx?: number;
}

export interface NativeKeyboardTypeOptions {
  delayMs?: number;
}

export interface NativeKeyboard {
  type(text: string, options?: NativeKeyboardTypeOptions): Promise<void>;
  pressKey(key: string): Promise<void>;
  pressShortcut(keys: readonly string[]): Promise<void>;
}

export interface NativeMouse {
  moveTo(point: ScreenPoint, options?: NativeMouseMoveOptions): Promise<void>;
  click(point: ScreenPoint, options?: NativeMouseClickOptions): Promise<void>;
  clickRegion(region: NativeRegion, options?: NativeMouseClickOptions): Promise<void>;
  clickBrowserPoint(page: PageLike, point: BrowserPoint, options?: NativeMouseClickOptions): Promise<void>;
}

export interface NativeTemplateRef {
  name: string;
  buffer?: Uint8Array;
}

export interface NativeImageSearchOptions extends WaitOptions {
  searchRegion?: NativeRegion;
  confidence?: number;
}

export interface NativeImageMatch {
  region: NativeRegion;
  confidence?: number;
}

export interface NativeImageFinder {
  findTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch | null>;
  waitForTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch>;
}

export interface NativeWindowService {
  list(): Promise<NativeWindowInfo[]>;
  find(matcher: WindowMatcher, options?: WaitOptions): Promise<NativeWindowInfo | null>;
  waitFor(matcher: WindowMatcher, options?: WaitOptions): Promise<NativeWindowInfo>;
  isOpen(matcher: WindowMatcher): Promise<boolean>;
  focus(matcher: WindowMatcher): Promise<NativeWindowInfo>;
  ensureInView(matcher: WindowMatcher, options?: EnsureWindowInViewOptions): Promise<NativeWindowInfo>;
  setFullscreen(matcher: WindowMatcher, fullscreen: boolean, options?: WindowButtonOptions): Promise<void>;
  toggleFullscreen(matcher: WindowMatcher, options?: WindowButtonOptions): Promise<void>;
  minimize(matcher: WindowMatcher): Promise<void>;
  restore(matcher: WindowMatcher): Promise<void>;
}

export interface NativeFileDialogService {
  selectFile(filePath: string, options?: SelectFileOptions): Promise<void>;
}

export interface BrowserViewportSnapshot {
  screenX: number;
  screenY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
}

export interface CoordinateTransform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  calibratedAt: number;
  viewport: Pick<BrowserViewportSnapshot, 'innerWidth' | 'innerHeight' | 'devicePixelRatio'>;
  window?: NativeWindowInfo;
}

export interface CalibrationOptions extends WaitOptions {
  markerSizePx?: number;
  markerA?: BrowserPoint;
  markerB?: BrowserPoint;
  cacheTtlMs?: number;
  windowMatcher?: WindowMatcher;
}

export interface CoordinateMapOptions {
  page?: PageLike;
  useCache?: boolean;
}

export interface NativeCoordinateMapper {
  calibrate(page: PageLike, options?: CalibrationOptions): Promise<CoordinateTransform>;
  browserToScreen(point: BrowserPoint, options?: CoordinateMapOptions): Promise<ScreenPoint>;
  screenToBrowser(point: ScreenPoint, options?: CoordinateMapOptions): Promise<BrowserPoint>;
  invalidate(): void;
}

export interface NativeActionContext {
  automation: NativeAutomation;
  logger: Logger;
}

export interface NativeAction<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  run(context: NativeActionContext, input: TInput): Promise<TOutput>;
}

export interface NativeActionMetadata {
  name: string;
  description?: string;
}

export interface NativeActionRegistry {
  register<TInput, TOutput>(action: NativeAction<TInput, TOutput>): this;
  get<TInput = unknown, TOutput = unknown>(name: string): NativeAction<TInput, TOutput>;
  run<TInput = unknown, TOutput = unknown>(name: string, input: TInput): Promise<TOutput>;
  list(): NativeActionMetadata[];
}

export interface NativeAutomation {
  windows: NativeWindowService;
  fileDialogs: NativeFileDialogService;
  mouse: NativeMouse;
  keyboard: NativeKeyboard;
  coordinates: NativeCoordinateMapper;
  images: NativeImageFinder;
  actions: NativeActionRegistry;
}

export interface NativeAutomationFactoryArgs {
  session: BrowserSession;
  page: PageLike;
  config: RuntimeConfig;
  logger: Logger;
}

export type NativeAutomationFactory = (args: NativeAutomationFactoryArgs) => NativeAutomation;
