import { describe, expect, it } from 'vitest';
import { DefaultNativeWindowService } from '../../../src/native/NativeWindowService.js';
import type { NativeScreenDriver, NativeWindowDriver, NativeWindowHandle } from '../../../src/native/drivers.js';
import type { NativePoint, NativeSize, NativeWindowInfo } from '../../../src/native/types.js';

class FakeWindowHandle implements NativeWindowHandle {
  focusCalls = 0;
  minimizeCalls = 0;
  restoreCalls = 0;
  moveCalls: NativePoint[] = [];
  resizeCalls: NativeSize[] = [];
  setFullscreenCalls: boolean[] = [];
  toggleFullscreenCalls = 0;

  constructor(private current: NativeWindowInfo) {}

  async info(): Promise<NativeWindowInfo> { return this.current; }
  async focus(): Promise<void> { this.focusCalls += 1; this.current = { ...this.current, isFocused: true }; }
  async minimize(): Promise<void> { this.minimizeCalls += 1; this.current = { ...this.current, isMinimized: true }; }
  async restore(): Promise<void> { this.restoreCalls += 1; this.current = { ...this.current, isMinimized: false }; }
  async move(point: NativePoint): Promise<void> { this.moveCalls.push(point); this.current = { ...this.current, region: { ...this.current.region, ...point } }; }
  async resize(size: NativeSize): Promise<void> { this.resizeCalls.push(size); this.current = { ...this.current, region: { ...this.current.region, ...size } }; }
  async setFullscreen(fullscreen: boolean): Promise<void> { this.setFullscreenCalls.push(fullscreen); this.current = { ...this.current, isFullscreen: fullscreen }; }
  async toggleFullscreen(): Promise<void> { this.toggleFullscreenCalls += 1; }
}

class FakeWindowDriver implements NativeWindowDriver {
  constructor(readonly handles: FakeWindowHandle[]) {}
  async list(): Promise<NativeWindowHandle[]> { return this.handles; }
}

class FakeScreenDriver implements NativeScreenDriver {
  async width(): Promise<number> { return 500; }
  async height(): Promise<number> { return 400; }
}

describe('DefaultNativeWindowService', () => {
  it('detects whether a matching window is open', async () => {
    const handle = new FakeWindowHandle({ title: 'Upwork', appName: 'Google Chrome', region: { x: 0, y: 0, width: 100, height: 100 } });
    const service = new DefaultNativeWindowService({ driver: new FakeWindowDriver([handle]), screen: new FakeScreenDriver() });

    await expect(service.isOpen({ title: 'Upwork' })).resolves.toBe(true);
    await expect(service.isOpen({ title: 'Other' })).resolves.toBe(false);
  });

  it('restores, focuses, and moves an off-screen window into view', async () => {
    const handle = new FakeWindowHandle({ title: 'Chrome', isMinimized: true, region: { x: -900, y: -800, width: 200, height: 150 } });
    const service = new DefaultNativeWindowService({ driver: new FakeWindowDriver([handle]), screen: new FakeScreenDriver() });

    const info = await service.ensureInView({ title: 'Chrome' });

    expect(handle.restoreCalls).toBe(1);
    expect(handle.focusCalls).toBe(1);
    expect(handle.moveCalls).toEqual([{ x: 0, y: 0 }]);
    expect(info.region).toMatchObject({ x: 0, y: 0 });
  });

  it('does not toggle fullscreen when the requested state already matches', async () => {
    const handle = new FakeWindowHandle({ title: 'Chrome', isFullscreen: true, region: { x: 0, y: 0, width: 500, height: 400 } });
    const service = new DefaultNativeWindowService({ driver: new FakeWindowDriver([handle]), screen: new FakeScreenDriver() });

    await service.setFullscreen({ title: 'Chrome' }, true);

    expect(handle.setFullscreenCalls).toEqual([]);
    expect(handle.toggleFullscreenCalls).toBe(0);
  });

  it('sets fullscreen through the handle when state differs', async () => {
    const handle = new FakeWindowHandle({ title: 'Chrome', isFullscreen: false, region: { x: 0, y: 0, width: 500, height: 400 } });
    const service = new DefaultNativeWindowService({ driver: new FakeWindowDriver([handle]), screen: new FakeScreenDriver() });

    await service.setFullscreen({ title: 'Chrome' }, true);

    expect(handle.setFullscreenCalls).toEqual([true]);
  });

  it('minimizes via the native minimize operation instead of fullscreen toggle', async () => {
    const handle = new FakeWindowHandle({ title: 'Chrome', isFullscreen: true, region: { x: 0, y: 0, width: 500, height: 400 } });
    const service = new DefaultNativeWindowService({ driver: new FakeWindowDriver([handle]), screen: new FakeScreenDriver() });

    await service.minimize({ title: 'Chrome' });

    expect(handle.minimizeCalls).toBe(1);
    expect(handle.setFullscreenCalls).toEqual([]);
    expect(handle.toggleFullscreenCalls).toBe(0);
  });
});
