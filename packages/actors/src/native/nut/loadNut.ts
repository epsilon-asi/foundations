import { NativeDependencyError } from '../errors.js';

type DynamicImport = (specifier: string) => Promise<unknown>;

const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

export interface NutPoint {
  x: number;
  y: number;
}

export interface NutRegion {
  left?: number;
  top?: number;
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface NutWindow {
  title: Promise<string> | string;
  region: Promise<NutRegion> | NutRegion;
  focus(): Promise<void>;
  minimize(): Promise<void>;
  restore(): Promise<void>;
  move(point: NutPoint): Promise<void>;
  resize(size: { width: number; height: number }): Promise<void>;
}

export interface NutModule {
  mouse: {
    getPosition(): Promise<NutPoint>;
    move(path: unknown): Promise<void>;
    click(button: unknown): Promise<void>;
  };
  keyboard: {
    type(text: string): Promise<void>;
    pressKey(...keys: unknown[]): Promise<void>;
    releaseKey?(...keys: unknown[]): Promise<void>;
  };
  screen: {
    width(): Promise<number>;
    height(): Promise<number>;
    find?(resource: unknown, options?: unknown): Promise<NutRegion>;
    waitFor?(resource: unknown, timeoutMs?: number, intervalMs?: number): Promise<NutRegion>;
    config?: {
      confidence?: number;
      resourceDirectory?: string;
    };
  };
  getWindows(): Promise<NutWindow[]>;
  getActiveWindow(): Promise<NutWindow>;
  straightTo(point: NutPoint): unknown;
  imageResource?(path: string): unknown;
  Button?: Record<string, unknown>;
  Key?: Record<string, unknown>;
}

export interface NlMatcherModule {
  useNlMatcher(): void;
}

let nutModulePromise: Promise<NutModule> | null = null;
let nlMatcherLoaded = false;

export async function loadNut(): Promise<NutModule> {
  nutModulePromise ??= dynamicImport('@nut-tree/nut-js')
    .then(module => module as NutModule)
    .catch(error => {
      nutModulePromise = null;
      throw new NativeDependencyError('@nut-tree/nut-js', error);
    });
  return nutModulePromise;
}

export async function loadNlMatcher(): Promise<void> {
  if (nlMatcherLoaded) return;
  const module = await dynamicImport('@nut-tree/nl-matcher')
    .then(value => value as NlMatcherModule)
    .catch(error => {
      throw new NativeDependencyError('@nut-tree/nl-matcher', error);
    });
  module.useNlMatcher();
  nlMatcherLoaded = true;
}
