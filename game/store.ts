// ─────────────────────────────────────────────────────────────
//  VALENCE — Store partagé entre le moteur Three.js et le HUD React
// ─────────────────────────────────────────────────────────────

export type WeaponId =
  | 'classic' | 'frenzy' | 'ghost' | 'sheriff'
  | 'carnage' | 'marshal' | 'spectre' | 'guardian'
  | 'vandal' | 'fantasma' | 'odin' | 'operator';

export type MapId = 'souk' | 'cryo' | 'neon' | 'bunker';
export type Phase = 'none' | 'buy' | 'live' | 'roundEnd' | 'halftime' | 'matchEnd';
/** camp du joueur pour la manche en cours */
export type Side = 'attack' | 'defense';
/** état du Spike */
export type SpikeState = 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded';
export type Screen = 'menu' | 'game';

export interface FeedItem {
  id: number;
  killer: string;
  victim: string;
  headshot: boolean;
  mine: boolean;
  ts: number;
}

export interface Banner {
  title: string;
  sub?: string;
  kind: 'win' | 'lose' | 'info';
  key: number;
}

export interface CrosshairCfg {
  color: string;
  length: number;      // px
  thickness: number;   // px
  gap: number;         // px
  dot: boolean;
  outline: boolean;
  dynamic: boolean;    // s'ouvre avec la dispersion
}

/** Un bouton tactile repositionnable. x/y en % de l'écran, depuis le coin indiqué. */
export interface PadButton {
  x: number;        // 0..100 (% largeur)
  y: number;        // 0..100 (% hauteur)
  size: number;     // diamètre en px
  on: boolean;      // affiché ou non
}
export type PadId = 'fire' | 'ads' | 'jump' | 'crouch' | 'walk' | 'reload' | 'swap' | 'shop' | 'use' | 'pause' | 'stick' | 'abQ' | 'abX';

export const PAD_META: { id: PadId; label: string; hint: string; fixed?: boolean }[] = [
  { id: 'stick', label: 'JOYSTICK', hint: 'Zone de déplacement' },
  { id: 'fire', label: 'FEU', hint: 'Tirer' },
  { id: 'ads', label: 'VISÉE', hint: 'Viser / lunette' },
  { id: 'use', label: 'SPIKE', hint: 'Poser / désamorcer' },
  { id: 'abQ', label: 'POUVOIR', hint: 'Pouvoir principal' },
  { id: 'abX', label: 'ULTIME', hint: 'Pouvoir ultime' },
  { id: 'jump', label: 'SAUT', hint: 'Sauter' },
  { id: 'crouch', label: 'ACCR.', hint: 'S\'accroupir' },
  { id: 'walk', label: 'LENT', hint: 'Pas feutrés' },
  { id: 'reload', label: 'RECH.', hint: 'Recharger' },
  { id: 'swap', label: 'ARME', hint: 'Changer d\'arme' },
  { id: 'shop', label: 'BOUTIQUE', hint: 'Ouvrir la boutique' },
  { id: 'pause', label: 'PAUSE', hint: 'Menu pause' },
];

export type PadLayout = Record<PadId, PadButton>;

export const DEFAULT_PAD: PadLayout = {
  stick:  { x: 17, y: 74, size: 124, on: true },
  fire:   { x: 87, y: 76, size: 94, on: true },
  ads:    { x: 71, y: 60, size: 56, on: true },
  use:    { x: 71, y: 88, size: 66, on: true },
  jump:   { x: 87, y: 52, size: 56, on: true },
  crouch: { x: 38, y: 89, size: 48, on: true },
  walk:   { x: 38, y: 70, size: 48, on: true },
  reload: { x: 96, y: 40, size: 48, on: true },
  swap:   { x: 96, y: 25, size: 48, on: true },
  shop:   { x: 85, y: 28, size: 56, on: true },
  pause:  { x: 50, y: 94, size: 38, on: true },
  abQ:    { x: 60, y: 90, size: 52, on: true },
  abX:    { x: 69, y: 76, size: 52, on: true },
};

export interface Settings {
  sensitivity: number;   // 0.15 – 2.5
  adsSens: number;       // multiplicateur en visée 0.3 – 1.5
  invertY: boolean;
  fov: number;           // 70 – 103
  volume: number;        // 0 – 1
  quality: 'low' | 'medium' | 'high';
  shadows: boolean;
  screenFx: boolean;     // grain + scanlines
  showFps: boolean;
  viewmodel: boolean;    // afficher l'arme
  crosshair: CrosshairCfg;
  difficulty: number;    // 1 – 5
  matchWins: number;     // 2 | 4 | 7
  mapId: MapId;
  pad: PadLayout;
  padScale: number;      // facteur global 0.7 – 1.4
  padOpacity: number;    // 0.3 – 1
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1,
  adsSens: 0.8,
  invertY: false,
  fov: 80,
  volume: 0.75,
  quality: 'high',
  shadows: true,
  screenFx: true,
  showFps: false,
  viewmodel: true,
  crosshair: { color: '#4df3d3', length: 9, thickness: 2, gap: 5, dot: true, outline: true, dynamic: true },
  difficulty: 2,
  matchWins: 4,
  mapId: 'souk',
  pad: DEFAULT_PAD,
  padScale: 1,
  padOpacity: 0.85,
};

