export type WeaponId = 'p12' | 'r45' | 'spectre' | 'viper' | 'bulldog' | 'phantom';
export type ArmorId = 'none' | 'light' | 'heavy';
export type GameMode = 'sd' | 'tdm';
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: { id: Difficulty; name: string; tagline: string }[] = [
  { id: 'easy', name: 'RECRUE', tagline: 'IA indulgente · réactions lentes et tirs moins précis' },
  { id: 'normal', name: 'VÉTÉRAN', tagline: 'IA tactique · réactions et précision équilibrées' },
  { id: 'hard', name: 'ÉLITE', tagline: 'IA redoutable · réactions rapides et tirs plus précis' },
];
export type WeaponSlot = 'sidearm' | 'primary';
export type GrenadeKind = 'frag' | 'flash';

export const MODES: { id: GameMode; name: string; tagline: string }[] = [
  { id: 'sd', name: 'SEARCH & DESTROY', tagline: 'POSES / DÉSAMORÇAGES / MANCHES' },
  { id: 'tdm', name: 'COMBAT EN ÉQUIPE', tagline: '50 ÉLIMINATIONS / 10 MINUTES' },
];

export const TDM_KILL_TARGET = 50;
export const TDM_DURATION = 600;
export const TDM_RESPAWN_DELAY = 4;

export function isPistolWeapon(kind: Weapon['kind']) {
  return kind === 'pistol' || kind === 'heavy-pistol';
}

export function slotForWeapon(kind: Weapon['kind']): WeaponSlot {
  return isPistolWeapon(kind) ? 'sidearm' : 'primary';
}
export type MapId = 'depot' | 'terminal' | 'usine' | 'forteresse';
export type SkinId = 'recruit' | 'glacier' | 'ember' | 'shadow' | 'forest' | 'gold' | 'neon' | 'arctic' | 'plasma' | 'toxic' | 'sunset' | 'ice' | 'void' | 'cyan';
export type QuestId = 'matches' | 'kills' | 'rounds';
export type Team = 'blue' | 'red';

export const MAPS: { id: MapId; name: string; code: string; indoor: boolean }[] = [
  { id: 'depot', name: 'D\u00c9P\u00d4T 09', code: 'DEPOT 09', indoor: false },
  { id: 'terminal', name: 'M\u00c9TRO 17', code: 'METRO 17', indoor: true },
  { id: 'usine', name: 'USINE 04', code: 'USINE 04', indoor: true },
  { id: 'forteresse', name: 'FORTERESSE 21', code: 'FORT 21', indoor: false },
];

export interface Weapon {
  id: WeaponId;
  kind: 'pistol' | 'heavy-pistol' | 'smg' | 'rifle' | 'shotgun' | 'marksman';
  name: string;
  family: string;
  description: string;
  price: number;
  damage: number;
  rate: number;
  magazine: number;
  reload: number;
  color: string;
  pellets?: number;
  spread?: number;
}

export const WEAPONS: Weapon[] = [
  {
    id: 'p12', kind: 'pistol', name: 'P-12 VIGIL', family: 'ARME DE POING',
    description: 'Un pistolet pr\u00e9cis pour les premiers contacts.', price: 0,
    damage: 34, rate: 0.23, magazine: 12, reload: 1.2, color: '#a6c4b6',
  },
  {
    id: 'r45', kind: 'heavy-pistol', name: 'R-45 REAPER', family: 'ARME DE POING',
    description: 'Un pistolet lourd, lent mais puissant.', price: 600,
    damage: 46, rate: 0.38, magazine: 8, reload: 1.45, color: '#c9a988',
  },
  {
    id: 'spectre', kind: 'smg',
    name: 'MP-7 SPECTRE',
    family: 'PISTOLET-MITRAILLEUR',
    description: 'Une cadence redoutable pour les combats rapproch\u00e9s.',
    price: 1500,
    damage: 22,
    rate: 0.09,
    magazine: 36,
    reload: 1.25,
    color: '#9ba9a8',
  },
  {
    id: 'viper', kind: 'rifle', name: 'VX-9 VIPER', family: 'FUSIL D\'ASSAUT',
    description: 'Fiable et polyvalent. Le choix des op\u00e9rateurs.', price: 2200,
    damage: 30, rate: 0.16, magazine: 30, reload: 1.55, color: '#76c9c1',
  },
  {
    id: 'bulldog', kind: 'shotgun', name: 'SG-8 BULLDOG', family: 'FUSIL \u00c0 POMPE',
    description: 'Cinq plombs d\u00e9vastateurs \u00e0 courte distance.', price: 2800,
    damage: 16, rate: 0.68, magazine: 8, reload: 1.7, color: '#d0a279', pellets: 5, spread: 0.045,
  },
  {
    id: 'phantom', kind: 'marksman',
    name: 'MK-18 PHANTOM',
    family: 'FUSIL DE PR\u00c9CISION',
    description: 'Plus lent, mais chaque impact compte.',
    price: 3600,
    damage: 49,
    rate: 0.29,
    magazine: 20,
    reload: 1.8,
    color: '#bba98a',
  },
];

