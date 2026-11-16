export type ControlAction = 'forward' | 'backward' | 'left' | 'right' | 'reload' | 'interact' | 'swap' | 'frag' | 'flash' | 'fire';
export type ControlBindings = Record<ControlAction, string>;

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = {
  forward: 'KeyZ',
  backward: 'KeyS',
  left: 'KeyQ',
  right: 'KeyD',
  reload: 'KeyR',
  interact: 'KeyE',
  swap: 'KeyF',
  frag: 'KeyG',
  flash: 'KeyV',
  fire: 'Space',
};

export const DEFAULT_MOUSE_SENSITIVITY = 1;
const STORAGE_KEY = 'breachpoint-game-controls';

export interface GameControlsSettings {
  sensitivity: number;
  bindings: ControlBindings;
  version?: number;
}

export function loadGameControls(): GameControlsSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<GameControlsSettings> | null;
    const bindings = { ...DEFAULT_CONTROL_BINDINGS, ...(saved?.bindings || {}) };
    // Migration: les anciennes touches de déplacement reviennent une seule fois en ZQSD.
    if (saved?.version !== 2) {
      bindings.forward = 'KeyZ';
      bindings.backward = 'KeyS';
      bindings.left = 'KeyQ';
      bindings.right = 'KeyD';
    }
    return {
      sensitivity: typeof saved?.sensitivity === 'number' ? Math.max(0.25, Math.min(3, saved.sensitivity)) : DEFAULT_MOUSE_SENSITIVITY,
      bindings,
      version: 2,
    };
  } catch {
    return { sensitivity: DEFAULT_MOUSE_SENSITIVITY, bindings: { ...DEFAULT_CONTROL_BINDINGS }, version: 2 };
  }
}

export function saveGameControls(settings: GameControlsSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: 2 })); } catch { /* stockage indisponible */ }
}
