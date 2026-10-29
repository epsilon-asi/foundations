import type { NativeScreenDriver } from '../drivers.js';
import { loadNut } from './loadNut.js';

export class NutNativeScreenDriver implements NativeScreenDriver {
  async width(): Promise<number> {
    const nut = await loadNut();
    return nut.screen.width();
  }

  async height(): Promise<number> {
    const nut = await loadNut();
    return nut.screen.height();
  }
}