export const DIFFICULTIES = [
  { v: 1, name: 'RECRUE', desc: 'Réflexes lents, visée hésitante' },
  { v: 2, name: 'AGENT', desc: 'Opposition équilibrée' },
  { v: 3, name: 'VÉTÉRAN', desc: 'Tirs précis, bons angles' },
  { v: 4, name: 'ÉLITE', desc: 'Réaction rapide, agressifs' },
  { v: 5, name: 'RADIANT', desc: 'Impitoyable. Bonne chance.' },
];

export interface BotRow {
  name: string;
  alive: boolean;
  kills: number;
  color: string;
}

export interface Snapshot {
  screen: Screen;
  phase: Phase;
  pointerLocked: boolean;
  paused: boolean;
  buyOpen: boolean;
  scoreOpen: boolean;

  hp: number;
  shield: number;
  credits: number;

  weapon: WeaponId;
  owned: WeaponId[];
  ammo: number;
  reserve: number;
  reloading: boolean;
  adsLevel: 0 | 1 | 2;
  scoped: boolean;
  spread: number;
  moving: boolean;

  round: number;
  score: [number, number];
  targetWins: number;
  timer: number;

  enemiesAlive: number;
  enemiesTotal: number;

  // ─── Spike & camps ───
  side: Side;                 // camp du joueur cette manche
  spike: SpikeState;
  spikeCarriedByPlayer: boolean;
  spikeTimer: number;         // secondes avant explosion
  plantProgress: number;      // 0..1 pose en cours
  defuseProgress: number;     // 0..1 désamorçage en cours
  nearSite: 'A' | 'B' | null; // site de pose à portée
  canPlant: boolean;
  canDefuse: boolean;
  canPickup: boolean;
  spikeOnMap: { x: number; z: number } | null;
  alliesAlive: number;
  alliesTotal: number;

  kills: number;
  deaths: number;
  bots: BotRow[];
  allies: BotRow[];

  feed: FeedItem[];
  banner: Banner | null;
  hitmarker: number;
  hitKill: boolean;
  dmgFlash: number;
  dmgDir: number | null;
  matchResult: 'win' | 'lose' | null;
  lowAmmo: boolean;
  spectating: boolean;
  // ─── pouvoirs ───
  agentId: string;
  abilityName: string;
  abilityCharges: number;
  abilityCd: number;        // 0..1 (1 = prêt)
  ultName: string;
  ultCharges: number;
  ultCd: number;
  abilityActive: string | null;
  flashed: number;          // intensité d'aveuglement 0..1
  coins: number;
  rewardCoins: number;
  rewardXp: number;
  rewardLevel: number;
  lastKill: { name: string; ts: number; head: boolean } | null;

  fps: number;
  mapId: MapId;
  settings: Settings;
}

const DEFAULT: Snapshot = {
  screen: 'menu',
  phase: 'none',
  pointerLocked: false,
  paused: false,
  buyOpen: false,
  scoreOpen: false,
  hp: 100,
  shield: 0,
  credits: 800,
  weapon: 'classic',
  owned: ['classic'],
  ammo: 12,
  reserve: 36,
  reloading: false,
  adsLevel: 0,
  scoped: false,
  spread: 6,
  moving: false,
  round: 1,
  score: [0, 0],
  targetWins: 4,
  timer: 0,
  enemiesAlive: 5,
  enemiesTotal: 5,
  side: 'attack',
  spike: 'carried',
  spikeCarriedByPlayer: false,
  spikeTimer: 0,
  plantProgress: 0,
  defuseProgress: 0,
  nearSite: null,
  canPlant: false,
  canDefuse: false,
  canPickup: false,
  spikeOnMap: null,
  alliesAlive: 5,
  alliesTotal: 5,
  kills: 0,
  deaths: 0,
  bots: [],
  allies: [],
  feed: [],
  banner: null,
  hitmarker: 0,
  hitKill: false,
  dmgFlash: 0,
  dmgDir: null,
  matchResult: null,
  lowAmmo: false,
  spectating: false,
  agentId: 'embre',
  abilityName: '', abilityCharges: 0, abilityCd: 1,
  ultName: '', ultCharges: 0, ultCd: 1,
  abilityActive: null, flashed: 0, coins: 0, rewardCoins: 0, rewardXp: 0, rewardLevel: 0,
  lastKill: null,
  fps: 0,
  mapId: 'souk',
  settings: DEFAULT_SETTINGS,
};

type Listener = () => void;

class Store {
  private snap: Snapshot = { ...DEFAULT };
  private listeners = new Set<Listener>();

  getSnapshot = (): Snapshot => this.snap;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  reset(partial: Partial<Snapshot>) {
    this.snap = { ...DEFAULT, ...partial };
    this.listeners.forEach((l) => l());
  }
}

export const store = new Store();

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('valence-settings-v2');
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>;
      return {
        ...DEFAULT_SETTINGS, ...p,
        crosshair: { ...DEFAULT_SETTINGS.crosshair, ...(p.crosshair ?? {}) },
        pad: { ...DEFAULT_PAD, ...(p.pad ?? {}) },
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem('valence-settings-v2', JSON.stringify(s)); } catch { /* ignore */ }
}
