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
}

export function loadGameControls(): GameControlsSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<GameControlsSettings> | null;
    return {
      sensitivity: typeof saved?.sensitivity === 'number' ? Math.max(0.25, Math.min(3, saved.sensitivity)) : DEFAULT_MOUSE_SENSITIVITY,
      bindings: { ...DEFAULT_CONTROL_BINDINGS, ...(saved?.bindings || {}) },
    };
  } catch {
    return { sensitivity: DEFAULT_MOUSE_SENSITIVITY, bindings: { ...DEFAULT_CONTROL_BINDINGS } };
  }
}

export function saveGameControls(settings: GameControlsSettings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* stockage indisponible */ }
}
