// ─────────────────────────────────────────────────────────────
//  VALENCE — Arsenal (12 armes, stats inspirées de Valorant)
// ─────────────────────────────────────────────────────────────
import type { WeaponId } from './store';

export type WeaponCat = 'Pistolet' | 'Fusil à pompe' | 'PM' | 'Fusil' | 'Sniper' | 'Mitrailleuse';
export type ModelKey =
  | 'pistol_basic' | 'pistol_auto' | 'pistol_sup' | 'revolver'
  | 'shotgun' | 'smg' | 'rifle_semi' | 'rifle_auto' | 'rifle_sup'
  | 'lmg' | 'sniper_light' | 'sniper_heavy';

export interface WeaponCfg {
  id: WeaponId;
  name: string;
  codename: string;
  cat: WeaponCat;
  desc: string;
  price: number;
  auto: boolean;
  rpm: number;
  pellets: number;                  // >1 = chevrotine
  dmg: [number, number, number];    // [tête, corps, jambes] courte portée
  dmgFar: [number, number, number];
  falloffStart: number;
  falloffEnd: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  equipTime: number;
  spreadBase: number;               // degrés
  spreadMove: number;
  bloomPerShot: number;
  bloomMax: number;
  recoilKick: number;               // recul vertical par tir (rad)
  scopeLevels: 0 | 1 | 2;           // 0 = mire métallique, 1 = lunette, 2 = double zoom
  adsFov: number;
  adsFov2: number;
  boltAction: boolean;
  tracer: number;
  soundKind: 'rifle' | 'smg' | 'pistol' | 'sniper' | 'shotgun' | 'lmg';
  model: ModelKey;
  ui: { degats: number; cadence: number; portee: number; controle: number };
}

const W = (c: WeaponCfg) => c;

