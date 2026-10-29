import type { NativeMouseDriver } from './drivers.js';
import type { NativeImageFinderDriver } from './NativeImageFinder.js';
import { NativeCapabilityUnavailableError } from './errors.js';
import type { NativeImageMatch, NativeImageSearchOptions, NativeMouseButton, NativePoint, NativeTemplateRef } from './types.js';

/**
 * Mouse driver for platforms where no native mouse backend is wired up.
 * Every call fails with a NativeCapabilityUnavailableError.
 */
export class UnavailableNativeMouseDriver implements NativeMouseDriver {
  async getPosition(): Promise<NativePoint> { throw new NativeCapabilityUnavailableError('mouse'); }
  async move(_point: NativePoint): Promise<void> { throw new NativeCapabilityUnavailableError('mouse'); }
  async click(_button: NativeMouseButton): Promise<void> { throw new NativeCapabilityUnavailableError('mouse'); }
}

/**
 * Image finder driver for platforms where no on-screen template matching backend is wired up.
 */
export class UnavailableNativeImageFinderDriver implements NativeImageFinderDriver {
  async findTemplate(_template: string | NativeTemplateRef, _options?: NativeImageSearchOptions): Promise<NativeImageMatch | null> {
    throw new NativeCapabilityUnavailableError('image search');
  }
}
