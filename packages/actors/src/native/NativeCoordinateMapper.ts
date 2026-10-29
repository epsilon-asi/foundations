import type { PageLike } from '../browser/PuppeteerLike.js';
import type { Logger } from '../logging/Logger.js';
import type {
  BrowserPoint,
  BrowserViewportSnapshot,
  CalibrationOptions,
  CoordinateMapOptions,
  CoordinateTransform,
  NativeCoordinateMapper,
  NativeImageFinder,
  NativeTemplateRef,
  NativeWindowService,
  ScreenPoint
} from './types.js';
import { CoordinateCalibrationError } from './errors.js';
import { centerOf } from './utils/geometry.js';

interface MarkerSpec {
  id: string;
  point: BrowserPoint;
  size: number;
  color: string;
}

interface MarkerInstallPayload {
  markers: MarkerSpec[];
}

export interface ImageBasedCoordinateMapperOptions {
  images: NativeImageFinder;
  windows?: NativeWindowService;
  logger?: Logger;
  defaultTimeoutMs?: number;
  defaultCacheTtlMs?: number;
}

const DEFAULT_MARKER_A: BrowserPoint = { x: 120, y: 120 };
const DEFAULT_MARKER_B: BrowserPoint = { x: 420, y: 320 };
const DEFAULT_MARKER_SIZE = 22;

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new CoordinateCalibrationError(`Coordinate calibration produced a non-finite ${name}.`, { [name]: value });
  }
}

async function getViewportSnapshot(page: PageLike): Promise<BrowserViewportSnapshot> {
  return page.evaluate<BrowserViewportSnapshot>(() => {
    const view = globalThis.window;
    return {
      screenX: view.screenX,
      screenY: view.screenY,
      outerWidth: view.outerWidth,
      outerHeight: view.outerHeight,
      innerWidth: view.innerWidth,
      innerHeight: view.innerHeight,
      devicePixelRatio: view.devicePixelRatio
    };
  });
}

async function installMarkers(page: PageLike, markers: MarkerSpec[]): Promise<void> {
  const payload: MarkerInstallPayload = { markers };
  await page.evaluate<void>((rawPayload: unknown) => {
    const { markers: markerSpecs } = rawPayload as MarkerInstallPayload;
    const existing = document.getElementById('__paf_native_coordinate_markers__');
    existing?.remove();

    const root = document.createElement('div');
    root.id = '__paf_native_coordinate_markers__';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '0';
    root.style.height = '0';
    root.style.zIndex = '2147483647';
    root.style.pointerEvents = 'none';

    for (const marker of markerSpecs) {
      const element = document.createElement('div');
      element.id = marker.id;
      element.setAttribute('data-paf-native-calibration-marker', marker.id);
      element.style.position = 'fixed';
      element.style.left = `${marker.point.x}px`;
      element.style.top = `${marker.point.y}px`;
      element.style.width = `${marker.size}px`;
      element.style.height = `${marker.size}px`;
      element.style.background = marker.color;
      element.style.border = '3px solid #000';
      element.style.boxSizing = 'border-box';
      element.style.boxShadow = '0 0 0 2px #fff';
      root.appendChild(element);
    }

    document.documentElement.appendChild(root);
  }, payload);
}

async function removeMarkers(page: PageLike): Promise<void> {
  await page.evaluate<void>(() => {
    document.getElementById('__paf_native_coordinate_markers__')?.remove();
  });
}

async function captureMarkerTemplate(page: PageLike, marker: MarkerSpec): Promise<NativeTemplateRef> {
  const margin = 8;
  const screenshot = await page.screenshot({
    type: 'png',
    clip: {
      x: marker.point.x - margin,
      y: marker.point.y - margin,
      width: marker.size + margin * 2,
      height: marker.size + margin * 2
    }
  });

  if (typeof screenshot === 'string') {
    return { name: `${marker.id}.png`, buffer: Buffer.from(screenshot, 'base64') };
  }

  return { name: `${marker.id}.png`, buffer: screenshot };
}