export const WEAPONS: Record<WeaponId, WeaponCfg> = {
  // ─────────── PISTOLETS ───────────
  classic: W({
    id: 'classic', name: 'CLASSIQUE', codename: 'P-9 // DOTATION', cat: 'Pistolet',
    desc: 'Pistolet de dotation. Gratuit, fiable, précis au premier tir.',
    price: 0, auto: false, rpm: 405, pellets: 1,
    dmg: [78, 26, 22], dmgFar: [66, 22, 18], falloffStart: 20, falloffEnd: 40,
    mag: 12, reserve: 36, reloadTime: 1.6, equipTime: 0.3,
    spreadBase: 0.32, spreadMove: 2.6, bloomPerShot: 0.34, bloomMax: 2.2,
    recoilKick: 0.013, scopeLevels: 0, adsFov: 62, adsFov2: 62,
    boltAction: false, tracer: 0xffd9a0, soundKind: 'pistol', model: 'pistol_basic',
    ui: { degats: 3, cadence: 4, portee: 3, controle: 8 },
  }),
  frenzy: W({
    id: 'frenzy', name: 'FRÉNÉSIE', codename: 'FZ-3 // DÉLUGE', cat: 'Pistolet',
    desc: 'Pistolet automatique. Déluge de balles à bout portant.',
    price: 450, auto: true, rpm: 950, pellets: 1,
    dmg: [78, 26, 22], dmgFar: [62, 21, 17], falloffStart: 9, falloffEnd: 22,
    mag: 13, reserve: 39, reloadTime: 1.5, equipTime: 0.28,
    spreadBase: 0.65, spreadMove: 2.4, bloomPerShot: 0.3, bloomMax: 3.6,
    recoilKick: 0.011, scopeLevels: 0, adsFov: 64, adsFov2: 64,
    boltAction: false, tracer: 0xffd9a0, soundKind: 'pistol', model: 'pistol_auto',
    ui: { degats: 3, cadence: 9, portee: 2, controle: 4 },
  }),
  ghost: W({
    id: 'ghost', name: 'FANTÔME', codename: 'GH-13 // SILENCIEUX', cat: 'Pistolet',
    desc: 'Semi-auto silencieux. Mortel en tête, discipline exigée.',
    price: 500, auto: false, rpm: 405, pellets: 1,
    dmg: [105, 30, 25], dmgFar: [88, 25, 21], falloffStart: 22, falloffEnd: 42,
    mag: 13, reserve: 39, reloadTime: 1.5, equipTime: 0.3,
    spreadBase: 0.28, spreadMove: 2.2, bloomPerShot: 0.3, bloomMax: 2.0,
    recoilKick: 0.014, scopeLevels: 0, adsFov: 62, adsFov2: 62,
    boltAction: false, tracer: 0xbfe8ff, soundKind: 'pistol', model: 'pistol_sup',
    ui: { degats: 4, cadence: 4, portee: 4, controle: 8 },
  }),
  sheriff: W({
    id: 'sheriff', name: 'SHÉRIF', codename: 'SH-45 // VERDICT', cat: 'Pistolet',
    desc: 'Revolver lourd. Une balle en tête, un adversaire en moins.',
    price: 800, auto: false, rpm: 195, pellets: 1,
    dmg: [159, 55, 46], dmgFar: [145, 50, 42], falloffStart: 30, falloffEnd: 50,
    mag: 6, reserve: 24, reloadTime: 2.25, equipTime: 0.4,
    spreadBase: 0.3, spreadMove: 4.2, bloomPerShot: 0.9, bloomMax: 3.2,
    recoilKick: 0.035, scopeLevels: 0, adsFov: 58, adsFov2: 58,
    boltAction: false, tracer: 0xffb27a, soundKind: 'pistol', model: 'revolver',
    ui: { degats: 8, cadence: 2, portee: 6, controle: 4 },
  }),

  // ─────────── FUSIL À POMPE ───────────
  carnage: W({
    id: 'carnage', name: 'CARNAGE', codename: 'CR-12 // BRÈCHE', cat: 'Fusil à pompe',
    desc: 'Fusil à pompe 12 plombs. Dévastateur dans les couloirs.',
    price: 900, auto: false, rpm: 108, pellets: 12,
    dmg: [40, 13, 11], dmgFar: [12, 4, 3], falloffStart: 7, falloffEnd: 18,
    mag: 5, reserve: 20, reloadTime: 2.6, equipTime: 0.45,
    spreadBase: 3.4, spreadMove: 5.5, bloomPerShot: 0.2, bloomMax: 4.6,
    recoilKick: 0.05, scopeLevels: 0, adsFov: 66, adsFov2: 66,
    boltAction: false, tracer: 0xffc27a, soundKind: 'shotgun', model: 'shotgun',
    ui: { degats: 9, cadence: 2, portee: 1, controle: 3 },
  }),

  // ─────────── SNIPER LÉGER ───────────
  marshal: W({
    id: 'marshal', name: 'MARÉCHAL', codename: 'MR-7 // SENTINELLE', cat: 'Sniper',
    desc: 'Sniper léger à verrou. Mobile, abordable, chirurgical.',
    price: 950, auto: false, rpm: 90, pellets: 1,
    dmg: [202, 101, 85], dmgFar: [202, 101, 85], falloffStart: 999, falloffEnd: 1000,
    mag: 5, reserve: 15, reloadTime: 2.5, equipTime: 0.6,
    spreadBase: 2.6, spreadMove: 5, bloomPerShot: 0.9, bloomMax: 5,
    recoilKick: 0.03, scopeLevels: 1, adsFov: 26, adsFov2: 26,
    boltAction: true, tracer: 0xbfe8ff, soundKind: 'sniper', model: 'sniper_light',
    ui: { degats: 7, cadence: 2, portee: 9, controle: 5 },
  }),

  // ─────────── PM ───────────
  spectre: W({
    id: 'spectre', name: 'SPECTRE-X', codename: 'SP-16 // RAPPROCHÉ', cat: 'PM',
    desc: 'PM véloce et discret. Roi des duels à moyenne portée.',
    price: 1600, auto: true, rpm: 780, pellets: 1,
    dmg: [78, 26, 22], dmgFar: [66, 22, 18], falloffStart: 15, falloffEnd: 32,
    mag: 30, reserve: 90, reloadTime: 2.2, equipTime: 0.4,
    spreadBase: 0.45, spreadMove: 1.7, bloomPerShot: 0.2, bloomMax: 2.8,
    recoilKick: 0.012, scopeLevels: 0, adsFov: 58, adsFov2: 58,
    boltAction: false, tracer: 0xbfe8ff, soundKind: 'smg', model: 'smg',
    ui: { degats: 4, cadence: 7, portee: 4, controle: 7 },
  }),

  // ─────────── FUSILS ───────────
  guardian: W({
    id: 'guardian', name: 'GARDIEN', codename: 'GD-22 // SENTENCE', cat: 'Fusil',
    desc: 'Fusil semi-automatique. Récompense la précision pure.',
    price: 2250, auto: false, rpm: 325, pellets: 1,
    dmg: [195, 65, 49], dmgFar: [195, 65, 49], falloffStart: 999, falloffEnd: 1000,
    mag: 12, reserve: 36, reloadTime: 2.5, equipTime: 0.5,
    spreadBase: 0.22, spreadMove: 3.4, bloomPerShot: 0.5, bloomMax: 3,
    recoilKick: 0.026, scopeLevels: 1, adsFov: 42, adsFov2: 42,
    boltAction: false, tracer: 0xffb27a, soundKind: 'rifle', model: 'rifle_semi',
    ui: { degats: 8, cadence: 3, portee: 8, controle: 6 },
  }),
  vandal: W({
    id: 'vandal', name: 'VNDL-47', codename: 'VD-47 // FRACTURE', cat: 'Fusil',
    desc: 'Fusil d\'assaut brutal : une balle en tête tue à toute distance.',
    price: 2900, auto: true, rpm: 660, pellets: 1,
    dmg: [160, 40, 34], dmgFar: [160, 40, 34], falloffStart: 999, falloffEnd: 1000,
    mag: 25, reserve: 75, reloadTime: 2.4, equipTime: 0.5,
    spreadBase: 0.3, spreadMove: 3.1, bloomPerShot: 0.36, bloomMax: 3.4,
    recoilKick: 0.019, scopeLevels: 0, adsFov: 52, adsFov2: 52,
    boltAction: false, tracer: 0xffb27a, soundKind: 'rifle', model: 'rifle_auto',
    ui: { degats: 7, cadence: 6, portee: 7, controle: 5 },
  }),
  fantasma: W({
    id: 'fantasma', name: 'FANTASMA', codename: 'FA-9 // MURMURE', cat: 'Fusil',
    desc: 'Fusil silencieux à forte cadence. Tue sans révéler sa position.',
    price: 2900, auto: true, rpm: 735, pellets: 1,
    dmg: [156, 39, 33], dmgFar: [124, 31, 26], falloffStart: 15, falloffEnd: 30,
    mag: 30, reserve: 90, reloadTime: 2.5, equipTime: 0.5,
    spreadBase: 0.28, spreadMove: 2.9, bloomPerShot: 0.3, bloomMax: 3.1,
    recoilKick: 0.016, scopeLevels: 0, adsFov: 52, adsFov2: 52,
    boltAction: false, tracer: 0x9fdcff, soundKind: 'rifle', model: 'rifle_sup',
    ui: { degats: 6, cadence: 7, portee: 6, controle: 7 },
  }),

  // ─────────── MITRAILLEUSE ───────────
  odin: W({
    id: 'odin', name: 'ODIN-X', codename: 'OD-100 // TEMPÊTE', cat: 'Mitrailleuse',
    desc: '100 balles de suppression. Traverse les couloirs, pas les nerfs.',
    price: 3200, auto: true, rpm: 720, pellets: 1,
    dmg: [95, 38, 32], dmgFar: [120, 48, 40], falloffStart: 30, falloffEnd: 31,
    mag: 100, reserve: 100, reloadTime: 5, equipTime: 0.85,
    spreadBase: 0.6, spreadMove: 4.4, bloomPerShot: 0.26, bloomMax: 4.2,
    recoilKick: 0.017, scopeLevels: 0, adsFov: 56, adsFov2: 56,
    boltAction: false, tracer: 0xff9a5a, soundKind: 'lmg', model: 'lmg',
    ui: { degats: 6, cadence: 8, portee: 6, controle: 3 },
  }),

  // ─────────── SNIPER LOURD ───────────
  operator: W({
    id: 'operator', name: 'OPÉRATEUR', codename: 'OP-X1 // LONGUE VUE', cat: 'Sniper',
    desc: 'Fusil de précision à verrou. Létal en une balle dans le torse.',
    price: 4700, auto: false, rpm: 55, pellets: 1,
    dmg: [255, 150, 127], dmgFar: [255, 150, 127], falloffStart: 999, falloffEnd: 1000,
    mag: 5, reserve: 10, reloadTime: 3.4, equipTime: 1.1,
    spreadBase: 3.6, spreadMove: 6, bloomPerShot: 1, bloomMax: 6,
    recoilKick: 0.05, scopeLevels: 2, adsFov: 30, adsFov2: 14,
    boltAction: true, tracer: 0xff6a5a, soundKind: 'sniper', model: 'sniper_heavy',
    ui: { degats: 10, cadence: 1, portee: 10, controle: 3 },
  }),
};

export const SHOP_ORDER: { cat: WeaponCat; ids: WeaponId[] }[] = [
  { cat: 'Pistolet', ids: ['frenzy', 'ghost', 'sheriff'] },
  { cat: 'Fusil à pompe', ids: ['carnage'] },
  { cat: 'PM', ids: ['spectre'] },
  { cat: 'Fusil', ids: ['guardian', 'vandal', 'fantasma'] },
  { cat: 'Sniper', ids: ['marshal', 'operator'] },
  { cat: 'Mitrailleuse', ids: ['odin'] },
];

export const ALL_WEAPONS: WeaponId[] = Object.keys(WEAPONS) as WeaponId[];

/** Les armes « principales » (tout sauf pistolets) occupent l'emplacement 2. */
export const isPrimary = (id: WeaponId) => WEAPONS[id].cat !== 'Pistolet';

export const SHIELD_LIGHT = { price: 400, amount: 25, name: 'Bouclier léger' };
export const SHIELD_HEAVY = { price: 1000, amount: 50, name: 'Bouclier lourd' };
