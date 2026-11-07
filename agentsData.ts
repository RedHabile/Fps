// ─────────────────────────────────────────────────────────────
//  VALENCE — Agents jouables, pouvoirs, skins et progression
// ─────────────────────────────────────────────────────────────

export type AbilityId = 'dash' | 'smoke' | 'flash' | 'heal' | 'wall' | 'scan' | 'turret' | 'shield';
export type AgentId = 'embre' | 'spectre' | 'atlas' | 'vega' | 'kodiak' | 'nyx';

export interface Ability {
  id: AbilityId;
  name: string;
  desc: string;
  cooldown: number;     // s
  charges: number;      // utilisations par manche
  duration: number;     // s d'effet
  key: string;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  dash: { id: 'dash', name: 'FULGURANCE', desc: 'Bond instantané vers l\'avant, esquive les tirs', cooldown: 9, charges: 2, duration: 0.22, key: 'Q' },
  smoke: { id: 'smoke', name: 'VOILE', desc: 'Nuage opaque qui bloque la vision ennemie', cooldown: 14, charges: 2, duration: 11, key: 'Q' },
  flash: { id: 'flash', name: 'ÉCLAT', desc: 'Détonation aveuglante pour percer un angle', cooldown: 12, charges: 2, duration: 2.4, key: 'Q' },
  heal: { id: 'heal', name: 'REGAIN', desc: 'Régénère vos points de vie sur la durée', cooldown: 18, charges: 1, duration: 5, key: 'Q' },
  wall: { id: 'wall', name: 'RAVELIN', desc: 'Mur d\'énergie temporaire, coupe une ligne', cooldown: 20, charges: 1, duration: 14, key: 'Q' },
  scan: { id: 'scan', name: 'SONDE', desc: 'Révèle les ennemis proches sur la minimap', cooldown: 15, charges: 2, duration: 5, key: 'Q' },
  turret: { id: 'turret', name: 'SENTINELLE', desc: 'Tourelle automatique qui tire sur les intrus', cooldown: 30, charges: 1, duration: 22, key: 'Q' },
  shield: { id: 'shield', name: 'ÉGIDE', desc: 'Barrière personnelle qui absorbe les dégâts', cooldown: 16, charges: 1, duration: 7, key: 'Q' },
};

export interface AgentDef {
  id: AgentId;
  name: string;
  role: 'Duelliste' | 'Contrôleur' | 'Initiateur' | 'Sentinelle';
  bio: string;
  color: string;
  primary: AbilityId;    // touche Q
  ultimate: AbilityId;   // touche X (plus puissante)
  speed: number;         // multiplicateur de vitesse
  hp: number;
  price: number;         // 0 = débloqué d'office
}

export const AGENTS: Record<AgentId, AgentDef> = {
  embre: {
    id: 'embre', name: 'EMBRE', role: 'Duelliste', color: '#ff4655',
    bio: 'Entre la première, sort la dernière. Spécialiste de l\'ouverture brutale.',
    primary: 'dash', ultimate: 'flash', speed: 1.06, hp: 100, price: 0,
  },
  spectre: {
    id: 'spectre', name: 'SPECTRE', role: 'Contrôleur', color: '#9b5dff',
    bio: 'Efface les angles. Là où elle passe, plus personne ne voit rien.',
    primary: 'smoke', ultimate: 'wall', speed: 1, hp: 100, price: 0,
  },
  atlas: {
    id: 'atlas', name: 'ATLAS', role: 'Sentinelle', color: '#4df3d3',
    bio: 'Ancré comme un bunker. Il tient un site à lui seul.',
    primary: 'turret', ultimate: 'shield', speed: 0.94, hp: 115, price: 1500,
  },
  vega: {
    id: 'vega', name: 'VÉGA', role: 'Initiateur', color: '#ffd25d',
    bio: 'Voit avant de frapper. Aucun angle ne lui reste caché.',
    primary: 'scan', ultimate: 'flash', speed: 1.02, hp: 100, price: 1500,
  },
  kodiak: {
    id: 'kodiak', name: 'KODIAK', role: 'Sentinelle', color: '#7affa0',
    bio: 'Soigne l\'escouade sous le feu. Increvable et agaçant.',
    primary: 'heal', ultimate: 'shield', speed: 0.96, hp: 110, price: 2500,
  },
  nyx: {
    id: 'nyx', name: 'NYX', role: 'Duelliste', color: '#ff5fae',
    bio: 'Deux bonds, trois angles, zéro survivant. Vitesse pure.',
    primary: 'dash', ultimate: 'smoke', speed: 1.14, hp: 90, price: 2500,
  },
};

export const AGENT_LIST = Object.values(AGENTS);

// ═══════════════ SKINS ═══════════════
export type SkinId = string;

