// ─────────────────────────────────────────────────────────────
//  VALENCE — Définition des cartes (3 arènes jouables)
//  Nord = -Z (défenseurs) · Sud = +Z (attaquants)
// ─────────────────────────────────────────────────────────────
import type { MapId } from './store';

export interface Solid {
  x: number; z: number;
  w: number; d: number;
  h: number;
  y0?: number;
  kind: 'bldg' | 'crate' | 'stall' | 'pillar' | 'wall' | 'planter' | 'barrel' | 'tank' | 'sign' | 'catwalk';
  tint?: number;
}

export interface Zone { x0: number; z0: number; x1: number; z1: number; label?: string }
export interface Anchor { x: number; z: number; yaw: number; site: 'A' | 'B' | 'M' }

/** Dalle de plafond : couvre une zone, portée par des poutres */
export interface Ceiling {
  x0: number; z0: number; x1: number; z1: number;
  y: number;              // hauteur du dessous de la dalle
  tint?: number;
  lights?: boolean;       // néons encastrés
}

export interface MapTheme {
  style: 'desert' | 'arctic' | 'neon' | 'bunker';
  indoor?: boolean;       // pas de ciel : la skybox est remplacée par du noir
  sky: [number, number, number];
  sunColor: number; sunInt: number; sunPos: [number, number, number];
  hemiSky: number; hemiGround: number; hemiInt: number;
  fog: number; fogNear: number; fogFar: number;
  exposure: number;
  groundBase: string; groundPave: string; groundLine: string; groundSpeck: string;
  wallPalette: string[];
  trimPalette: string[];
  crateTints: string[];
  accent: number;        // néons / bandes lumineuses
  accentCss: string;
  terrain: 'dunes' | 'bergs' | 'towers' | 'none';
  lampColor: number;
  cloth: boolean;        // bannières en tissu
  lamps: boolean;        // guirlandes
}

export interface MapDef {
  id: MapId;
  name: string;
  codename: string;
  region: string;
  desc: string;
  theme: MapTheme;
  solids: Solid[];
  ceilings?: Ceiling[];
  zones: Zone[];
  siteA: { x: number; z: number; r: number; name: string };
  siteB: { x: number; z: number; r: number; name: string };
  /** index 0 = chef d'escouade (joueur si de ce camp) */
  attackSpawns: { x: number; z: number }[];
  defenseSpawns: { x: number; z: number }[];
  anchors: Anchor[];          // positions tenues par les défenseurs
  allyAnchors: Anchor[];      // ralliement des attaquants
  allyPush: { x: number; z: number }[];   // objectifs d'assaut
}

export const BUY_BARRIER = { x0: -31, z0: 24.6, x1: 31, z1: 25.4, h: 5.5 };
export const BOUNDS = { minX: -38, maxX: 38, minZ: -38, maxZ: 38 };
export const BOT_NAMES = ['RAPACE', 'VIPÈRE', 'OMBRAGE', 'FRELON', 'SPECTRAL'];
export const BOT_COLORS = ['#ff5d5d', '#ff8a5d', '#e05dff', '#5d8aff', '#ffd25d'];
export const ALLY_NAMES = ['SILEX', 'AURORE', 'KOBALT', 'MISTRAL'];
export const ALLY_COLORS = ['#4df3d3', '#5ec8ff', '#7affa0', '#c6f24d'];

// ═══════════════════════════════════════════════════════════════
//  GÉOMÉTRIE COMMUNE — symétrique sur les DEUX axes.
//  Les sites A et B sont sur la ligne médiane (z = 0), à l'ouest
//  et à l'est : chaque camp est donc à distance strictement égale
//  des deux objectifs (44,8 m à vol d'oiseau, trajets identiques).
// ═══════════════════════════════════════════════════════════════

export const SITE_A = { x: -26, z: 0, r: 7, name: 'A' };
export const SITE_B = { x: 26, z: 0, r: 7, name: 'B' };

