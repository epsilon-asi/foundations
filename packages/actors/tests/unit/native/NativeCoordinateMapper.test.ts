import { describe, expect, it } from 'vitest';
import type { HTTPResponse, WaitForOptions, WaitForSelectorOptions } from 'puppeteer-core';
import { ImageBasedCoordinateMapper } from '../../../src/native/NativeCoordinateMapper.js';
import { CoordinateCalibrationError } from '../../../src/native/errors.js';
import type { BrowserViewportSnapshot, NativeImageFinder, NativeImageMatch, NativeImageSearchOptions, NativeTemplateRef } from '../../../src/native/types.js';
import type { KeyboardLike, PageLike } from '../../../src/browser/PuppeteerLike.js';

class CalibrationPage implements PageLike {
  keyboard: KeyboardLike = { type: async () => undefined, press: async () => undefined };
  evaluates: string[] = [];
  screenshots: Record<string, unknown>[] = [];
  removedMarkers = 0;
  viewport: BrowserViewportSnapshot = {
    screenX: 0,
    screenY: 0,
    outerWidth: 1000,
    outerHeight: 900,
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1
  };

  async goto(_url: string, _options?: WaitForOptions): Promise<HTTPResponse | null> { return null; }
  async waitForSelector(_selector: string, _options?: WaitForSelectorOptions): Promise<unknown> { return {}; }
  async waitForNavigation(_options?: WaitForOptions): Promise<HTTPResponse | null> { return null; }
  async click(_selector: string): Promise<void> {}
  async focus(_selector: string): Promise<void> {}
  async close(): Promise<void> {}
  async $eval<T>(_selector: string, _pageFunction: (element: Element, ...args: unknown[]) => T, ..._args: unknown[]): Promise<T> { throw new Error('not used'); }
  async $$eval<T>(_selector: string, _pageFunction: (elements: Element[], ...args: unknown[]) => T, ..._args: unknown[]): Promise<T> { throw new Error('not used'); }
  async evaluate<T>(pageFunction: (...args: unknown[]) => T, ...args: unknown[]): Promise<T> {
    const source = pageFunction.toString();
    this.evaluates.push(source);
    if (source.includes('screenX')) return this.viewport as T;
    if (args.length === 0 && source.includes('__paf_native_coordinate_markers__') && source.includes('remove')) this.removedMarkers += 1;
    return undefined as T;
  }
  url(): string { return 'https://example.com'; }
  async title(): Promise<string> { return 'Example'; }
  async content(): Promise<string> { return '<html></html>'; }
  async screenshot(options?: Record<string, unknown>): Promise<Uint8Array> {
    this.screenshots.push(options ?? {});
    return new Uint8Array([1, 2, 3]);
  }
}

class StaticImageFinder implements NativeImageFinder {
  constructor(private readonly matches: Record<string, NativeImageMatch>) {}
  async findTemplate(template: string | NativeTemplateRef, _options?: NativeImageSearchOptions): Promise<NativeImageMatch | null> {
    return this.matches[typeof template === 'string' ? template : template.name] ?? null;
  }
  async waitForTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch> {
    const match = await this.findTemplate(template, options);
    if (match === null) throw new Error('missing match');
    return match;
  }
}

describe('ImageBasedCoordinateMapper', () => {
  it('calibrates offset and scale from two screen marker matches', async () => {
    const page = new CalibrationPage();
    const mapper = new ImageBasedCoordinateMapper({
      images: new StaticImageFinder({
        'paf-native-calibration-a.png': { region: { x: 211, y: 321, width: 22, height: 22 } },
        'paf-native-calibration-b.png': { region: { x: 511, y: 521, width: 22, height: 22 } }
      })
    });

    const transform = await mapper.calibrate(page);

    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
    expect(transform.offsetX).toBe(91);
    expect(transform.offsetY).toBe(201);
    await expect(mapper.browserToScreen({ x: 10, y: 20 })).resolves.toEqual({ x: 101, y: 221 });
    await expect(mapper.screenToBrowser({ x: 101, y: 221 })).resolves.toEqual({ x: 10, y: 20 });
    expect(page.screenshots).toHaveLength(2);
    expect(page.removedMarkers).toBe(1);
  });

  it('removes markers and rejects implausible scale values', async () => {
    const page = new CalibrationPage();
    const mapper = new ImageBasedCoordinateMapper({
      images: new StaticImageFinder({
        'paf-native-calibration-a.png': { region: { x: 0, y: 0, width: 22, height: 22 } },
        'paf-native-calibration-b.png': { region: { x: 2000, y: 2000, width: 22, height: 22 } }
      })
    });

    await expect(mapper.calibrate(page)).rejects.toBeInstanceOf(CoordinateCalibrationError);
    expect(page.removedMarkers).toBe(1);
  });
});
