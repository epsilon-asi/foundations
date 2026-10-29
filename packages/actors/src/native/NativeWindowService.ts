import type { Logger } from '../logging/Logger.js';
import type { NativeScreenDriver, NativeWindowDriver, NativeWindowHandle } from './drivers.js';
import { NativeAutomationError, NativeWindowNotFoundError } from './errors.js';
import { matchesWindow, matcherToString } from './WindowMatcher.js';
import type {
  EnsureWindowInViewOptions,
  NativeImageFinder,
  NativeMouse,
  NativeRegion,
  NativeWindowInfo,
  WaitOptions,
  WindowButtonOptions,
  WindowMatcher
} from './types.js';
import { centerOf, visibleEnough } from './utils/geometry.js';
import { waitFor } from './utils/waitFor.js';

export interface NativeWindowServiceDependencies {
  driver: NativeWindowDriver;
  screen: NativeScreenDriver;
  mouse?: NativeMouse;
  images?: NativeImageFinder;
  logger?: Logger;
  defaultTimeoutMs?: number;
}

export class DefaultNativeWindowService {
  private readonly defaultTimeoutMs: number;

  constructor(private readonly deps: NativeWindowServiceDependencies) {
    this.defaultTimeoutMs = deps.defaultTimeoutMs ?? 15_000;
  }

  async list(): Promise<NativeWindowInfo[]> {
    const handles = await this.deps.driver.list();
    return Promise.all(handles.map(handle => handle.info()));
  }

  async find(matcher: WindowMatcher, options: WaitOptions = {}): Promise<NativeWindowInfo | null> {
    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      try {
        return await this.waitFor(matcher, options);
      } catch (error) {
        if (error instanceof NativeWindowNotFoundError) return null;
        throw error;
      }
    }