const SKELETON: Zone[] = [
  // bases (sud = attaque, nord = défense)
  { x0: -15, z0: 28, x1: 15, z1: 38, label: 'BASE ATT.' },
  { x0: -15, z0: -38, x1: 15, z1: -28, label: 'BASE DÉF.' },
  // sorties de base : relient la base aux trois voies
  { x0: -27, z0: 25, x1: 27, z1: 28 },
  { x0: -27, z0: -28, x1: 27, z1: -25 },
  // trois voies longitudinales
  { x0: -6, z0: -25, x1: 6, z1: 25, label: 'MILIEU' },
  { x0: -32, z0: -25, x1: -20, z1: 25, label: 'VOIE A' },
  { x0: 20, z0: -25, x1: 32, z1: 25, label: 'VOIE B' },
  // plateformes d'objectif (au centre, ouest et est)
  { x0: -35, z0: -10, x1: -16, z1: 10, label: 'SITE A' },
  { x0: 16, z0: -10, x1: 35, z1: 10, label: 'SITE B' },
  // raccourcis milieu ↔ sites
  { x0: -20, z0: -4.5, x1: -6, z1: 4.5 },
  { x0: 6, z0: -4.5, x1: 20, z1: 4.5 },
  // deux traverses de rotation (une par camp, parfaitement miroir)
  { x0: -32, z0: 15, x1: 32, z1: 21, label: 'TRAVERSE SUD' },
  { x0: -32, z0: -21, x1: 32, z1: -15, label: 'TRAVERSE NORD' },
];

const OUTER: Solid[] = [
  { x: 0, z: -41.5, w: 92, d: 5, h: 12, kind: 'wall', tint: 1 },
  { x: 0, z: 41.5, w: 92, d: 5, h: 12, kind: 'wall', tint: 1 },
  { x: -41.5, z: 0, w: 5, d: 92, h: 12, kind: 'wall', tint: 1 },
  { x: 41.5, z: 0, w: 5, d: 92, h: 12, kind: 'wall', tint: 1 },
];

const mx = (s: Solid): Solid => ({ ...s, x: -s.x });
const mz = (s: Solid): Solid => ({ ...s, z: -s.z });
/** miroir sur les DEUX axes : garantit l'équité entre les deux camps */
const quad = (...items: Solid[]): Solid[] =>
  items.flatMap((s) => [s, mx(s), mz(s), mx(mz(s))]);

/** Masses bâties communes : créent les couloirs et les angles.
 *  Chaque bloc est dupliqué dans les 4 quadrants → équité absolue. */
const SHELL = (h: number, t = 0): Solid[] => [
  ...OUTER,
  // ── séparateurs entre le milieu et les voies latérales ──
  ...quad({ x: -13, z: 9.8, w: 13.4, d: 10, h, kind: 'bldg', tint: t }),
  ...quad({ x: -13, z: 20.4, w: 13.4, d: 8.6, h: h - 0.5, kind: 'bldg', tint: t + 1 }),
  // ── blocs derrière les sites (ferment les voies) ──
  ...quad({ x: -37, z: 24, w: 7, d: 26, h, kind: 'bldg', tint: t + 2 }),
  ...quad({ x: -24, z: 33, w: 17, d: 10, h, kind: 'bldg', tint: t }),
  // ── épaules des sites : couvrent les entrées depuis les voies ──
  ...quad({ x: -36.5, z: 7.5, w: 8, d: 9, h: h - 1, kind: 'bldg', tint: t + 1 }),
  // ── îlots d'angle entre traverse et site ──
  ...quad({ x: -17.5, z: 13.5, w: 4.5, d: 3.4, h: 3.2, kind: 'bldg', tint: t + 2 }),
];

