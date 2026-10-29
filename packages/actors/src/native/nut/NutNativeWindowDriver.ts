import type { NativeWindowDriver, NativeWindowHandle } from '../drivers.js';
import type { NativePoint, NativeRegion, NativeSize, NativeWindowInfo } from '../types.js';
import { loadNut, type NutRegion, type NutWindow } from './loadNut.js';

function toRegion(region: NutRegion): NativeRegion {
  return {
    x: region.left ?? region.x ?? 0,
    y: region.top ?? region.y ?? 0,
    width: region.width,
    height: region.height
  };
}

class NutNativeWindowHandle implements NativeWindowHandle {
  constructor(private readonly window: NutWindow) {}

  async info(): Promise<NativeWindowInfo> {
    const [title, region] = await Promise.all([
      Promise.resolve(this.window.title),
      Promise.resolve(this.window.region)
    ]);
    return {
      title,
      region: toRegion(region)
    };
  }

  async focus(): Promise<void> {
    await this.window.focus();
  }

  async minimize(): Promise<void> {
    await this.window.minimize();
  }

  async restore(): Promise<void> {
    await this.window.restore();
  }

  async move(point: NativePoint): Promise<void> {
    await this.window.move({ x: point.x, y: point.y });
  }

  async resize(size: NativeSize): Promise<void> {
    await this.window.resize(size);
  }
}

export class NutNativeWindowDriver implements NativeWindowDriver {
  async list(): Promise<NativeWindowHandle[]> {
    const nut = await loadNut();
    const windows = await nut.getWindows();
    return windows.map(window => new NutNativeWindowHandle(window));
  }

  async active(): Promise<NativeWindowHandle | null> {
    const nut = await loadNut();
    const window = await nut.getActiveWindow();
    return new NutNativeWindowHandle(window);
  }
}