export interface Skin {
  id: SkinId;
  name: string;
  collection: string;
  weapon: string;         // 'all' ou un WeaponId
  price: number;
  rarity: 'commun' | 'rare' | 'épique' | 'légendaire';
  /** teintes appliquées au modèle 3D */
  body: string;
  accent: string;
  metal: string;
  emissive?: string;      // lueur optionnelle
}

const RARITY_PRICE = { commun: 400, rare: 900, épique: 1800, légendaire: 3500 };

const mk = (
  id: string, name: string, collection: string, weapon: string,
  rarity: Skin['rarity'], body: string, accent: string, metal: string, emissive?: string,
): Skin => ({ id, name, collection, weapon, price: RARITY_PRICE[rarity], rarity, body, accent, metal, emissive });

export const SKINS: Skin[] = [
  // ─── Collection standard (toutes armes) ───
  mk('std', 'STANDARD', 'Dotation', 'all', 'commun', '#2c313a', '#ff4655', '#23272e'),
  mk('sable', 'SABLE', 'Désert', 'all', 'commun', '#9b8560', '#d8a24a', '#6b5c42'),
  mk('arctique', 'ARCTIQUE', 'Polaire', 'all', 'commun', '#b9c6d1', '#2f6f8f', '#8ea0b0'),
  mk('charbon', 'CHARBON', 'Nocturne', 'all', 'commun', '#17191d', '#444a53', '#0e1013'),
  // rares
  mk('cobalt', 'COBALT', 'Prisme', 'all', 'rare', '#1e3a6e', '#45b0ff', '#15264a', '#45b0ff'),
  mk('venin', 'VENIN', 'Toxine', 'all', 'rare', '#1f3320', '#7cff4d', '#16241a', '#7cff4d'),
  mk('braise', 'BRAISE', 'Forge', 'all', 'rare', '#2e1512', '#ff7a2f', '#1d0d0b', '#ff7a2f'),
  mk('ivoire', 'IVOIRE', 'Cérémonie', 'all', 'rare', '#e8e2d4', '#c8a04a', '#cfc7b4'),
  // épiques
  mk('neon', 'NÉON-X', 'Shinjuku', 'all', 'épique', '#1a1030', '#ff2d78', '#120a24', '#ff2d78'),
  mk('spectral', 'SPECTRAL', 'Outremonde', 'all', 'épique', '#16202b', '#59d7ff', '#0d161f', '#59d7ff'),
  mk('or', 'OR MASSIF', 'Souverain', 'all', 'épique', '#8a6a1f', '#ffd25d', '#6b5218', '#ffd25d'),
  mk('abysse', 'ABYSSE', 'Profondeur', 'all', 'épique', '#0d1a24', '#1fd6c4', '#08131a', '#1fd6c4'),
  // légendaires
  mk('radiant', 'RADIANT', 'Protocole', 'all', 'légendaire', '#2a0d14', '#ff1f45', '#1a070d', '#ff2a55'),
  mk('prisme', 'PRISME', 'Protocole', 'all', 'légendaire', '#1b1038', '#b45dff', '#120a26', '#c77aff'),
  mk('aurore', 'AURORE', 'Protocole', 'all', 'légendaire', '#0f2a26', '#4dffd0', '#081a17', '#4dffd0'),
];

export const SKIN_COLORS: Record<Skin['rarity'], string> = {
  commun: '#9aa4b2', rare: '#45b0ff', épique: '#b45dff', légendaire: '#ffd25d',
};

// ═══════════════ PROGRESSION (persistée) ═══════════════
export interface Profile {
  coins: number;              // monnaie gagnée en jouant
  agent: AgentId;
  ownedAgents: AgentId[];
  skin: SkinId;
  ownedSkins: SkinId[];
  wins: number;
  losses: number;
  kills: number;
  level: number;
  xp: number;
}

export const DEFAULT_PROFILE: Profile = {
  coins: 1200,
  agent: 'embre',
  ownedAgents: ['embre', 'spectre'],
  skin: 'std',
  ownedSkins: ['std'],
  wins: 0, losses: 0, kills: 0, level: 1, xp: 0,
};

const KEY = 'valence-profile-v1';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Profile>;
      return {
        ...DEFAULT_PROFILE, ...p,
        ownedAgents: [...new Set([...DEFAULT_PROFILE.ownedAgents, ...(p.ownedAgents ?? [])])],
        ownedSkins: [...new Set([...DEFAULT_PROFILE.ownedSkins, ...(p.ownedSkins ?? [])])],
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** XP nécessaire pour le niveau suivant */
export const xpForLevel = (lvl: number) => 500 + lvl * 250;

/** Récompenses de fin de match */
export function matchReward(win: boolean, kills: number, rounds: number) {
  const base = win ? 600 : 220;
  const coins = base + kills * 35 + rounds * 25;
  const xp = (win ? 300 : 120) + kills * 20;
  return { coins, xp };
}