export class ImageBasedCoordinateMapper implements NativeCoordinateMapper {
  private cached: CoordinateTransform | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly options: ImageBasedCoordinateMapperOptions) {}

  async calibrate(page: PageLike, options: CalibrationOptions = {}): Promise<CoordinateTransform> {
    const markerSize = options.markerSizePx ?? DEFAULT_MARKER_SIZE;
    const markerA: MarkerSpec = {
      id: 'paf-native-calibration-a',
      point: options.markerA ?? DEFAULT_MARKER_A,
      size: markerSize,
      color: '#ff00ff'
    };
    const markerB: MarkerSpec = {
      id: 'paf-native-calibration-b',
      point: options.markerB ?? DEFAULT_MARKER_B,
      size: markerSize,
      color: '#00ffff'
    };

    await installMarkers(page, [markerA, markerB]);

    try {
      const viewport = await getViewportSnapshot(page);
      const [templateA, templateB] = await Promise.all([
        captureMarkerTemplate(page, markerA),
        captureMarkerTemplate(page, markerB)
      ]);

      const imageOptions: { timeoutMs?: number; intervalMs?: number } = {};
      const timeoutMs = options.timeoutMs ?? this.options.defaultTimeoutMs;
      if (timeoutMs !== undefined) imageOptions.timeoutMs = timeoutMs;
      if (options.intervalMs !== undefined) imageOptions.intervalMs = options.intervalMs;

      const [matchA, matchB] = await Promise.all([
        this.options.images.waitForTemplate(templateA, imageOptions),
        this.options.images.waitForTemplate(templateB, imageOptions)
      ]);

      const screenA = centerOf(matchA.region);
      const screenB = centerOf(matchB.region);
      const browserA = {
        x: markerA.point.x + markerA.size / 2,
        y: markerA.point.y + markerA.size / 2
      };
      const browserB = {
        x: markerB.point.x + markerB.size / 2,
        y: markerB.point.y + markerB.size / 2
      };

      const scaleX = (screenB.x - screenA.x) / (browserB.x - browserA.x);
      const scaleY = (screenB.y - screenA.y) / (browserB.y - browserA.y);
      const offsetX = screenA.x - scaleX * browserA.x;
      const offsetY = screenA.y - scaleY * browserA.y;

      this.validateTransform({ offsetX, offsetY, scaleX, scaleY }, viewport);

      const transform: CoordinateTransform = {
        offsetX,
        offsetY,
        scaleX,
        scaleY,
        calibratedAt: Date.now(),
        viewport: {
          innerWidth: viewport.innerWidth,
          innerHeight: viewport.innerHeight,
          devicePixelRatio: viewport.devicePixelRatio
        }
      };

      if (this.options.windows !== undefined && options.windowMatcher !== undefined) {
        const window = await this.options.windows.find(options.windowMatcher);
        if (window !== null) transform.window = window;
      }

      this.cached = transform;
      this.cacheExpiresAt = transform.calibratedAt + (options.cacheTtlMs ?? this.options.defaultCacheTtlMs ?? 60_000);
      return transform;
    } finally {
      await removeMarkers(page).catch(error => {
        this.options.logger?.warn('Failed to remove native coordinate calibration markers.', { error });
      });
    }
  }

  async browserToScreen(point: BrowserPoint, options: CoordinateMapOptions = {}): Promise<ScreenPoint> {
    const transform = await this.getTransform(options);
    return {
      x: transform.offsetX + transform.scaleX * point.x,
      y: transform.offsetY + transform.scaleY * point.y
    };
  }

  async screenToBrowser(point: ScreenPoint, options: CoordinateMapOptions = {}): Promise<BrowserPoint> {
    const transform = await this.getTransform(options);
    return {
      x: (point.x - transform.offsetX) / transform.scaleX,
      y: (point.y - transform.offsetY) / transform.scaleY
    };
  }

  invalidate(): void {
    this.cached = null;
    this.cacheExpiresAt = 0;
  }

  private async getTransform(options: CoordinateMapOptions): Promise<CoordinateTransform> {
    const useCache = options.useCache ?? true;
    if (useCache && this.cached !== null && Date.now() < this.cacheExpiresAt) {
      return this.cached;
    }

    if (options.page === undefined) {
      throw new CoordinateCalibrationError('Coordinate mapping requires a calibrated transform or a page for calibration.');
    }

    return this.calibrate(options.page);
  }

  private validateTransform(transform: Pick<CoordinateTransform, 'offsetX' | 'offsetY' | 'scaleX' | 'scaleY'>, viewport: BrowserViewportSnapshot): void {
    assertFinite(transform.offsetX, 'offsetX');
    assertFinite(transform.offsetY, 'offsetY');
    assertFinite(transform.scaleX, 'scaleX');
    assertFinite(transform.scaleY, 'scaleY');

    if (transform.scaleX < 0.5 || transform.scaleX > 3.5 || transform.scaleY < 0.5 || transform.scaleY > 3.5) {
      throw new CoordinateCalibrationError('Coordinate calibration produced an implausible scale.', {
        scaleX: transform.scaleX,
        scaleY: transform.scaleY,
        viewport
      });
    }
  }
}
