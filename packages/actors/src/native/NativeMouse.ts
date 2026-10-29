import { path as ghostCursorPath } from 'ghost-cursor';
import type { PageLike } from '../browser/PuppeteerLike.js';
import type { NativeMouseDriver } from './drivers.js';
import type {
  BrowserPoint,
  NativeMouse,
  NativeMouseClickOptions,
  NativeMouseMoveOptions,
  NativePoint,
  NativeRegion,
  ScreenPoint
} from './types.js';
import { centerOf, clampPointToRegion, randomPointInRegion, roundPoint } from './utils/geometry.js';

export type NativeRandomFunction = () => number;
export type NativeSleepFunction = (ms: number) => Promise<void>;
export type PathGenerator = (from: NativePoint, to: NativePoint, options?: { moveSpeed?: number }) => NativePoint[];

export interface HumanizedNativeMouseOptions {
  jitterPixels?: number;
  minJitterPixels?: number;
  moveSpeed?: number;
  random?: NativeRandomFunction;
  sleep?: NativeSleepFunction;
  pathGenerator?: PathGenerator;
  coordinateMapper: {
    browserToScreen(point: BrowserPoint, options?: { page?: PageLike }): Promise<ScreenPoint>;
  };
}

const defaultSleep: NativeSleepFunction = async ms => {
  if (ms <= 0) return;
  await new Promise<void>(resolve => setTimeout(resolve, ms));
};

function defaultPathGenerator(from: NativePoint, to: NativePoint, options?: { moveSpeed?: number }): NativePoint[] {
  const pathOptions = options?.moveSpeed === undefined ? undefined : { moveSpeed: options.moveSpeed };
  return ghostCursorPath(from, to, pathOptions) as NativePoint[];
}

function normalizeJitter(minJitterPixels: number | undefined, jitterPixels: number | undefined): { min: number; max: number } {
  const max = Math.max(0, jitterPixels ?? 3);
  const min = Math.min(max, Math.max(0, minJitterPixels ?? Math.min(2, max)));
  return { min, max };
}

export class HumanizedNativeMouse implements NativeMouse {
  private readonly random: NativeRandomFunction;
  private readonly sleep: NativeSleepFunction;
  private readonly pathGenerator: PathGenerator;
  private readonly jitterPixels: number;
  private readonly minJitterPixels: number;
  private readonly moveSpeed: number | undefined;

  constructor(private readonly driver: NativeMouseDriver, private readonly options: HumanizedNativeMouseOptions) {
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
    this.pathGenerator = options.pathGenerator ?? defaultPathGenerator;
    this.jitterPixels = options.jitterPixels ?? 3;
    this.minJitterPixels = options.minJitterPixels ?? 2;
    this.moveSpeed = options.moveSpeed;
  }

  async moveTo(point: ScreenPoint, options: NativeMouseMoveOptions = {}): Promise<void> {
    const current = await this.driver.getPosition();
    const target = roundPoint(this.applyJitter(point, options));

    if (options.disableHumanPath === true) {
      await this.driver.move(target);
      return;
    }

    const moveSpeed = options.moveSpeed ?? this.moveSpeed;
    const route = this.pathGenerator(current, target, moveSpeed === undefined ? undefined : { moveSpeed });
    const points = route.length === 0 ? [target] : route;

    for (const [index, routePoint] of points.entries()) {
      const isLast = index === points.length - 1;
      const nextPoint = isLast ? target : roundPoint(this.applyJitter(routePoint, options));
      await this.driver.move(nextPoint);
    }
  }

  async click(point: ScreenPoint, options: NativeMouseClickOptions = {}): Promise<void> {
    await this.moveTo(point, options);
    await this.sleep(options.delayBeforeClickMs ?? 0);
    await this.driver.click(options.button ?? 'left');
    await this.sleep(options.delayAfterMoveMs ?? 0);
  }

  async clickRegion(region: NativeRegion, options: NativeMouseClickOptions = {}): Promise<void> {
    const padding = options.regionPaddingPx ?? 4;
    const point = randomPointInRegion(region, this.random, padding);
    const target = options.precise === true ? point : clampPointToRegion(this.applyJitter(point, options), region);
    await this.click(roundPoint(target), { ...options, precise: true });
  }

  async clickBrowserPoint(page: PageLike, point: BrowserPoint, options: NativeMouseClickOptions = {}): Promise<void> {
    const screenPoint = await this.options.coordinateMapper.browserToScreen(point, { page });
    await this.click(screenPoint, options);
  }

  private applyJitter(point: NativePoint, options: NativeMouseMoveOptions): NativePoint {
    if (options.precise === true) return point;

    const { min, max } = normalizeJitter(options.minJitterPixels ?? this.minJitterPixels, options.jitterPixels ?? this.jitterPixels);
    if (max <= 0) return point;

    const distance = min + this.random() * (max - min);
    const angle = this.random() * Math.PI * 2;
    return {
      x: point.x + Math.cos(angle) * distance,
      y: point.y + Math.sin(angle) * distance
    };
  }
}
