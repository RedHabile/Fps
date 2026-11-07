// ─────────────────────────────────────────────────────────────
//  VALENCE — Boutique : agents et skins d'armes
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  AGENT_LIST, ABILITIES, SKINS, SKIN_COLORS, xpForLevel,
  type Profile, type AgentId, type Skin,
} from '../game/agentsData';
import { sfx } from '../game/audio';
import {
  X, Coins, Check, Lock, Sparkles, Zap, ShieldCheck, Crosshair,
  Star, TrendingUp, Palette, Users,
} from 'lucide-react';

type Tab = 'agents' | 'skins';

/** aperçu stylisé d'une livrée d'arme */
function SkinPreview({ sk, size = 88 }: { sk: Skin; size?: number }) {
  return (
    <svg width={size} height={size * 0.42} viewBox="0 0 120 50">
      <defs>
        <linearGradient id={`g${sk.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sk.body} />
          <stop offset="100%" stopColor={sk.metal} />
        </linearGradient>
      </defs>
      <rect x="8" y="18" width="78" height="13" rx="2" fill={`url(#g${sk.id})`} />
      <rect x="86" y="20" width="26" height="6" rx="1" fill={sk.metal} />
      <rect x="18" y="31" width="13" height="16" rx="2" fill={sk.body} />
      <rect x="40" y="31" width="9" height="13" rx="1" fill={sk.metal} />
      <rect x="12" y="14" width="46" height="4" rx="1" fill={sk.accent}
        style={sk.emissive ? { filter: `drop-shadow(0 0 4px ${sk.emissive})` } : undefined} />
      <rect x="62" y="21" width="20" height="3" rx="1" fill={sk.accent} opacity="0.8" />
      <circle cx="30" cy="12" r="3.4" fill={sk.accent}
        style={sk.emissive ? { filter: `drop-shadow(0 0 5px ${sk.emissive})` } : undefined} />
    </svg>
  );
}

export default function Shop({ profile, setProfile, onClose }: {
  profile: Profile;
  setProfile: (p: Profile) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('skins');
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 1800); };

  const buyAgent = (id: AgentId, price: number) => {
    if (profile.ownedAgents.includes(id)) {
      sfx.uiClick();
      setProfile({ ...profile, agent: id });
      return;
    }
    if (profile.coins < price) { sfx.buyNo(); flash(`Il manque ${price - profile.coins} crédits`); return; }
    sfx.buyOk();
    setProfile({ ...profile, coins: profile.coins - price, ownedAgents: [...profile.ownedAgents, id], agent: id });
    flash('Agent débloqué !');
  };

  const buySkin = (sk: Skin) => {
    if (profile.ownedSkins.includes(sk.id)) {
      sfx.uiClick();
      setProfile({ ...profile, skin: sk.id });
      return;
    }
    if (profile.coins < sk.price) { sfx.buyNo(); flash(`Il manque ${sk.price - profile.coins} crédits`); return; }
    sfx.buyOk();
    setProfile({ ...profile, coins: profile.coins - sk.price, ownedSkins: [...profile.ownedSkins, sk.id], skin: sk.id });
    flash('Livrée débloquée !');
  };

  const need = xpForLevel(profile.level);
  const xpPct = Math.min(100, (profile.xp / need) * 100);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(4,8,12,.88)', backdropFilter: 'blur(10px)' }}>
      <div className="anim-reveal clip-card flex flex-col w-[980px] max-w-[97vw]"
        style={{ height: 'min(94vh, 740px)', background: 'rgba(12,20,29,.98)', border: '1px solid rgba(255,70,85,.4)' }}>

        {/* en-tête */}
        <div className="shrink-0 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-[#ff4655]" />
              <div>
                <div className="font-display font-bold text-xl tracking-[.18em] text-[#ece8e1]">BOUTIQUE</div>
                <div className="font-display text-[10px] tracking-[.2em] text-white/40">SKINS D’ARMES · ACHETEZ AVEC VOS CRÉDITS GAGNÉS EN MATCH</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* niveau */}
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end font-display text-[11px] font-bold tracking-widest text-[#4df3d3]">
                  <TrendingUp size={13} /> NIVEAU {profile.level}
                </div>
                <div className="w-28 h-1.5 mt-1" style={{ background: 'rgba(255,255,255,.12)' }}>
                  <div className="h-full" style={{ width: `${xpPct}%`, background: '#4df3d3' }} />
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <Coins size={16} className="text-[#ffd25d]" />
                  <span className="font-display font-bold text-2xl text-[#ffd25d]">{profile.coins}</span>
                </div>
                <div className="font-display text-[9px] tracking-[.25em] text-white/40">CRÉDITS</div>
              </div>
              <button onClick={onClose} className="text-white/45 hover:text-[#ff4655] transition-colors"><X size={22} /></button>
            </div>
          </div>
          {/* onglets */}
          <div className="flex gap-2 mt-3">
            {([['agents', 'AGENTS', <Users key="u" size={13} />], ['skins', 'LIVRÉES D\'ARMES', <Palette key="p" size={13} />]] as const).map(([k, t, i]) => (
              <button key={k} onClick={() => { sfx.uiClick(); setTab(k as Tab); }}
                className="clip-tag px-4 py-2 font-display text-[11px] font-bold tracking-[.18em] flex items-center gap-2 transition-all"
                style={{
                  background: tab === k ? '#ff4655' : 'rgba(255,255,255,.05)',
                  color: tab === k ? '#fff' : 'rgba(255,255,255,.5)',
                  border: `1px solid ${tab === k ? '#ff4655' : 'rgba(255,255,255,.14)'}`,
                }}>{i}{t}</button>
            ))}
          </div>
        </div>

        {/* contenu */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {tab === 'agents' && (
            <div className="grid grid-cols-3 gap-3">
              {AGENT_LIST.map((a) => {
                const owned = profile.ownedAgents.includes(a.id);
                const active = profile.agent === a.id;
                const q = ABILITIES[a.primary], u = ABILITIES[a.ultimate];
                return (
                  <button key={a.id} onClick={() => buyAgent(a.id, a.price)} onMouseEnter={() => sfx.uiHover()}
                    className="clip-card p-3.5 text-left transition-all relative overflow-hidden"
                    style={{
                      background: active ? `${a.color}22` : owned ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.028)',
                      border: `1px solid ${active ? a.color : owned ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.08)'}`,
                    }}>
                    {/* bandeau de rôle */}
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-display font-bold text-xl tracking-[.14em]" style={{ color: owned ? a.color : 'rgba(255,255,255,.5)' }}>{a.name}</div>
                        <div className="font-display text-[9px] tracking-[.22em] text-white/40 font-semibold">{a.role.toUpperCase()}</div>
                      </div>
                      {active ? <span className="flex items-center gap-1 font-display text-[10px] font-bold tracking-widest text-[#4df3d3]"><Check size={12} /> ACTIF</span>
                        : owned ? <span className="font-display text-[10px] tracking-widest text-white/35">POSSÉDÉ</span>
                          : <span className="flex items-center gap-1 font-display text-[11px] font-bold text-[#ffd25d]">{a.price}<Coins size={11} /></span>}
                    </div>
                    <div className="font-display text-[10px] leading-snug text-white/45 mb-2.5 min-h-[28px]">{a.bio}</div>
                    {/* pouvoirs */}
                    <div className="space-y-1.5">
                      {[['Q', q, <Zap key="z" size={11} />], ['X', u, <Star key="s" size={11} />]].map(([k, ab, ic]) => (
                        <div key={k as string} className="flex items-start gap-2 px-2 py-1.5"
                          style={{ background: 'rgba(0,0,0,.28)', border: '1px solid rgba(255,255,255,.07)' }}>
                          <span className="font-mono-t text-[10px] px-1 shrink-0" style={{ background: a.color + '33', color: a.color }}>{k as string}</span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-display text-[10px] font-bold tracking-wider" style={{ color: a.color }}>
                              {ic as React.ReactNode}{(ab as typeof q).name}
                            </span>
                            <span className="block font-display text-[9px] text-white/40 leading-tight">{(ab as typeof q).desc}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* stats */}
                    <div className="flex gap-3 mt-2 font-mono-t text-[9px] text-white/40">
                      <span>PV {a.hp}</span>
                      <span>VIT ×{a.speed.toFixed(2)}</span>
                    </div>
                    {!owned && (
                      <div className="absolute top-2 right-2 opacity-50"><Lock size={13} className="text-white/60" /></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'skins' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {SKINS.map((sk) => {
                const owned = profile.ownedSkins.includes(sk.id);
                const active = profile.skin === sk.id;
                const rc = SKIN_COLORS[sk.rarity];
                return (
                  <button key={sk.id} onClick={() => buySkin(sk)} onMouseEnter={() => sfx.uiHover()}
                    className="clip-card p-3 text-left transition-all relative hover:-translate-y-1 hover:brightness-125"
                    style={{
                      background: active ? `${rc}22` : owned ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.028)',
                      border: `1px solid ${active ? rc : owned ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)'}`,
                    }}>
                    <div className="flex justify-center py-1.5 mb-1"
                      style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <SkinPreview sk={sk} size={116} />
                    </div>
                    <div className="font-display font-bold text-[15px] tracking-wider text-[#ece8e1] truncate">{sk.name}</div>
                    <div className="font-display text-[8px] tracking-[.2em] font-bold mb-1" style={{ color: rc }}>
                      {sk.rarity.toUpperCase()} · {sk.collection}
                    </div>
                    <div className="flex items-center justify-between">
                      {active ? <span className="flex items-center gap-1 font-display text-[10px] font-bold tracking-widest text-[#4df3d3]"><Check size={11} /> ÉQUIPÉE</span>
                        : owned ? <span className="font-display text-[10px] tracking-widest text-white/35">POSSÉDÉE</span>
                          : <span className="flex items-center gap-1 font-display text-[11px] font-bold text-[#ffd25d]">{sk.price}<Coins size={11} /></span>}
                      {!owned && <Lock size={11} className="text-white/35" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* pied */}
        <div className="shrink-0 px-5 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,.09)', background: 'rgba(8,14,20,.9)' }}>
          <div className="flex items-center gap-4 font-display text-[10px] tracking-[.18em] text-white/40">
            <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-[#4df3d3]" /> {profile.wins} VICTOIRES</span>
            <span className="flex items-center gap-1.5"><Crosshair size={12} className="text-[#ff6d7a]" /> {profile.kills} ÉLIMINATIONS</span>
            <span>MATCHS : VICTOIRE +600 · DÉFAITE +220 · +35 / ÉLIMINATION</span>
          </div>
          <button onClick={onClose} className="vbtn vbtn-red clip-btn px-6 py-2.5 text-sm">VALIDER</button>
        </div>

        {msg && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-20 px-4 py-2 clip-tag anim-reveal pointer-events-none"
            style={{ background: 'rgba(40,8,12,.96)', border: '1px solid #ff4655' }}>
            <span className="font-display text-xs font-bold tracking-[.14em] text-[#ff8a93]">{msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
