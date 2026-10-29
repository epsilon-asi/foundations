import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { NativeImageFinderDriver } from '../NativeImageFinder.js';
import type { NativeImageMatch, NativeImageSearchOptions, NativeRegion, NativeTemplateRef } from '../types.js';
import { loadNlMatcher, loadNut, type NutRegion } from './loadNut.js';

export interface NutNativeImageFinderOptions {
  templatesDir?: string;
  confidence?: number;
  enableNlMatcher?: boolean;
}

function toRegion(region: NutRegion): NativeRegion {
  return {
    x: region.left ?? region.x ?? 0,
    y: region.top ?? region.y ?? 0,
    width: region.width,
    height: region.height
  };
}

function templateName(template: string | NativeTemplateRef): string {
  return typeof template === 'string' ? template : template.name;
}

export class NutNativeImageFinderDriver implements NativeImageFinderDriver {
  private initialized = false;

  constructor(private readonly options: NutNativeImageFinderOptions = {}) {}

  async findTemplate(template: string | NativeTemplateRef, options: NativeImageSearchOptions = {}): Promise<NativeImageMatch | null> {
    const nut = await this.initialize();
    if (nut.screen.find === undefined || nut.imageResource === undefined) {
      return null;
    }

    const resourcePath = await this.materializeTemplate(template);
    const searchOptions = this.buildSearchOptions(options);

    try {
      const region = await nut.screen.find(nut.imageResource(resourcePath), searchOptions);
      const match: NativeImageMatch = { region: toRegion(region) };
      if (options.confidence !== undefined) match.confidence = options.confidence;
      return match;
    } catch {
      return null;
    }
  }

  private async initialize() {
    const nut = await loadNut();
    if (!this.initialized) {
      if (this.options.enableNlMatcher ?? true) {
        await loadNlMatcher();
      }
      if (this.options.templatesDir !== undefined && nut.screen.config !== undefined) {
        nut.screen.config.resourceDirectory = this.options.templatesDir;
      }
      if (this.options.confidence !== undefined && nut.screen.config !== undefined) {
        nut.screen.config.confidence = this.options.confidence;
      }
      this.initialized = true;
    }
    return nut;
  }

  private buildSearchOptions(options: NativeImageSearchOptions): Record<string, unknown> | undefined {
    const searchOptions: Record<string, unknown> = {};
    if (options.searchRegion !== undefined) {
      searchOptions.searchRegion = {
        left: options.searchRegion.x,
        top: options.searchRegion.y,
        width: options.searchRegion.width,
        height: options.searchRegion.height
      };
    }
    if (options.confidence !== undefined) {
      searchOptions.confidence = options.confidence;
    }
    return Object.keys(searchOptions).length === 0 ? undefined : searchOptions;
  }

  private async materializeTemplate(template: string | NativeTemplateRef): Promise<string> {
    if (typeof template === 'string') {
      return this.options.templatesDir === undefined ? template : path.join(this.options.templatesDir, template);
    }

    if (template.buffer === undefined) {
      return this.options.templatesDir === undefined ? template.name : path.join(this.options.templatesDir, template.name);
    }

    const fileName = `${template.name.replace(/[^a-z0-9._-]/gi, '_')}`;
    const filePath = path.join(os.tmpdir(), fileName);
    await fs.writeFile(filePath, template.buffer);
    return filePath;
  }
}