/** Couvertures : caisses, fûts, cuves — identiques dans les 4 quadrants */
const COVER: Solid[] = [
  // sites : plateforme haute + caisses
  ...quad({ x: -29.5, z: 5.6, w: 7, d: 3.6, h: 1.85, kind: 'crate', tint: 0 }),
  ...quad({ x: -21.5, z: 6.2, w: 2.4, d: 2.4, h: 1.4, kind: 'crate', tint: 2 }),
  ...quad({ x: -32.5, z: 1.8, w: 1.9, d: 1.9, h: 1.2, kind: 'barrel', tint: 1 }),
  ...quad({ x: -25, z: 2.4, w: 2.6, d: 2.6, h: 1.5, kind: 'tank', tint: 3 }),
  // raccourcis
  ...quad({ x: -13.5, z: 2.6, w: 2, d: 2, h: 1.25, kind: 'barrel', tint: 1 }),
  // voies latérales
  ...quad({ x: -26, z: 18.5, w: 3, d: 2.6, h: 1.5, kind: 'crate', tint: 2 }),
  ...quad({ x: -22.5, z: 11.5, w: 2, d: 2, h: 1.3, kind: 'barrel', tint: 0 }),
  ...quad({ x: -29.5, z: 23, w: 2.4, d: 2.4, h: 1.4, kind: 'crate', tint: 3 }),
  // milieu
  ...quad({ x: -2.8, z: 8.5, w: 2.4, d: 2.4, h: 1.4, kind: 'crate', tint: 1 }),
  ...quad({ x: 2.6, z: 17.5, w: 2, d: 2, h: 1.25, kind: 'barrel', tint: 2 }),
  // traverses : piliers qui coupent les lignes de vue
  ...quad({ x: -9.5, z: 17.8, w: 1.3, d: 1.3, h: 4.6, kind: 'pillar', tint: 0 }),
  ...quad({ x: 16.5, z: 17.8, w: 1.3, d: 1.3, h: 4.6, kind: 'pillar', tint: 0 }),
  // bases
  ...quad({ x: -11, z: 31, w: 4, d: 2.4, h: 2.3, kind: 'stall', tint: 0 }),
  ...quad({ x: -33, z: 10.5, w: 1, d: 1, h: 4.4, kind: 'pillar', tint: 4 }),
];

// ─── Spawns : bases opposées, strictement à égale distance des sites ───
const SPAWN_Z = 34.5;
const SPAWNS = {
  attack: [
    { x: 0, z: SPAWN_Z }, { x: -8, z: SPAWN_Z }, { x: -4, z: SPAWN_Z + 1.5 },
    { x: 4, z: SPAWN_Z + 1.5 }, { x: 8, z: SPAWN_Z },
  ],
  defense: [
    { x: 0, z: -SPAWN_Z }, { x: -8, z: -SPAWN_Z }, { x: -4, z: -SPAWN_Z - 1.5 },
    { x: 4, z: -SPAWN_Z - 1.5 }, { x: 8, z: -SPAWN_Z },
  ],
};

/** Positions tenues par les DÉFENSEURS : autour des deux sites */
const DEF_ANCHORS: Anchor[] = [
  { x: -27.4, z: -3.1, yaw: Math.PI * 0.5, site: 'A' },
  { x: -20.9, z: -7.9, yaw: Math.PI * 0.8, site: 'A' },
  { x: 27.4, z: -3.1, yaw: -Math.PI * 0.5, site: 'B' },
  { x: 20.9, z: -7.9, yaw: -Math.PI * 0.8, site: 'B' },
  { x: 0, z: -12, yaw: Math.PI, site: 'M' },
];

/** Points de ralliement des ATTAQUANTS : juste avant le contact */
const ATK_ANCHORS: Anchor[] = [
  { x: -26.6, z: 16.6, yaw: Math.PI, site: 'A' },
  { x: 26.6, z: 16.6, yaw: Math.PI, site: 'B' },
  { x: 0, z: 14, yaw: Math.PI, site: 'M' },
  { x: -13, z: 15.5, yaw: Math.PI, site: 'A' },
];

/** Objectifs d'assaut : les deux sites */
const ATK_PUSH = [
  { x: -27, z: 3 }, { x: 27, z: 3 }, { x: -22, z: -2 }, { x: 22, z: -2 },
];