    const handle = await this.findHandle(matcher);
    return handle === null ? null : handle.info();
  }

  async waitFor(matcher: WindowMatcher, options: WaitOptions = {}): Promise<NativeWindowInfo> {
    try {
      const handle = await this.waitForHandle(matcher, options);
      return handle.info();
    } catch (error) {
      if (error instanceof NativeWindowNotFoundError) throw error;
      throw new NativeWindowNotFoundError({ matcher: matcherToString(matcher), cause: error });
    }
  }

  async isOpen(matcher: WindowMatcher): Promise<boolean> {
    return (await this.findHandle(matcher)) !== null;
  }

  async focus(matcher: WindowMatcher): Promise<NativeWindowInfo> {
    const handle = await this.waitForHandle(matcher);
    const before = await handle.info();
    if (before.isMinimized === true) {
      await handle.restore();
    }
    await handle.focus();
    return this.refreshHandleInfo(handle);
  }

  async ensureInView(matcher: WindowMatcher, options: EnsureWindowInViewOptions = {}): Promise<NativeWindowInfo> {
    const restore = options.restore ?? true;
    const focus = options.focus ?? true;
    const moveIntoPrimaryDisplay = options.moveIntoPrimaryDisplay ?? true;
    const minimumVisibleWidth = options.minimumVisibleWidth ?? 100;
    const minimumVisibleHeight = options.minimumVisibleHeight ?? 80;

    const handle = await this.waitForHandle(matcher, options);
    let info = await handle.info();

    if (restore && info.isMinimized === true) {
      await handle.restore();
      info = await handle.info();
    }

    if (focus) {
      await handle.focus();
      info = await handle.info();
    }

    if (moveIntoPrimaryDisplay) {
      const primaryDisplay: NativeRegion = {
        x: 0,
        y: 0,
        width: await this.deps.screen.width(),
        height: await this.deps.screen.height()
      };

      if (!visibleEnough(info.region, primaryDisplay, minimumVisibleWidth, minimumVisibleHeight)) {
        const target = {
          x: Math.max(0, Math.min(info.region.x, Math.max(0, primaryDisplay.width - info.region.width))),
          y: Math.max(0, Math.min(info.region.y, Math.max(0, primaryDisplay.height - info.region.height)))
        };
        await handle.move(target);
        info = await handle.info();
      }
    }

    return info;
  }

  async setFullscreen(matcher: WindowMatcher, fullscreen: boolean, options: WindowButtonOptions = {}): Promise<void> {
    const handle = await this.waitForHandle(matcher, options);
    const info = await handle.info();

    if (info.isFullscreen === fullscreen) {
      return;
    }

    if (handle.setFullscreen !== undefined) {
      await handle.setFullscreen(fullscreen);
      return;
    }

    if (handle.toggleFullscreen !== undefined) {
      await handle.toggleFullscreen();
      return;
    }

    if ((options.strategy ?? 'auto') !== 'accessibility' && this.deps.images !== undefined && this.deps.mouse !== undefined && options.fullscreenButtonTemplate !== undefined) {
      await this.clickWindowButtonTemplate(info.region, options.fullscreenButtonTemplate, options);
      return;
    }

    throw new NativeAutomationError('Window fullscreen control is unavailable for the matched window.', {
      matcher: matcherToString(matcher),
      strategy: options.strategy ?? 'auto'
    });
  }

  async toggleFullscreen(matcher: WindowMatcher, options: WindowButtonOptions = {}): Promise<void> {
    const handle = await this.waitForHandle(matcher, options);
    const info = await handle.info();

    if (handle.toggleFullscreen !== undefined) {
      await handle.toggleFullscreen();
      return;
    }

    if (handle.setFullscreen !== undefined && info.isFullscreen !== undefined) {
      await handle.setFullscreen(!info.isFullscreen);
      return;
    }

    if ((options.strategy ?? 'auto') !== 'accessibility' && this.deps.images !== undefined && this.deps.mouse !== undefined && options.fullscreenButtonTemplate !== undefined) {
      await this.clickWindowButtonTemplate(info.region, options.fullscreenButtonTemplate, options);
      return;
    }

    throw new NativeAutomationError('Window fullscreen toggle is unavailable for the matched window.', {
      matcher: matcherToString(matcher),
      strategy: options.strategy ?? 'auto'
    });
  }

  async minimize(matcher: WindowMatcher): Promise<void> {
    const handle = await this.waitForHandle(matcher);
    await handle.minimize();
  }

  async restore(matcher: WindowMatcher): Promise<void> {
    const handle = await this.waitForHandle(matcher);
    await handle.restore();
  }

  private async findHandle(matcher: WindowMatcher): Promise<NativeWindowHandle | null> {
    const handles = await this.deps.driver.list();
    for (const handle of handles) {
      const info = await handle.info();
      if (matchesWindow(info, matcher)) {
        return handle;
      }
    }
    return null;
  }

  private async waitForHandle(matcher: WindowMatcher, options: WaitOptions = {}): Promise<NativeWindowHandle> {
    try {
      return await waitFor(
        () => this.findHandle(matcher),
        {
          timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
          intervalMs: options.intervalMs ?? 100,
          description: `native window (${matcherToString(matcher)})`
        }
      );
    } catch (error) {
      throw new NativeWindowNotFoundError({ matcher: matcherToString(matcher), cause: error });
    }
  }

  private async refreshHandleInfo(handle: NativeWindowHandle): Promise<NativeWindowInfo> {
    return handle.info();
  }

  private async clickWindowButtonTemplate(region: NativeRegion, template: string, options: WindowButtonOptions): Promise<void> {
    if (this.deps.images === undefined || this.deps.mouse === undefined) {
      throw new NativeAutomationError('Visual window button strategy requires image finder and native mouse dependencies.');
    }
    const padding = options.searchRegionPaddingPx ?? 96;
    const searchRegion: NativeRegion = {
      x: region.x,
      y: region.y,
      width: Math.min(region.width, padding),
      height: Math.min(region.height, padding)
    };
    const imageOptions: { searchRegion: NativeRegion; timeoutMs?: number; intervalMs?: number } = { searchRegion };
    if (options.timeoutMs !== undefined) imageOptions.timeoutMs = options.timeoutMs;
    if (options.intervalMs !== undefined) imageOptions.intervalMs = options.intervalMs;
    const match = await this.deps.images.waitForTemplate(template, imageOptions);
    await this.deps.mouse.click(centerOf(match.region));
  }
}
