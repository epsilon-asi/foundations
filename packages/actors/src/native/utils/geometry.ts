import type { NativePoint, NativeRegion } from '../types.js';

export function centerOf(region: NativeRegion): NativePoint {
  return {
    x: region.x + region.width / 2,
    y: region.y + region.height / 2
  };
}

export function normalizeRegion(region: NativeRegion): NativeRegion {
  return {
    x: region.x,
    y: region.y,
    width: Math.max(0, region.width),
    height: Math.max(0, region.height)
  };
}

export function isPointInsideRegion(point: NativePoint, region: NativeRegion): boolean {
  return point.x >= region.x
    && point.x <= region.x + region.width
    && point.y >= region.y
    && point.y <= region.y + region.height;
}

export function clampPointToRegion(point: NativePoint, region: NativeRegion): NativePoint {
  return {
    x: Math.min(Math.max(point.x, region.x), region.x + region.width),
    y: Math.min(Math.max(point.y, region.y), region.y + region.height)
  };
}

export function paddedRegion(region: NativeRegion, paddingPx: number): NativeRegion {
  const x = region.x + paddingPx;
  const y = region.y + paddingPx;
  return normalizeRegion({
    x,
    y,
    width: region.width - paddingPx * 2,
    height: region.height - paddingPx * 2
  });
}

export function intersects(a: NativeRegion, b: NativeRegion): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

export function intersection(a: NativeRegion, b: NativeRegion): NativeRegion {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return normalizeRegion({
    x,
    y,
    width: right - x,
    height: bottom - y
  });
}

export function visibleEnough(region: NativeRegion, viewport: NativeRegion, minimumWidth: number, minimumHeight: number): boolean {
  if (!intersects(region, viewport)) return false;
  const visible = intersection(region, viewport);
  return visible.width >= Math.min(region.width, minimumWidth) && visible.height >= Math.min(region.height, minimumHeight);
}

export function randomPointInRegion(region: NativeRegion, random: () => number, paddingPx = 0): NativePoint {
  const safe = paddedRegion(region, paddingPx);
  if (safe.width <= 0 || safe.height <= 0) {
    return centerOf(region);
  }

  return {
    x: safe.x + random() * safe.width,
    y: safe.y + random() * safe.height
  };
}

export function roundPoint(point: NativePoint): NativePoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y)
  };
}