// ═══════════════════════════════════════════════════════════════
//  CARTE 1 — SOUK-9 : souk désertique au crépuscule
// ═══════════════════════════════════════════════════════════════
const SOUK: MapDef = {
  id: 'souk',
  name: 'SOUK-9',
  codename: 'SECTEUR NORD',
  region: 'Désert d\'Al-Qamar · Maroc',
  desc: 'Un marché fortifié écrasé de soleil. Ruelles étroites, toits bas, duels au couteau du regard.',
  theme: {
    style: 'desert',
    sky: [0x63b8c9, 0xa8d8d4, 0xf0d6a0],
    sunColor: 0xfff1d6, sunInt: 2.7, sunPos: [55, 80, 25],
    hemiSky: 0xcfe8ff, hemiGround: 0xcaa26a, hemiInt: 0.85,
    fog: 0xe8cf9f, fogNear: 70, fogFar: 190, exposure: 1.05,
    groundBase: '#d3bd93', groundPave: 'rgba(150,118,74,0.5)', groundLine: 'rgba(96,74,44,0.55)', groundSpeck: '#b89b6a',
    wallPalette: ['#e8dcc3', '#dfc9a5', '#d3bd9a', '#e2d2b4'],
    trimPalette: ['#b9603f', '#33686b', '#8a4a3a', '#3c454e'],
    crateTints: ['#a5824f', '#8f6f42', '#b08d55', '#7d7263'],
    accent: 0x35f0d8, accentCss: '#35f0d8',
    terrain: 'dunes', lampColor: 0xffca7a, cloth: true, lamps: true,
  },
  zones: SKELETON,
  siteA: SITE_A,
  siteB: SITE_B,
  attackSpawns: SPAWNS.attack,
  defenseSpawns: SPAWNS.defense,
  anchors: DEF_ANCHORS,
  allyAnchors: ATK_ANCHORS,
  allyPush: ATK_PUSH,
  solids: [
    ...SHELL(7.5, 0),
    ...COVER,
    // habillage souk : échoppes et auvents
    ...quad({ x: -8.5, z: 3.8, w: 2.8, d: 2.0, h: 1.65, kind: 'stall', tint: 2 }),
    ...quad({ x: -17.5, z: -5.8, w: 2.2, d: 2.2, h: 1.25, kind: 'crate', tint: 1 }),
    ...quad({ x: -19.5, z: 24.5, w: 3.6, d: 2.4, h: 2.3, kind: 'stall', tint: 1 }),
    ...quad({ x: -30, z: 13.5, w: 4.6, d: 1.4, h: 1.25, kind: 'planter', tint: 1 }),
    ...quad({ x: -6.5, z: 24, w: 2.2, d: 2.2, h: 1.3, kind: 'crate', tint: 0 }),
  ],
};

// ═══════════════════════════════════════════════════════════════
//  CARTE 2 — CRYO-7 : base de recherche arctique
// ═══════════════════════════════════════════════════════════════
const CRYO: MapDef = {
  id: 'cryo',
  name: 'CRYO-7',
  codename: 'STATION POLAIRE',
  region: 'Plateau de Svalbard · Arctique',
  desc: 'Une station de forage prise dans les glaces. Conteneurs, cuves cryogéniques et lumière blanche aveuglante.',
  theme: {
    style: 'arctic',
    sky: [0x5f86b8, 0x9fc4de, 0xe8f2fb],
    sunColor: 0xeaf4ff, sunInt: 2.3, sunPos: [-45, 70, -35],
    hemiSky: 0xdceeff, hemiGround: 0x8fa8bd, hemiInt: 1.05,
    fog: 0xd6e6f2, fogNear: 55, fogFar: 165, exposure: 1.12,
    groundBase: '#dbe7ef', groundPave: 'rgba(120,145,168,0.42)', groundLine: 'rgba(70,96,120,0.5)', groundSpeck: '#aabecd',
    wallPalette: ['#b9c6d1', '#9fb0bf', '#cdd8e1', '#8ea0b0'],
    trimPalette: ['#2f6f8f', '#e0772f', '#3b4a57', '#1f7a6a'],
    crateTints: ['#4d6373', '#6b7f8d', '#39566a', '#8a9aa6'],
    accent: 0x59d7ff, accentCss: '#59d7ff',
    terrain: 'bergs', lampColor: 0xcfe9ff, cloth: false, lamps: true,
  },
  zones: SKELETON,
  siteA: SITE_A,
  siteB: SITE_B,
  attackSpawns: SPAWNS.attack,
  defenseSpawns: SPAWNS.defense,
  anchors: DEF_ANCHORS,
  allyAnchors: ATK_ANCHORS,
  allyPush: ATK_PUSH,
  solids: [
    ...SHELL(8.5, 1),
    ...COVER,
    // habillage polaire : cuves cryogéniques
    ...quad({ x: -8.5, z: 3.8, w: 2.4, d: 2.4, h: 2.6, kind: 'tank', tint: 0 }),
    ...quad({ x: -17.5, z: -5.8, w: 3.0, d: 1.8, h: 1.55, kind: 'crate', tint: 3 }),
    ...quad({ x: -19.5, z: 24.5, w: 3.2, d: 3.2, h: 2.4, kind: 'tank', tint: 2 }),
    ...quad({ x: -30, z: 13.5, w: 3, d: 3, h: 2.3, kind: 'tank', tint: 1 }),
    ...quad({ x: -6.5, z: 24, w: 2.4, d: 2.4, h: 1.35, kind: 'barrel', tint: 3 }),
  ],
};

