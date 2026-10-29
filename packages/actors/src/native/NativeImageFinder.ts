import type { NativeImageFinder, NativeImageMatch, NativeImageSearchOptions, NativeTemplateRef } from './types.js';
import { NativeImageNotFoundError } from './errors.js';
import { waitFor } from './utils/waitFor.js';

export interface NativeImageFinderDriver {
  findTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch | null>;
}

export class DefaultNativeImageFinder implements NativeImageFinder {
  constructor(private readonly driver: NativeImageFinderDriver, private readonly defaultTimeoutMs = 15_000) {}

  async findTemplate(template: string | NativeTemplateRef, options?: NativeImageSearchOptions): Promise<NativeImageMatch | null> {
    return this.driver.findTemplate(template, options);
  }

  async waitForTemplate(template: string | NativeTemplateRef, options: NativeImageSearchOptions = {}): Promise<NativeImageMatch> {
    try {
      return await waitFor(
        () => this.findTemplate(template, options),
        {
          timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
          intervalMs: options.intervalMs ?? 100,
          description: `native image template ${typeof template === 'string' ? template : template.name}`
        }
      );
    } catch (error) {
      throw new NativeImageNotFoundError({
        template: typeof template === 'string' ? template : template.name,
        cause: error
      });
    }
  }
}