export interface Armor {
  id: ArmorId;
  name: string;
  price: number;
  capacity: number;
  absorption: number;
}

export const ARMORS: Armor[] = [
  { id: 'none', name: 'SANS ARMURE', price: 0, capacity: 0, absorption: 0 },
  { id: 'light', name: 'ARMURE L\u00c9G\u00c8RE', price: 1000, capacity: 50, absorption: 0.5 },
  { id: 'heavy', name: 'ARMURE LOURDE', price: 2000, capacity: 100, absorption: 0.65 },
];

export interface Skin {
  id: SkinId;
  name: string;
  rarity: string;
  description: string;
  price: number;
  body: string;
  detail: string;
  accent: string;
}

export const SKINS: Skin[] = [
  { id: 'recruit', name: 'RECRUE', rarity: 'STANDARD', description: 'La finition de service, sobre et fiable.', price: 0, body: '#566a62', detail: '#83988a', accent: '#c3d9c7' },
  { id: 'glacier', name: 'MAR\u00c9E FROIDE', rarity: 'RARE', description: 'Un camouflage bleu glacier pour garder la t\u00eate froide.', price: 850, body: '#407783', detail: '#8bc9c5', accent: '#c4f7e9' },
  { id: 'ember', name: 'BRASIER', rarity: 'RARE', description: 'Une finition cuivr\u00e9e qui ne passe pas inaper\u00e7ue.', price: 1400, body: '#8e5038', detail: '#d0935f', accent: '#ffd09a' },
  { id: 'shadow', name: 'OMBRE', rarity: '\u00c9PIQUE', description: 'Des reflets nocturnes pour les op\u00e9rations discr\u00e8tes.', price: 2100, body: '#424966', detail: '#8b94b7', accent: '#d3dcff' },
  { id: 'forest', name: 'CANOP\u00c9E', rarity: 'RARE', description: 'Un camouflage vert con\u00e7u pour les approches discr\u00e8tes.', price: 1050, body: '#526a3e', detail: '#98a76b', accent: '#d7e6a1' },
  { id: 'gold', name: 'OR SOLAIRE', rarity: '\u00c9PIQUE', description: 'Une finition m\u00e9tallique aux reflets dor\u00e9s.', price: 2600, body: '#826a35', detail: '#d2b768', accent: '#ffe8a0' },
  { id: 'neon', name: 'IMPULSION', rarity: '\u00c9PIQUE', description: 'Des accents vifs pour les op\u00e9rations nocturnes.', price: 2800, body: '#523d6f', detail: '#aa77b7', accent: '#ffb8e5' },
  { id: 'arctic', name: 'BLANC POLAIRE', rarity: 'RARE', description: 'Un rev\u00eatement clair aux d\u00e9tails bleu acier.', price: 1550, body: '#a6b9b6', detail: '#d9e5df', accent: '#80cbd4' },
  { id: 'cyan', name: 'CYAN CORE', rarity: 'ÉPIQUE', description: 'Un noyau cyan lumineux inspiré du skin classique de SPIKE PROTOCOL.', price: 1900, body: '#0891b2', detail: '#a5f3fc', accent: '#ffffff' },
  { id: 'plasma', name: 'PLASMA', rarity: 'LÉGENDAIRE', description: 'Un habillage violet électrique aux reflets magenta.', price: 3200, body: '#a21caf', detail: '#f0abfc', accent: '#ffffff' },
  { id: 'toxic', name: 'TOXIC', rarity: 'ÉPIQUE', description: 'Un vert acide qui pulse comme une énergie instable.', price: 2400, body: '#4d7c0f', detail: '#bef264', accent: '#f7fee7' },
  { id: 'sunset', name: 'SUNSET', rarity: 'ÉPIQUE', description: 'Des tons braise et cuivre aux accents orange incandescent.', price: 2600, body: '#c2410c', detail: '#fdba74', accent: '#fff7ed' },
  { id: 'ice', name: 'ICE', rarity: 'RARE', description: 'Un revêtement bleu glacier aux reflets givrés.', price: 1750, body: '#2563eb', detail: '#bfdbfe', accent: '#ffffff' },
  { id: 'void', name: 'VOID', rarity: 'LÉGENDAIRE', description: 'Une finition violette abyssale aux reflets spectraux.', price: 3600, body: '#6d28d9', detail: '#c4b5fd', accent: '#f5f3ff' },
];

