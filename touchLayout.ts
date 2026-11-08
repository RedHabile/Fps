import { type CSSProperties } from 'react';

export type TouchControl = 'move' | 'fire' | 'reload' | 'action' | 'pause' | 'swap' | 'frag' | 'flash';
export interface TouchPoint { x: number; y: number }
export type TouchLayout = Record<TouchControl, TouchPoint>;
export type TouchSizes = Record<TouchControl, number>;
export interface ViewportSize { width: number; height: number }

const KEY_V2 = 'breach-point-touch-v2';
const KEY_V1 = 'breach-point-touch-layout-v1';
export const TOUCH_CONTROLS: TouchControl[] = ['move', 'fire', 'reload', 'action', 'pause', 'swap', 'frag', 'flash'];
export const DEFAULT_TOUCH_SIZES: TouchSizes = {
  move: 1, fire: 1, reload: 1, action: 1, pause: 1, swap: 1, frag: 1, flash: 1,
};
export const TOUCH_SIZE_MIN = 0.7;
export const TOUCH_SIZE_MAX = 1.6;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function defaultTouchLayout(width: number, height: number): TouchLayout {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const compact = height <= 500 && width > 700;
  const shortScreenShift = width <= 420 && height <= 650 ? 18 : 0;
  const point = (x: number, y: number) => ({ x: clamp(x / width, 0, 1), y: clamp(y / height, 0, 1) });
  return compact ? {
    move: point(62, height - 104),
    fire: point(width - 51, height - 82),
    reload: point(width - 112, height - 84),
    action: point(width - 57, height - 140),
    swap: point(width - 168, height - 84),
    frag: point(width - 168, height - 140),
    flash: point(width - 224, height - 84),
    pause: point(width - 35, 26),
  } : {
    move: point(80, height - 138 - shortScreenShift),
    fire: point(width - 59, height - 120 - shortScreenShift),
    reload: point(width - 131, height - 134 - shortScreenShift),
    action: point(width - 66, height - 192 - shortScreenShift),
    swap: point(width - 192, height - 118 - shortScreenShift),
    frag: point(width - 66, height - 252 - shortScreenShift),
    flash: point(width - 131, height - 194 - shortScreenShift),
    pause: point(width - (width <= 700 ? 34 : 50), width <= 700 ? 30 : 40),
  };
}

function sanitizeSizes(value: unknown): TouchSizes {
  const sizes = { ...DEFAULT_TOUCH_SIZES };
  if (value && typeof value === 'object') {
    for (const id of TOUCH_CONTROLS) {
      const size = (value as Record<string, unknown>)[id];
      if (typeof size === 'number' && Number.isFinite(size)) sizes[id] = clamp(size, TOUCH_SIZE_MIN, TOUCH_SIZE_MAX);
    }
  }
  return sizes;
}

function sanitizeLayout(value: unknown): TouchLayout | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<TouchLayout>;
  if (!TOUCH_CONTROLS.every((id) => record[id] && Number.isFinite(record[id]?.x) && Number.isFinite(record[id]?.y))) return null;
  return Object.fromEntries(TOUCH_CONTROLS.map((id) => [id, { x: clamp(record[id]!.x, 0, 1), y: clamp(record[id]!.y, 0, 1) }])) as TouchLayout;
}

export interface TouchCustomization {
  positions: TouchLayout;
  sizes: TouchSizes;
}

export function loadTouchCustom(): TouchCustomization | null {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (raw) {
      const value = JSON.parse(raw) as { positions?: unknown; sizes?: unknown };
      const positions = sanitizeLayout(value.positions);
      if (positions) return { positions, sizes: sanitizeSizes(value.sizes) };
    }
    const legacy = localStorage.getItem(KEY_V1);
    if (legacy) {
      const value = JSON.parse(legacy) as Partial<TouchLayout>;
      const base = sanitizeLayout({ ...defaultTouchLayout(window.innerWidth, window.innerHeight), ...value });
      if (base) return { positions: base, sizes: { ...DEFAULT_TOUCH_SIZES } };
    }
  } catch {
    // Fall back to defaults when storage is unavailable.
  }
  return null;
}

export function saveTouchCustom(custom: TouchCustomization | null) {
  try {
    if (custom) localStorage.setItem(KEY_V2, JSON.stringify(custom));
    else {
      localStorage.removeItem(KEY_V2);
      localStorage.removeItem(KEY_V1);
    }
  } catch {
    // The current layout still works when local storage is unavailable.
  }
}

// Backwards-compatible helpers used during migration.
export function loadTouchLayout(): TouchLayout | null {
  return loadTouchCustom()?.positions ?? null;
}

export function saveTouchLayout(layout: TouchLayout | null) {
  if (!layout) saveTouchCustom(null);
  else saveTouchCustom({ positions: layout, sizes: { ...DEFAULT_TOUCH_SIZES } });
}

export function touchPosition(point: TouchPoint, radius: number, scale = 1): CSSProperties {
  const r = radius * scale;
  return {
    left: `clamp(calc(${r}px + env(safe-area-inset-left, 0px)), ${point.x * 100}%, calc(100% - ${r}px - env(safe-area-inset-right, 0px)))`,
    top: `clamp(calc(${r}px + env(safe-area-inset-top, 0px)), ${point.y * 100}%, calc(100% - ${r}px - env(safe-area-inset-bottom, 0px)))`,
    right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)',
  };
}
