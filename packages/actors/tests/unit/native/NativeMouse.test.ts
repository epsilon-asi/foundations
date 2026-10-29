import { describe, expect, it } from 'vitest';
import { HumanizedNativeMouse } from '../../../src/native/NativeMouse.js';
import type { NativeMouseButton, NativePoint } from '../../../src/native/types.js';
import type { NativeMouseDriver } from '../../../src/native/drivers.js';

class FakeMouseDriver implements NativeMouseDriver {
  position: NativePoint = { x: 0, y: 0 };
  moves: NativePoint[] = [];
  clicks: NativeMouseButton[] = [];

  async getPosition(): Promise<NativePoint> {
    return this.position;
  }

  async move(point: NativePoint): Promise<void> {
    this.position = point;
    this.moves.push(point);
  }

  async click(button: NativeMouseButton): Promise<void> {
    this.clicks.push(button);
  }
}

describe('HumanizedNativeMouse', () => {
  it('moves through a ghost-cursor-style path and applies default 2-3px jitter', async () => {
    const driver = new FakeMouseDriver();
    const pathCalls: Array<{ from: NativePoint; to: NativePoint }> = [];
    const mouse = new HumanizedNativeMouse(driver, {
      coordinateMapper: { browserToScreen: async point => point },
      random: () => 0,
      pathGenerator: (from, to) => {
        pathCalls.push({ from, to });
        return [from, { x: 5, y: 5 }, to];
      }
    });

    await mouse.moveTo({ x: 10, y: 10 });

    expect(pathCalls).toEqual([{ from: { x: 0, y: 0 }, to: { x: 12, y: 10 } }]);
    expect(driver.moves).toEqual([
      { x: 2, y: 0 },
      { x: 7, y: 5 },
      { x: 12, y: 10 }
    ]);
  });

  it('clicks by moving first, then clicking the requested button', async () => {
    const driver = new FakeMouseDriver();
    const mouse = new HumanizedNativeMouse(driver, {
      coordinateMapper: { browserToScreen: async point => point },
      random: () => 0.5,
      pathGenerator: (_from, to) => [to]
    });

    await mouse.click({ x: 20, y: 30 }, { button: 'right', precise: true });

    expect(driver.moves).toEqual([{ x: 20, y: 30 }]);
    expect(driver.clicks).toEqual(['right']);
  });

  it('clamps jittered region clicks inside small regions', async () => {
    const driver = new FakeMouseDriver();
    const mouse = new HumanizedNativeMouse(driver, {
      coordinateMapper: { browserToScreen: async point => point },
      random: () => 0,
      pathGenerator: (_from, to) => [to]
    });

    await mouse.clickRegion({ x: 10, y: 10, width: 2, height: 2 }, { regionPaddingPx: 0 });

    const finalMove = driver.moves.at(-1);
    expect(finalMove?.x).toBeGreaterThanOrEqual(10);
    expect(finalMove?.x).toBeLessThanOrEqual(12);
    expect(finalMove?.y).toBeGreaterThanOrEqual(10);
    expect(finalMove?.y).toBeLessThanOrEqual(12);
    expect(driver.clicks).toEqual(['left']);
  });

  it('maps browser viewport points before native clicking', async () => {
    const driver = new FakeMouseDriver();
    const mouse = new HumanizedNativeMouse(driver, {
      coordinateMapper: { browserToScreen: async point => ({ x: point.x + 100, y: point.y + 200 }) },
      pathGenerator: (_from, to) => [to]
    });

    await mouse.clickBrowserPoint({} as never, { x: 5, y: 7 }, { precise: true });

    expect(driver.moves).toEqual([{ x: 105, y: 207 }]);
  });
});