export interface Quest {
  id: QuestId;
  name: string;
  description: string;
  target: number;
  reward: number;
}

export const QUESTS: Quest[] = [
  { id: 'matches', name: 'PREMIER D\u00c9PLOIEMENT', description: 'Terminer une partie.', target: 1, reward: 300 },
  { id: 'kills', name: 'TIR DE PR\u00c9CISION', description: '\u00c9liminer 5 adversaires.', target: 5, reward: 450 },
  { id: 'rounds', name: 'PRISE DE CONTR\u00d4LE', description: 'Remporter 4 manches.', target: 4, reward: 400 },
];

export interface QuestState {
  day: string;
  matches: number;
  kills: number;
  rounds: number;
  claimed: QuestId[];
}

export function questDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function currentQuests(quests?: QuestState): QuestState {
  if (quests?.day === questDay() && Array.isArray(quests.claimed) &&
    [quests.matches, quests.kills, quests.rounds].every((value) => typeof value === 'number' && Number.isFinite(value))) return quests;
  return { day: questDay(), matches: 0, kills: 0, rounds: 0, claimed: [] };
}

export interface MatchRecord {
  points: number;
  kills: number;
  won: boolean;
  date: string;
  mode: GameMode;
}

export interface Profile {
  credits: number;
  ownedSkins: SkinId[];
  equippedSkin: SkinId;
  quests: QuestState;
  records: MatchRecord[];
  matches: number;
  wins: number;
}

export interface MatchResult {
  won: boolean;
  blueScore: number;
  redScore: number;
  kills: number;
  points: number;
  credits: number;
  mode: GameMode;
}

const PROFILE_KEY = 'breach-point-profile-v1';

export function loadProfile(): Profile {
  const fallback: Profile = {
    credits: 500,
    ownedSkins: ['recruit'],
    equippedSkin: 'recruit',
    quests: currentQuests(),
    records: [],
    matches: 0,
    wins: 0,
  };
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<Profile> & { owned?: WeaponId[] };
    const ownedSkins = Array.isArray(saved.ownedSkins)
      ? saved.ownedSkins.filter((id): id is SkinId => SKINS.some((skin) => skin.id === id))
      : ['recruit' as const];
    if (!ownedSkins.includes('recruit')) ownedSkins.push('recruit');
    // Old permanent weapon purchases become round purchases, so refund them once.
    const legacyRefund = !saved.ownedSkins && Array.isArray(saved.owned)
      ? saved.owned.reduce((sum, id) => sum + (id === 'spectre' ? 1200 : id === 'phantom' ? 2400 : 0), 0)
      : 0;
    return {
      credits: (typeof saved.credits === 'number' ? saved.credits : fallback.credits) + legacyRefund,
      ownedSkins,
      equippedSkin: saved.equippedSkin && ownedSkins.includes(saved.equippedSkin) ? saved.equippedSkin : 'recruit',
      quests: currentQuests(saved.quests),
      records: Array.isArray(saved.records) ? saved.records.slice(0, 10) : [],
      matches: typeof saved.matches === 'number' ? saved.matches : 0,
      wins: typeof saved.wins === 'number' ? saved.wins : 0,
    };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value);
}