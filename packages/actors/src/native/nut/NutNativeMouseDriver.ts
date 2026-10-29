import type { NativeMouseDriver } from '../drivers.js';
import type { NativeMouseButton, NativePoint } from '../types.js';
import { loadNut } from './loadNut.js';

function buttonName(button: NativeMouseButton): string {
  if (button === 'left') return 'LEFT';
  if (button === 'right') return 'RIGHT';
  return 'MIDDLE';
}

export class NutNativeMouseDriver implements NativeMouseDriver {
  async getPosition(): Promise<NativePoint> {
    const nut = await loadNut();
    return nut.mouse.getPosition();
  }

  async move(point: NativePoint): Promise<void> {
    const nut = await loadNut();
    await nut.mouse.move(nut.straightTo({ x: point.x, y: point.y }));
  }

  async click(button: NativeMouseButton): Promise<void> {
    const nut = await loadNut();
    const nutButton = nut.Button?.[buttonName(button)] ?? button;
    await nut.mouse.click(nutButton);
  }
}
