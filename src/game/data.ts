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
export type SkinId = 'recruit' | 'glacier' | 'ember' | 'shadow' | 'forest' | 'gold' | 'neon' | 'arctic' | 'plasma' | 'toxic' | 'sunset' | 'ice' | 'void' | 'cyan' | 'cobalt' | 'crimson' | 'sandstorm' | 'digital' | 'carbon' | 'royal' | 'hazard' | 'aurora' | 'obsidian' | 'inferno' | 'titan' | 'spectral' | 'eclipse' | 'overlord' | 'vanguard' | 'warborn' | 'ace' | 'headhunter' | 'executioner' | 'nightmare' | 'unstoppable' | 'apex' | 'immortal' | 'reaper';
export type QuestId = 'matches' | 'kills' | 'rounds' | 'wins' | 'points' | 'hardWins';
export type AchievementId = 'first_win' | 'veteran_10' | 'legend_25' | 'headhunter_100' | 'war_machine_500' | 'hard_10' | 'hard_25' | 'one_vs_all' | 'grinder_50' | 'level_20';
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
  unlockLevel?: number;
  achievementId?: AchievementId;
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
  { id: 'cobalt', name: 'COBALT', rarity: 'RARE', description: 'Niveau 2. Un skin obtenu par progression.', price: 0, unlockLevel: 2, body: '#1e40af', detail: '#60a5fa', accent: '#dbeafe' },
  { id: 'crimson', name: 'CRIMSON', rarity: 'RARE', description: 'Niveau 4. Un skin obtenu par progression.', price: 0, unlockLevel: 4, body: '#7f1d1d', detail: '#ef4444', accent: '#fecaca' },
  { id: 'sandstorm', name: 'SANDSTORM', rarity: 'RARE', description: 'Niveau 6. Un skin obtenu par progression.', price: 0, unlockLevel: 6, body: '#92764c', detail: '#d6bd8b', accent: '#fff0c2' },
  { id: 'digital', name: 'DIGITAL CAMO', rarity: 'ÉPIQUE', description: 'Niveau 8. Un skin obtenu par progression.', price: 0, unlockLevel: 8, body: '#334155', detail: '#22d3ee', accent: '#e0f2fe' },
  { id: 'carbon', name: 'CARBONE', rarity: 'ÉPIQUE', description: 'Niveau 10. Un skin obtenu par progression.', price: 0, unlockLevel: 10, body: '#171717', detail: '#737373', accent: '#e5e5e5' },
  { id: 'royal', name: 'ROYAL', rarity: 'ÉPIQUE', description: 'Niveau 12. Un skin obtenu par progression.', price: 0, unlockLevel: 12, body: '#581c87', detail: '#c084fc', accent: '#fde68a' },
  { id: 'hazard', name: 'HAZARD', rarity: 'ÉPIQUE', description: 'Niveau 14. Un skin obtenu par progression.', price: 0, unlockLevel: 14, body: '#713f12', detail: '#facc15', accent: '#fff7ae' },
  { id: 'aurora', name: 'AURORA', rarity: 'LÉGENDAIRE', description: 'Niveau 16. Un skin obtenu par progression.', price: 0, unlockLevel: 16, body: '#115e59', detail: '#5eead4', accent: '#e9d5ff' },
  { id: 'obsidian', name: 'OBSIDIENNE', rarity: 'LÉGENDAIRE', description: 'Niveau 18. Un skin obtenu par progression.', price: 0, unlockLevel: 18, body: '#181025', detail: '#7c3aed', accent: '#ddd6fe' },
  { id: 'inferno', name: 'INFERNO', rarity: 'LÉGENDAIRE', description: 'Niveau 20. Un skin obtenu par progression.', price: 0, unlockLevel: 20, body: '#7c2d12', detail: '#f97316', accent: '#fef08a' },
  { id: 'titan', name: 'TITAN', rarity: 'LÉGENDAIRE', description: 'Niveau 25. Un skin obtenu par progression.', price: 0, unlockLevel: 25, body: '#334155', detail: '#94a3b8', accent: '#67e8f9' },
  { id: 'spectral', name: 'SPECTRAL', rarity: 'MYTHIQUE', description: 'Niveau 30. Un skin obtenu par progression.', price: 0, unlockLevel: 30, body: '#164e63', detail: '#67e8f9', accent: '#f0fdfa' },
  { id: 'eclipse', name: 'ÉCLIPSE', rarity: 'MYTHIQUE', description: 'Niveau 35. Un skin obtenu par progression.', price: 0, unlockLevel: 35, body: '#111827', detail: '#f59e0b', accent: '#fef3c7' },
  { id: 'overlord', name: 'OVERLORD', rarity: 'MYTHIQUE', description: 'Niveau 40. Un skin obtenu par progression.', price: 0, unlockLevel: 40, body: '#450a0a', detail: '#dc2626', accent: '#fca5a5' },
  { id: 'vanguard', name: 'VANGUARD', rarity: 'MYTHIQUE', description: 'Niveau 45. Un skin obtenu par progression.', price: 0, unlockLevel: 45, body: '#14532d', detail: '#4ade80', accent: '#d9f99d' },
  { id: 'warborn', name: 'WARBORN', rarity: 'EXCLUSIF', description: 'Récompense de première victoire.', price: 0, achievementId: 'first_win', body: '#78350f', detail: '#f59e0b', accent: '#ffedd5' },
  { id: 'ace', name: 'ACE', rarity: 'EXCLUSIF', description: 'Récompense pour dix victoires.', price: 0, achievementId: 'veteran_10', body: '#1e3a8a', detail: '#38bdf8', accent: '#e0f2fe' },
  { id: 'headhunter', name: 'HEADHUNTER', rarity: 'EXCLUSIF', description: 'Récompense pour cent éliminations.', price: 0, achievementId: 'headhunter_100', body: '#4c0519', detail: '#fb7185', accent: '#ffe4e6' },
  { id: 'executioner', name: 'EXECUTIONER', rarity: 'EXCLUSIF', description: 'Récompense pour cinq cents éliminations.', price: 0, achievementId: 'war_machine_500', body: '#292524', detail: '#ef4444', accent: '#fef2f2' },
  { id: 'nightmare', name: 'NIGHTMARE', rarity: 'EXCLUSIF', description: 'Dix victoires en difficulté ÉLITE.', price: 0, achievementId: 'hard_10', body: '#312e81', detail: '#a78bfa', accent: '#f5f3ff' },
  { id: 'unstoppable', name: 'UNSTOPPABLE', rarity: 'EXCLUSIF', description: 'Vingt-cinq victoires en difficulté ÉLITE.', price: 0, achievementId: 'hard_25', body: '#7f1d1d', detail: '#f87171', accent: '#fff1f2' },
  { id: 'apex', name: 'APEX', rarity: 'EXCLUSIF', description: 'Trente éliminations en une partie.', price: 0, achievementId: 'one_vs_all', body: '#713f12', detail: '#fbbf24', accent: '#fef9c3' },
  { id: 'immortal', name: 'IMMORTEL', rarity: 'EXCLUSIF', description: 'Cinquante missions terminées.', price: 0, achievementId: 'grinder_50', body: '#164e63', detail: '#22d3ee', accent: '#ecfeff' },
  { id: 'reaper', name: 'REAPER', rarity: 'EXCLUSIF', description: 'Vingt-cinq victoires.', price: 0, achievementId: 'legend_25', body: '#18181b', detail: '#a1a1aa', accent: '#fafafa' },
];