// ═══════════════════════════════════════════════════════════════
//  CARTE 3 — NÉON-4 : district urbain nocturne
// ═══════════════════════════════════════════════════════════════
const NEON: MapDef = {
  id: 'neon',
  name: 'NÉON-4',
  codename: 'DISTRICT BAS',
  region: 'Shinjuku Ward · Tokyo 2049',
  desc: 'Une rue commerçante sous la pluie de néons. Enseignes holographiques, béton humide, embuscades partout.',
  theme: {
    style: 'neon',
    sky: [0x0d1430, 0x2e2056, 0x6b3270],
    sunColor: 0xd9c8ff, sunInt: 1.75, sunPos: [30, 70, -70],
    hemiSky: 0x8f72ff, hemiGround: 0x3d2a5c, hemiInt: 1.65,
    fog: 0x251c45, fogNear: 58, fogFar: 180, exposure: 1.22,
    groundBase: '#3c3754', groundPave: 'rgba(118,104,166,0.5)', groundLine: 'rgba(255,80,160,0.4)', groundSpeck: '#564e78',
    wallPalette: ['#4e4668', '#5b5179', '#413a5a', '#665a8a'],
    trimPalette: ['#ff2d78', '#15e0d6', '#8b4dff', '#ffb02e'],
    crateTints: ['#3c3550', '#4a4162', '#2e2940', '#564a70'],
    accent: 0xff2d78, accentCss: '#ff2d78',
    terrain: 'towers', lampColor: 0xff5fae, cloth: true, lamps: true,
  },
  zones: SKELETON,
  siteA: SITE_A,
  siteB: SITE_B,
  attackSpawns: SPAWNS.attack,
  defenseSpawns: SPAWNS.defense,
  anchors: DEF_ANCHORS,
  allyAnchors: ATK_ANCHORS,
  allyPush: ATK_PUSH,
  solids: [
    ...SHELL(10, 2),
    ...COVER,
    // habillage urbain : kiosques et enseignes
    ...quad({ x: -8.5, z: 3.8, w: 1.5, d: 1.5, h: 3.8, kind: 'sign', tint: 2 }),
    ...quad({ x: -17.5, z: -5.8, w: 3.4, d: 1.6, h: 1.35, kind: 'stall', tint: 3 }),
    ...quad({ x: -19.5, z: 24.5, w: 3.6, d: 2.6, h: 2.4, kind: 'stall', tint: 3 }),
    ...quad({ x: -30, z: 13.5, w: 2.8, d: 2.8, h: 1.5, kind: 'sign', tint: 2 }),
    ...quad({ x: -6.5, z: 24, w: 1.4, d: 1.4, h: 5.2, kind: 'pillar', tint: 1 }),
  ],
};