export interface Quest {
  id: QuestId;
  name: string;
  description: string;
  target: number;
  reward: number;
}
export const QUESTS: Quest[] = [
  { id: 'matches', name: 'PREMIER DÉPLOIEMENT', description: 'Terminer 2 parties.', target: 2, reward: 350 },
  { id: 'kills', name: 'TIR DE PRÉCISION', description: 'Éliminer 12 adversaires.', target: 12, reward: 500 },
  { id: 'rounds', name: 'PRISE DE CONTRÔLE', description: 'Remporter 6 manches.', target: 6, reward: 450 },
  { id: 'wins', name: 'MISSION ACCOMPLIE', description: 'Remporter 2 parties.', target: 2, reward: 650 },
  { id: 'points', name: 'OPÉRATEUR ACTIF', description: 'Gagner 1 500 points en partie.', target: 1500, reward: 550 },
  { id: 'hardWins', name: 'ÉPREUVE ÉLITE', description: 'Gagner une partie en difficulté ÉLITE.', target: 1, reward: 900 },
];
export interface QuestState {
  resetAt: number; activeIds: QuestId[]; matches: number; kills: number; rounds: number; wins: number; points: number; hardWins: number; claimed: QuestId[];
}
const QUEST_DURATION = 24 * 60 * 60 * 1000;
function newQuestState(now = Date.now()): QuestState {
  const pool = [...QUESTS];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { resetAt: now, activeIds: pool.slice(0, 3).map((q) => q.id), matches: 0, kills: 0, rounds: 0, wins: 0, points: 0, hardWins: 0, claimed: [] };
}
export function currentQuests(quests?: QuestState, now = Date.now()): QuestState {
  const valid = quests && typeof quests.resetAt === 'number' && now < quests.resetAt + QUEST_DURATION && Array.isArray(quests.activeIds) && quests.activeIds.length === 3 && quests.activeIds.every((id) => QUESTS.some((q) => q.id === id)) && Array.isArray(quests.claimed) && [quests.matches, quests.kills, quests.rounds, quests.wins, quests.points, quests.hardWins].every((v) => typeof v === 'number' && Number.isFinite(v));
  return quests && valid ? quests : newQuestState(now);
}
export function questTimeRemaining(quests: QuestState, now = Date.now()) { return Math.max(0, quests.resetAt + QUEST_DURATION - now); }
export interface Achievement { id: AchievementId; name: string; description: string; metric: 'wins' | 'matches' | 'kills' | 'hardWins' | 'bestMatchKills' | 'level'; target: number; }
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'PREMIÈRE VICTOIRE', description: 'Remporter votre première mission.', metric: 'wins', target: 1 },
  { id: 'veteran_10', name: 'VÉTÉRAN', description: 'Remporter 10 missions.', metric: 'wins', target: 10 },
  { id: 'legend_25', name: 'LÉGENDE', description: 'Remporter 25 missions.', metric: 'wins', target: 25 },
  { id: 'headhunter_100', name: 'CHASSEUR DE TÊTES', description: 'Réaliser 100 éliminations.', metric: 'kills', target: 100 },
  { id: 'war_machine_500', name: 'MACHINE DE GUERRE', description: 'Réaliser 500 éliminations.', metric: 'kills', target: 500 },
  { id: 'hard_10', name: 'SANS PITIÉ', description: 'Gagner 10 missions en difficulté ÉLITE.', metric: 'hardWins', target: 10 },
  { id: 'hard_25', name: 'INFERNAL', description: 'Gagner 25 missions en difficulté ÉLITE.', metric: 'hardWins', target: 25 },
  { id: 'one_vs_all', name: 'UN CONTRE TOUS', description: 'Réaliser 30 éliminations dans une seule partie.', metric: 'bestMatchKills', target: 30 },
  { id: 'grinder_50', name: 'INFATIGABLE', description: 'Terminer 50 missions.', metric: 'matches', target: 50 },
  { id: 'level_20', name: 'OPÉRATEUR DE LÉGENDE', description: 'Atteindre le niveau 20.', metric: 'level', target: 20 },
];
export function levelForXp(xp: number) { return Math.floor(Math.max(0, xp) / 500) + 1; }
export function isSkinUnlocked(skin: Skin, profile: Pick<Profile, 'ownedSkins' | 'xp' | 'achievements'>) {
  return profile.ownedSkins.includes(skin.id) || (skin.unlockLevel !== undefined && levelForXp(profile.xp) >= skin.unlockLevel) || (!!skin.achievementId && profile.achievements.includes(skin.achievementId));
}
export function skinUnlockText(skin: Skin) {
  if (skin.unlockLevel) return `NIVEAU ${skin.unlockLevel}`;
  if (skin.achievementId) return ACHIEVEMENTS.find((a) => a.id === skin.achievementId)?.name ?? 'SUCCÈS';
  return 'BOUTIQUE';
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
  xp: number;
  totalKills: number;
  hardWins: number;
  bestMatchKills: number;
  achievements: AchievementId[];
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
    xp: 0, totalKills: 0, hardWins: 0, bestMatchKills: 0, achievements: [],
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
    const profile: Profile = {
      credits: (typeof saved.credits === 'number' ? saved.credits : fallback.credits) + legacyRefund,
      ownedSkins,
      equippedSkin: saved.equippedSkin && ownedSkins.includes(saved.equippedSkin) ? saved.equippedSkin : 'recruit',
      quests: currentQuests(saved.quests),
      records: Array.isArray(saved.records) ? saved.records.slice(0, 10) : [],
      matches: typeof saved.matches === 'number' ? saved.matches : 0,
      wins: typeof saved.wins === 'number' ? saved.wins : 0,
      xp: typeof saved.xp === 'number' ? saved.xp : 0, totalKills: typeof saved.totalKills === 'number' ? saved.totalKills : 0,
      hardWins: typeof saved.hardWins === 'number' ? saved.hardWins : 0, bestMatchKills: typeof saved.bestMatchKills === 'number' ? saved.bestMatchKills : 0,
      achievements: Array.isArray(saved.achievements) ? saved.achievements.filter((id): id is AchievementId => ACHIEVEMENTS.some((a) => a.id === id)) : [],
    };
    const level = levelForXp(profile.xp);
    const bonus = SKINS.filter((s) => (s.unlockLevel !== undefined && level >= s.unlockLevel) || (s.achievementId !== undefined && profile.achievements.includes(s.achievementId))).map((s) => s.id);
    profile.ownedSkins = Array.from(new Set([...profile.ownedSkins, ...bonus]));
    return profile;
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