// ═══════════════════════════════════════════════════════════════
//  CARTE 4 — BUNKER-0 : complexe souterrain entièrement fermé
//  Aucun ciel : plafonds bétonnés, couloirs étroits, néons.
// ═══════════════════════════════════════════════════════════════
const BUNKER: MapDef = {
  id: 'bunker',
  name: 'BUNKER-0',
  codename: 'COMPLEXE ENFOUI',
  region: 'Installation Oméga · −80 m',
  desc: 'Un complexe militaire scellé sous la roche. Aucune lumière du jour : couloirs bétonnés, néons grésillants, angles mortels.',
  theme: {
    style: 'bunker', indoor: true,
    sky: [0x05070a, 0x05070a, 0x05070a],
    sunColor: 0xd6e4f2, sunInt: 1.5, sunPos: [16, 70, 22],
    hemiSky: 0xc3d4e4, hemiGround: 0x5c636d, hemiInt: 2.6,
    fog: 0x161c24, fogNear: 26, fogFar: 96, exposure: 1.38,
    groundBase: '#7c828b', groundPave: 'rgba(146,154,166,0.45)', groundLine: 'rgba(255,180,56,0.45)', groundSpeck: '#8d949e',
    wallPalette: ['#a9b0ba', '#949ba6', '#b7bec8', '#848b95'],
    trimPalette: ['#d08a2a', '#2f8f9c', '#8c3b3b', '#39414a'],
    crateTints: ['#79828e', '#8b95a3', '#656d78', '#9aa4b2'],
    accent: 0xffaa28, accentCss: '#ffaa28',
    terrain: 'none', lampColor: 0xdfeaff, cloth: false, lamps: false,
  },
  // plafonds : le complexe est intégralement couvert (aucun ciel)
  ceilings: [
    { x0: -16, z0: 27, x1: 16, z1: 39, y: 5.2, tint: 0, lights: true },
    { x0: -16, z0: -39, x1: 16, z1: -27, y: 5.2, tint: 0, lights: true },
    { x0: -28, z0: 24.4, x1: 28, z1: 28.6, y: 4.6, tint: 1, lights: true },
    { x0: -28, z0: -28.6, x1: 28, z1: -24.4, y: 4.6, tint: 1, lights: true },
    { x0: -7, z0: -26, x1: 7, z1: 26, y: 4.6, tint: 0, lights: true },
    { x0: -33, z0: -26, x1: -19, z1: 26, y: 4.6, tint: 1, lights: true },
    { x0: 19, z0: -26, x1: 33, z1: 26, y: 4.6, tint: 1, lights: true },
    { x0: -36, z0: -11, x1: -15, z1: 11, y: 6.4, tint: 3, lights: true },
    { x0: 15, z0: -11, x1: 36, z1: 11, y: 6.4, tint: 3, lights: true },
    { x0: -21, z0: -5.5, x1: -5, z1: 5.5, y: 4.6, tint: 2, lights: true },
    { x0: 5, z0: -5.5, x1: 21, z1: 5.5, y: 4.6, tint: 2, lights: true },
    { x0: -33, z0: 14, x1: 33, z1: 22, y: 4.6, tint: 2, lights: true },
    { x0: -33, z0: -22, x1: 33, z1: -14, y: 4.6, tint: 2, lights: true },
  ],
  zones: SKELETON,
  siteA: SITE_A,
  siteB: SITE_B,
  attackSpawns: SPAWNS.attack,
  defenseSpawns: SPAWNS.defense,
  anchors: DEF_ANCHORS,
  allyAnchors: ATK_ANCHORS,
  allyPush: ATK_PUSH,
  solids: [
    ...SHELL(8, 0),
    ...COVER,
    // habillage bunker : machinerie et piliers porteurs
    ...quad({ x: -8.5, z: 3.8, w: 1.25, d: 1.25, h: 4.0, kind: 'pillar', tint: 3 }),
    ...quad({ x: -17.5, z: -5.8, w: 3.0, d: 2.0, h: 1.8, kind: 'tank', tint: 1 }),
    ...quad({ x: -19.5, z: 24.5, w: 3.2, d: 3.2, h: 2.5, kind: 'tank', tint: 0 }),
    ...quad({ x: -30, z: 13.5, w: 2.4, d: 4.4, h: 1.6, kind: 'crate', tint: 2 }),
    ...quad({ x: -6.5, z: 24, w: 1.2, d: 1.2, h: 4.6, kind: 'pillar', tint: 3 }),
    ...quad({ x: -16.5, z: 4.5, w: 1.3, d: 1.3, h: 4.6, kind: 'pillar', tint: 3 }),
  ],
};

export const MAPS: Record<MapId, MapDef> = { souk: SOUK, cryo: CRYO, neon: NEON, bunker: BUNKER };
export const MAP_LIST: MapDef[] = [SOUK, CRYO, NEON, BUNKER];
export const getMap = (id: MapId): MapDef => MAPS[id] ?? SOUK;
