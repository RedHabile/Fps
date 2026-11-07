// ─────────────────────────────────────────────────────────────
//  VALENCE — Interface en jeu (HUD façon Valorant)
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { store, type CrosshairCfg } from '../game/store';
import { liveFrame, type Game } from '../game/engine';
import { getMap } from '../game/maps';
import { WEAPONS, SHOP_ORDER, SHIELD_LIGHT, SHIELD_HEAVY, isPrimary } from '../game/weapons';
import { sfx } from '../game/audio';
import {
  Shield, ShieldHalf, Heart, Coins, Crosshair as CrossIcon, Skull,
  RotateCw, Footprints, Zap, Play, LogOut, Gauge, Target,
  Bomb, ShoppingCart, Swords, ShieldCheck, Repeat, Hand, X, Star, TrendingUp,
} from 'lucide-react';

export function useSnap() { return useSyncExternalStore(store.subscribe, store.getSnapshot); }

// ————— Viseur personnalisable —————
export function CrosshairView({ cfg, spread, hidden }: { cfg: CrosshairCfg; spread: number; hidden?: boolean }) {
  if (hidden) return null;
  const gap = cfg.gap + (cfg.dynamic ? Math.min(70, spread) : 0);
  const L = cfg.length, T = cfg.thickness;
  const line = (st: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    background: cfg.color,
    boxShadow: cfg.outline ? `0 0 0 1px rgba(0,0,0,.85), 0 0 6px ${cfg.color}66` : `0 0 6px ${cfg.color}66`,
    ...st,
  });
  return (
    <div className="absolute left-1/2 top-1/2 z-20 pointer-events-none" style={{ transform: 'translate(-50%,-50%)' }}>
      <div style={line({ width: T, height: L, left: -T / 2, top: -gap - L })} />
      <div style={line({ width: T, height: L, left: -T / 2, top: gap })} />
      <div style={line({ width: L, height: T, top: -T / 2, left: -gap - L })} />
      <div style={line({ width: L, height: T, top: -T / 2, left: gap })} />
      {cfg.dot && <div style={line({ width: T, height: T, left: -T / 2, top: -T / 2 })} />}
    </div>
  );
}

function Crosshair() {
  const s = useSnap();
  if (s.scoped || !s.pointerLocked || s.paused || s.buyOpen) return null;
  return <CrosshairView cfg={s.settings.crosshair} spread={s.spread} />;
}

// ————— Lunette —————
function ScopeOverlay() {
  const s = useSnap();
  const [dim, setDim] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setDim({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  if (!s.scoped) return null;
  const cfg = WEAPONS[s.weapon];
  const zoom = s.adsLevel === 2 ? '×4.0' : cfg.id === 'operator' ? '×2.5' : cfg.id === 'marshal' ? '×2.5' : '×1.8';
  const R = Math.min(dim.h * 0.37, 380);
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, transparent ${R - 2}px, rgba(2,5,9,0.99) ${R}px)` }} />
      <svg className="absolute inset-0 w-full h-full">
        <circle cx="50%" cy="50%" r={R} fill="none" stroke="#0a1118" strokeWidth="4" />
        <circle cx="50%" cy="50%" r={R - 7} fill="none" stroke="#ff4655" strokeWidth="1" opacity="0.55" />
        <line x1="50%" y1={`calc(50% - ${R}px)`} x2="50%" y2={`calc(50% - 18px)`} stroke="#0a1118" strokeWidth="1.6" />
        <line x1="50%" y1={`calc(50% + 18px)`} x2="50%" y2={`calc(50% + ${R}px)`} stroke="#0a1118" strokeWidth="1.6" />
        <line x1={`calc(50% - ${R}px)`} y1="50%" x2={`calc(50% - 18px)`} y2="50%" stroke="#0a1118" strokeWidth="1.6" />
        <line x1={`calc(50% + 18px)`} y1="50%" x2={`calc(50% + ${R}px)`} y2="50%" stroke="#0a1118" strokeWidth="1.6" />
        {[-3, -2, -1, 1, 2, 3].map((i) => (
          <line key={i} x1="calc(50% - 7px)" y1={`calc(50% + ${i * 26}px)`} x2="calc(50% + 7px)" y2={`calc(50% + ${i * 26}px)`} stroke="#0a1118" strokeWidth="1.4" />
        ))}
        <circle cx="50%" cy="50%" r="2" fill="#0a1118" />
      </svg>
      <div className="absolute left-1/2 top-[15%] -translate-x-1/2 font-display font-bold text-[#ff4655] tracking-[.3em] text-lg">{zoom}</div>
    </div>
  );
}

// ————— Hitmarker —————
function Hitmarker() {
  const s = useSnap();
  if (Date.now() - s.hitmarker > 190) return null;
  const col = s.hitKill ? '#ff4655' : '#ffffff';
  const mk = (rot: number): React.CSSProperties => ({
    position: 'absolute', width: 11, height: 2.6, background: col,
    left: '50%', top: '50%',
    transform: `translate(-50%,-50%) rotate(${rot}deg) translateY(${s.hitKill ? 12 : 10}px)`,
    clipPath: 'polygon(0 0, 100% 0, 86% 100%, 14% 100%)',
    boxShadow: '0 0 0 1px rgba(0,0,0,.6)',
  });
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" style={{ animation: 'hitPop .19s ease-out both' }}>
      <div className="absolute left-1/2 top-1/2">
        <div style={mk(45)} /><div style={mk(135)} /><div style={mk(225)} /><div style={mk(315)} />
      </div>
    </div>
  );
}

// ————— Dégâts reçus —————
function DamageIndicator() {
  const s = useSnap();
  const age = Date.now() - s.dmgFlash;
  if (age > 650 || s.dmgDir === null) return null;
  const op = 1 - age / 650;
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 38%, rgba(255,28,45,${0.5 * op}) 100%)` }} />
      <div className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%,-50%) rotate(${s.dmgDir}rad)` }}>
        <div style={{
          width: 0, height: 0, transform: 'translateY(-115px)',
          borderLeft: '28px solid transparent', borderRight: '28px solid transparent',
          borderBottom: `17px solid rgba(255,70,85,${0.92 * op})`, filter: 'blur(1px)',
        }} />
      </div>
    </div>
  );
}

// ————— Killfeed —————
function KillFeed() {
  const s = useSnap();
  const items = s.feed.filter((f) => Date.now() - f.ts < 5200).slice(-3);
  return (
    <div className="absolute top-5 right-5 z-20 flex flex-col gap-1 items-end pointer-events-none">
      {items.map((f) => (
        <div key={f.id} className="anim-feed flex items-center gap-2 px-2.5 py-1 clip-tag"
          style={{ background: f.mine ? 'rgba(15,25,35,.88)' : 'rgba(15,25,35,.6)', border: `1px solid ${f.mine ? '#ff465566' : '#ffffff22'}` }}>
          <span className="font-display font-bold text-xs tracking-wider" style={{ color: f.killer === 'VOUS' ? '#4df3d3' : '#ff6d7a' }}>{f.killer}</span>
          <CrossIcon size={13} className="text-white/70" />
          {f.headshot && <span className="font-display text-[10px] font-bold text-[#ffd25d] border border-[#ffd25d66] px-1">TÊTE</span>}
          <span className="font-display font-bold text-sm tracking-wider" style={{ color: f.victim === 'VOUS' ? '#4df3d3' : '#ece8e1' }}>{f.victim}</span>
        </div>
      ))}
    </div>
  );
}

function KillToast() {
  const s = useSnap();
  if (!s.lastKill || Date.now() - s.lastKill.ts > 2200) return null;
  return (
    <div className="absolute left-1/2 bottom-[22%] -translate-x-1/2 z-20 text-center pointer-events-none anim-reveal">
      <div className="font-display font-bold text-xl tracking-[.18em] text-[#ff4655]" style={{ textShadow: '0 0 22px rgba(255,70,85,.8)' }}>
        {s.lastKill.name} ÉLIMINÉ
      </div>
      <div className="font-display text-sm tracking-[.2em] text-[#ffd25d]">
        +200 CR {s.lastKill.head && <span className="text-white/70">· TIR À LA TÊTE</span>}
      </div>
    </div>
  );
}

// ————— Barre haute —————
function TopBar() {
  const s = useSnap();
  const pips = Array.from({ length: s.targetWins * 2 - 1 }, (_, i) => i);
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
      <div className="flex items-stretch clip-card overflow-hidden" style={{ background: 'rgba(10,18,26,.85)', backdropFilter: 'blur(6px)' }}>
        <div className="flex items-center px-4 py-1.5 font-display font-bold text-2xl text-[#4df3d3]" style={{ background: 'rgba(34,211,182,.12)' }}>{s.score[0]}</div>
        <div className="flex flex-col items-center px-5 py-0.5 min-w-[108px]">
          <div className={`font-mono-t text-xl leading-6 ${s.timer <= 10 && s.phase === 'live' ? 'text-[#ff4655]' : 'text-[#ece8e1]'}`}
            style={s.timer <= 10 && s.phase === 'live' ? { animation: 'tickPulse 1s infinite' } : {}}>
            {Math.floor(s.timer / 60)}:{String(s.timer % 60).padStart(2, '0')}
          </div>
          <div className="flex items-center gap-1 font-display text-[10px] tracking-[.2em] font-bold"
            style={{ color: s.side === 'attack' ? '#ff8a5d' : '#4df3d3' }}>
            {s.side === 'attack' ? <Swords size={10} /> : <ShieldCheck size={10} />}
            {s.side === 'attack' ? 'ATTAQUE' : 'DÉFENSE'}
            <span className="text-white/35 ml-1">· M{s.round}</span>
          </div>
        </div>
        <div className="flex items-center px-4 py-1.5 font-display font-bold text-2xl text-[#ff4655]" style={{ background: 'rgba(255,70,85,.14)' }}>{s.score[1]}</div>
      </div>
      <div className="flex gap-1 mt-1.5">
        {pips.map((i) => {
          const mid = s.targetWins - 1;
          const mine = i < mid;
          const idx = mine ? i : i - mid;
          const filled = mine ? idx < s.score[0] : idx < s.score[1];
          return <div key={i} className="w-2 h-2 rotate-45" style={{ background: filled ? (mine ? '#4df3d3' : '#ff4655') : 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.2)' }} />;
        })}
      </div>
      <div className="hidden" style={{ background: 'rgba(10,18,26,.74)' }}>
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[9px] tracking-[.25em] text-[#4df3d3]/70 font-semibold">ÉQUIPE</span>
          {Array.from({ length: s.alliesTotal }).map((_, i) => (
            <div key={i} className="w-3 h-3 rotate-45" style={{
              background: i < s.alliesAlive ? '#4df3d3' : 'transparent',
              border: `1.5px solid ${i < s.alliesAlive ? '#4df3d3' : '#ffffff28'}`,
              boxShadow: i < s.alliesAlive ? '0 0 7px rgba(77,243,211,.6)' : 'none',
            }} />
          ))}
        </span>
        <span className="w-px h-4 bg-white/15" />
        <span className="flex items-center gap-1.5">
          {Array.from({ length: s.enemiesTotal }).map((_, i) => (
            <div key={i} className="w-3 h-3 rotate-45" style={{
              background: i < s.enemiesAlive ? '#ff4655' : 'transparent',
              border: `1.5px solid ${i < s.enemiesAlive ? '#ff4655' : '#ffffff28'}`,
              boxShadow: i < s.enemiesAlive ? '0 0 7px rgba(255,70,85,.6)' : 'none',
            }} />
          ))}
          <span className="font-display text-[9px] tracking-[.25em] text-[#ff4655]/70 font-semibold">HOSTILES</span>
        </span>
      </div>
    </div>
  );
}

// ————— Minimap —————
function Minimap({ touch }: { touch: boolean }) {
  const s = useSnap();
  const ref = useRef<HTMLCanvasElement>(null);
  const SIZE = touch ? 104 : 156;
  const RANGE = 84;
  const map = getMap(s.mapId);

  const base = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE * 2;
    const g = c.getContext('2d')!;
    const k = (SIZE * 2) / RANGE;
    const X = (x: number) => (x + RANGE / 2) * k;
    const Z = (z: number) => (z + RANGE / 2) * k;
    g.fillStyle = '#0b121a'; g.fillRect(0, 0, SIZE * 2, SIZE * 2);
    for (const z of map.zones) {
      g.fillStyle = '#1c2d3e';
      g.fillRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * k, (z.z1 - z.z0) * k);
    }
    for (const so of map.solids) {
      g.fillStyle = '#05080c';
      g.fillRect(X(so.x - so.w / 2), Z(so.z - so.d / 2), so.w * k, so.d * k);
    }
    for (const site of [map.siteA, map.siteB]) {
      g.strokeStyle = 'rgba(255,70,85,.8)'; g.lineWidth = 3; g.setLineDash([9, 6]);
      g.beginPath(); g.arc(X(site.x), Z(site.z), site.r * k, 0, 7); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(236,232,225,.9)';
      g.font = '800 26px Rajdhani, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(site.name, X(site.x), Z(site.z));
    }
    return c;
  }, [map]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = ref.current;
      if (!cv) return;
      const g = cv.getContext('2d')!;
      const k = (SIZE * 2) / RANGE;
      const X = (x: number) => (x + RANGE / 2) * k;
      const Z = (z: number) => (z + RANGE / 2) * k;
      g.clearRect(0, 0, SIZE * 2, SIZE * 2);
      g.drawImage(base, 0, 0);
      // coéquipiers (toujours visibles)
      for (const a of liveFrame.allies) {
        g.save();
        g.translate(X(a.x), Z(a.z));
        g.rotate(-a.yaw);
        g.fillStyle = '#4df3d3'; g.shadowColor = '#4df3d3'; g.shadowBlur = 7;
        g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 2.6); g.lineTo(-5, 6); g.closePath(); g.fill();
        g.restore();
      }
      // Spike
      const sp = store.getSnapshot().spikeOnMap;
      if (sp) {
        g.save();
        g.translate(X(sp.x), Z(sp.z));
        const pulse = 0.6 + Math.abs(Math.sin(performance.now() * 0.005)) * 0.4;
        g.fillStyle = '#ff8a5d'; g.shadowColor = '#ff8a5d'; g.shadowBlur = 14 * pulse;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const r = 9;
          i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath(); g.fill();
        g.restore();
      }
      // ennemis repérés
      for (const b of liveFrame.bots) {
        if (!b.seen) continue;
        g.save();
        g.translate(X(b.x), Z(b.z)); g.rotate(Math.PI / 4);
        g.fillStyle = '#ff4655'; g.shadowColor = '#ff4655'; g.shadowBlur = 10;
        g.fillRect(-5.5, -5.5, 11, 11);
        g.restore();
      }
      g.save();
      g.translate(X(liveFrame.px), Z(liveFrame.pz));
      g.rotate(-liveFrame.pyaw);
      g.fillStyle = 'rgba(77,243,211,.15)';
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 54, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); g.closePath(); g.fill();
      g.fillStyle = '#4df3d3'; g.shadowColor = '#4df3d3'; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 3.4); g.lineTo(-7, 7); g.closePath(); g.fill();
      g.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [base]);

  return (
    <div className={`absolute ${touch ? 'top-3 left-3' : 'top-6 left-6'} z-20 clip-card overflow-hidden pointer-events-none`}
      style={{ border: '1px solid rgba(77,243,211,.25)', boxShadow: '0 8px 40px rgba(0,0,0,.55)' }}>
      <canvas ref={ref} width={SIZE * 2} height={SIZE * 2} style={{ width: SIZE, height: SIZE, display: 'block' }} />
      <div className={`absolute top-1 left-1.5 font-display font-bold tracking-[.22em] text-[#4df3d3]/85 ${touch ? 'text-[8px]' : 'text-[10px]'}`}>
        {map.name}{!touch && <span className="text-white/35"> // {map.codename}</span>}
      </div>
    </div>
  );
}

// ————— Vitaux —————
function Vitals({ touch }: { touch: boolean }) {
  const s = useSnap();
  const low = s.hp <= 35;
  return (
    <div className={`absolute z-20 pointer-events-none ${touch ? 'left-3' : 'bottom-6 left-6'}`}
      style={touch ? { top: 136 } : undefined}>
      <div className={`clip-card ${touch ? 'px-3 py-2 min-w-[160px]' : 'px-4 py-3 min-w-[184px]'}`} style={{ background: 'rgba(10,18,26,.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.08)' }}>
        {!touch && (
          <div className="flex items-center gap-2 mb-1.5">
            <Heart size={14} className={low ? 'text-[#ff4655]' : 'text-[#4df3d3]'} />
            <span className="font-display text-[10px] font-bold tracking-[.3em] text-white/50">AGENT « {s.agentId.toUpperCase()} »</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className={`font-display font-bold leading-none ${touch ? 'text-2xl' : 'text-3xl'} ${low ? 'text-[#ff4655]' : 'text-[#ece8e1]'}`}
            style={low ? { animation: 'pulseRed 1.1s infinite' } : {}}>{s.hp}</span>
          <div className="flex-1">
            <div className="h-2.5 w-full" style={{ background: 'rgba(255,255,255,.1)', clipPath: 'polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%)' }}>
              <div className="h-full transition-all duration-200" style={{ width: `${s.hp}%`, background: low ? '#ff4655' : '#4df3d3', boxShadow: `0 0 12px ${low ? '#ff4655' : '#4df3d3'}` }} />
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              {s.shield >= 50 ? <Shield size={13} className="text-[#7ab8ff]" /> : <ShieldHalf size={13} className="text-[#7ab8ff]/70" />}
              <div className="h-1.5 flex-1" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div className="h-full transition-all duration-200" style={{ width: `${s.shield * 2}%`, background: '#7ab8ff', boxShadow: '0 0 8px #7ab8ff' }} />
              </div>
              <span className="font-mono-t text-xs text-[#7ab8ff]">{s.shield}</span>
            </div>
          </div>
        </div>
      </div>
      {low && s.hp > 0 && !touch && (
        <div className="font-display text-[11px] font-bold tracking-[.3em] text-[#ff4655] mt-2" style={{ animation: 'pulseRed 1.1s infinite' }}>
          /// CRITIQUE — CHERCHEZ UNE COUVERTURE
        </div>
      )}
    </div>
  );
}

// ————— Arme —————
function WeaponPanel({ touch }: { touch: boolean }) {
  const s = useSnap();
  const cfg = WEAPONS[s.weapon];
  return (
    <div className={`absolute z-20 pointer-events-none text-right ${touch ? 'top-3 right-20' : 'bottom-6 right-6'}`}>
      <div className={touch ? 'clip-tag px-3 py-1.5' : 'clip-slate pl-5 pr-8 pt-4 pb-3'} style={{ background: 'rgba(10,18,26,.85)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.08)' }}>
        {!touch && <div className="font-display text-[10px] font-bold tracking-[.25em] text-white/45">{cfg.codename}</div>}
        <div className={`font-display font-bold tracking-[.15em] text-[#ece8e1] ${touch ? 'text-[11px] leading-tight' : 'text-lg -mb-1'}`}>{cfg.name}</div>
        <div className="flex items-baseline justify-end gap-1.5">
          <span className={`font-display font-bold leading-none ${touch ? 'text-xl' : 'text-4xl'} ${s.lowAmmo ? 'text-[#ff4655]' : 'text-[#ece8e1]'}`}>{s.ammo}</span>
          <span className="font-mono-t text-xs text-white/40">/ {s.reserve}</span>
          {s.reloading && <RotateCw size={13} className="text-[#ffd25d] animate-spin" />}
        </div>
        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          <Coins size={11} className="text-[#ffd25d]" />
          <span className={`font-display font-bold text-[#ffd25d] tracking-widest ${touch ? 'text-xs' : ''}`}>{s.credits}</span>
        </div>
      </div>
      <div className="hidden">
        {s.owned.map((w) => (
          <div key={w} className={`font-display text-[10px] font-bold tracking-[.15em] px-2 py-0.5 clip-tag ${w === s.weapon ? 'text-[#4df3d3]' : 'text-white/40'}`}
            style={{ background: 'rgba(10,18,26,.72)', border: `1px solid ${w === s.weapon ? '#4df3d355' : '#ffffff15'}` }}>
            {WEAPONS[w].name} [{isPrimary(w) ? 2 : 1}]
          </div>
        ))}
      </div>
    </div>
  );
}

// ————— Bannière —————
function Banner() {
  const s = useSnap();
  if (!s.banner || s.phase === 'matchEnd') return null;
  const b = s.banner;
  const col = b.kind === 'win' ? '#4df3d3' : b.kind === 'lose' ? '#ff4655' : '#ece8e1';
  return (
    <div key={b.key} className="absolute inset-x-0 top-[25%] z-20 flex flex-col items-center pointer-events-none">
      <div className="anim-banner relative px-8 py-3 text-center overflow-hidden"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(10,18,26,.9) 18%, rgba(10,18,26,.9) 82%, transparent)', borderTop: `2px solid ${col}`, borderBottom: `2px solid ${col}` }}>
        <div className="anim-banner-txt font-display font-bold text-3xl tracking-[.16em]" style={{ color: col, textShadow: `0 0 34px ${col}88` }}>{b.title}</div>
        {b.sub && <div className="anim-banner-txt font-display text-base tracking-[.3em] text-white/75 mt-1">{b.sub}</div>}
      </div>
    </div>
  );
}

// ————— Pouvoirs de l'agent —————
function Abilities({ touch }: { touch: boolean }) {
  const s = useSnap();
  if (s.phase !== 'live' && s.phase !== 'buy') return null;
  const slot = (key: string, name: string, charges: number, cd: number, ult: boolean) => {
    const ready = charges > 0 && cd >= 1;
    return (
      <div className="relative clip-tag px-2.5 py-1.5 flex items-center gap-2"
        style={{
          background: ready ? (ult ? 'rgba(255,210,93,.16)' : 'rgba(77,243,211,.14)') : 'rgba(10,18,26,.8)',
          border: `1px solid ${ready ? (ult ? '#ffd25d' : '#4df3d3') : 'rgba(255,255,255,.14)'}`,
          opacity: charges > 0 ? 1 : 0.4,
        }}>
        {cd < 1 && (
          <div className="absolute left-0 bottom-0 h-0.5" style={{ width: `${cd * 100}%`, background: ult ? '#ffd25d' : '#4df3d3' }} />
        )}
        <span className="font-mono-t text-[11px] px-1"
          style={{ background: 'rgba(255,255,255,.1)', color: ready ? (ult ? '#ffd25d' : '#4df3d3') : 'rgba(255,255,255,.4)' }}>{key}</span>
        <span>
          <span className="block font-display text-[10px] font-bold tracking-[.14em]"
            style={{ color: ready ? '#ece8e1' : 'rgba(255,255,255,.45)' }}>{name}</span>
          <span className="flex gap-0.5 mt-0.5">
            {Array.from({ length: Math.max(1, charges) }).map((_, i) => (
              <span key={i} className="w-2.5 h-1" style={{ background: i < charges ? (ult ? '#ffd25d' : '#4df3d3') : 'rgba(255,255,255,.15)' }} />
            ))}
          </span>
        </span>
      </div>
    );
  };
  return (
    <div className={`absolute z-20 pointer-events-none flex gap-2 ${touch ? 'left-3' : 'left-1/2 -translate-x-1/2'}`}
      style={touch ? { bottom: 118 } : { bottom: 96 }}>
      {slot('Q', s.abilityName, s.abilityCharges, s.abilityCd, false)}
      {slot('X', s.ultName, s.ultCharges, s.ultCd, true)}
    </div>
  );
}

// ————— Aveuglement (éclat reçu) —————
function FlashOverlay() {
  const s = useSnap();
  if (s.flashed <= 0.01) return null;
  return <div className="absolute inset-0 z-30 pointer-events-none" style={{ background: `rgba(255,255,255,${s.flashed * 0.95})` }} />;
}

// ————— Spike : compte à rebours & invites —————
function SpikeHud({ touch }: { touch: boolean }) {
  const s = useSnap();
  if (s.phase !== 'live' && s.phase !== 'buy') return null;
  const planted = s.spike === 'planted';
  const urgent = planted && s.spikeTimer <= 10;
  const planting = s.plantProgress > 0.02 && s.plantProgress < 1;
  const defusing = s.defuseProgress > 0.02 && s.defuseProgress < 1;
  const key = touch ? 'BOUTON ◉' : '[E]';

  return (
    <>
      {/* compte à rebours */}
      {planted && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ top: touch ? 70 : 104 }}>
          <div className="flex items-center gap-2 px-4 py-1.5 clip-tag"
            style={{ background: 'rgba(28,6,10,.9)', border: `1px solid ${urgent ? '#ff4655' : '#ff8a5d'}` }}>
            <Bomb size={15} className={urgent ? 'text-[#ff4655]' : 'text-[#ff8a5d]'} />
            <span className={`font-mono-t text-xl ${urgent ? 'text-[#ff4655]' : 'text-[#ffd25d]'}`}
              style={urgent ? { animation: 'tickPulse .5s infinite' } : {}}>{s.spikeTimer}</span>
            <span className="font-display text-[10px] tracking-[.25em] text-white/55 font-bold">SITE {s.nearSite ?? ''}</span>
          </div>
        </div>
      )}

      {/* barre de pose / désamorçage */}
      {(planting || defusing) && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[32%] z-20 pointer-events-none w-72">
          <div className="font-display text-center text-[11px] font-bold tracking-[.3em] mb-1"
            style={{ color: planting ? '#ff8a5d' : '#4df3d3' }}>
            {planting ? 'POSE DU SPIKE' : 'DÉSAMORÇAGE'}
          </div>
          <div className="h-2.5 w-full" style={{ background: 'rgba(0,0,0,.6)', border: '1px solid rgba(255,255,255,.2)' }}>
            <div className="h-full transition-[width] duration-75" style={{
              width: `${Math.min(100, (planting ? s.plantProgress : s.defuseProgress) * 100)}%`,
              background: planting ? '#ff8a5d' : '#4df3d3',
              boxShadow: `0 0 12px ${planting ? '#ff8a5d' : '#4df3d3'}`,
            }} />
          </div>
        </div>
      )}

      {/* invites contextuelles */}
      {s.phase === 'live' && !planting && !defusing && (s.canPlant || s.canDefuse || s.canPickup) && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[34%] z-20 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 clip-tag"
            style={{ background: 'rgba(10,18,26,.85)', border: '1px solid rgba(255,210,93,.45)' }}>
            <Hand size={14} className="text-[#ffd25d]" />
            <span className="font-display text-xs font-bold tracking-[.2em] text-[#ffd25d]">
              MAINTENEZ {key} — {s.canPlant ? `POSER SUR ${s.nearSite}` : s.canDefuse ? 'DÉSAMORCER' : 'RAMASSER LE SPIKE'}
            </span>
          </div>
        </div>
      )}

      {/* porteur du Spike */}
      {s.spikeCarriedByPlayer && s.phase === 'live' && !planting && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ bottom: touch ? 90 : 46 }}>
          <div className="flex items-center gap-2 px-3 py-1 clip-tag" style={{ background: 'rgba(10,18,26,.8)', border: '1px solid rgba(255,138,93,.4)' }}>
            <Bomb size={13} className="text-[#ff8a5d]" />
            <span className="font-display text-[10px] font-bold tracking-[.22em] text-[#ff8a5d]">VOUS PORTEZ LE SPIKE</span>
          </div>
        </div>
      )}
    </>
  );
}

// ————— Mi-temps : changement de camp —————
function Halftime() {
  const s = useSnap();
  if (s.phase !== 'halftime') return null;
  const nextAtk = s.side === 'defense';
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
      style={{ background: 'rgba(4,8,12,.8)', backdropFilter: 'blur(7px)' }}>
      <div className="anim-reveal text-center">
        <Repeat size={44} className="mx-auto text-[#ff4655] mb-3" />
        <div className="font-display font-bold text-5xl tracking-[.2em] text-[#ece8e1]">CHANGEMENT DE CAMP</div>
        <div className="font-display text-lg tracking-[.3em] text-white/60 mt-3">
          VOUS PASSEZ EN <span className={nextAtk ? 'text-[#ff8a5d]' : 'text-[#4df3d3]'}>{nextAtk ? 'ATTAQUE' : 'DÉFENSE'}</span>
        </div>
        <div className="font-display text-xs tracking-[.25em] text-white/35 mt-2">ÉCONOMIE RÉINITIALISÉE — 800 CRÉDITS</div>
        <div className="font-mono-t text-3xl text-[#ff4655] mt-5">{s.timer}</div>
      </div>
    </div>
  );
}

// ————— Mode spectateur —————
function Spectating() {
  const s = useSnap();
  if (!s.spectating || s.phase !== 'live') return null;
  return (
    <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-20 pointer-events-none text-center">
      <div className="clip-tag px-6 py-2" style={{ background: 'rgba(10,18,26,.82)', border: '1px solid rgba(255,70,85,.4)' }}>
        <div className="font-display font-bold text-xl tracking-[.3em] text-[#ff4655]">OBSERVATION</div>
        <div className="font-display text-[11px] tracking-[.22em] text-white/60">
          {s.alliesAlive} COÉQUIPIER{s.alliesAlive > 1 ? 'S' : ''} CONTRE {s.enemiesAlive} HOSTILE{s.enemiesAlive > 1 ? 'S' : ''}
        </div>
      </div>
    </div>
  );
}

// ————— Boutique —————
function BuyMenu({ game }: { game: Game | null }) {
  const s = useSnap();
  const [deny, setDeny] = useState<string | null>(null);
  useEffect(() => {
    if (!deny) return;
    const t = setTimeout(() => setDeny(null), 1600);
    return () => clearTimeout(t);
  }, [deny]);
  if (!s.buyOpen || s.phase !== 'buy') return null;

  const equipped = new Set(s.owned);
  const close = () => { sfx.uiClick(); store.set({ buyOpen: false }); game?.requestLock(); };

  const tryBuy = (id: typeof s.weapon) => {
    const w = WEAPONS[id];
    if (equipped.has(id)) { sfx.buyNo(); setDeny(`${w.name} est déjà équipée`); return; }
    if (s.credits < w.price) {
      sfx.buyNo();
      setDeny(`Crédits insuffisants — il manque ${w.price - s.credits} cr pour ${w.name}`);
      return;
    }
    game?.buy(id);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-2 pointer-events-auto"
      style={{ background: 'rgba(4,8,12,.68)', backdropFilter: 'blur(4px)' }}>
      {/* un clic hors du panneau ferme aussi la boutique */}
      <div className="absolute inset-0" onClick={close} />

      <div className="anim-reveal clip-card relative flex flex-col w-[940px] max-w-[96vw]"
        style={{ height: 'min(94vh, 760px)', background: 'rgba(12,20,29,.98)', border: '1px solid rgba(236,232,225,.14)' }}>

        {/* ═══ EN-TÊTE FIXE ═══ */}
        <div className="shrink-0 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="font-display font-bold text-2xl tracking-[.18em] text-[#ece8e1]">BOUTIQUE</div>
                <span className="flex items-center gap-1.5 px-2 py-0.5 clip-tag font-display text-[10px] font-bold tracking-[.18em]"
                  style={{
                    background: s.side === 'attack' ? 'rgba(255,138,93,.18)' : 'rgba(77,243,211,.14)',
                    color: s.side === 'attack' ? '#ff8a5d' : '#4df3d3',
                    border: `1px solid ${s.side === 'attack' ? '#ff8a5d66' : '#4df3d366'}`,
                  }}>
                  {s.side === 'attack' ? <><Swords size={11} /> ATTAQUE</> : <><ShieldCheck size={11} /> DÉFENSE</>}
                </span>
              </div>
              <div className="font-display text-[11px] tracking-[.2em] text-white/40 font-semibold mt-0.5">
                {getMap(s.mapId).name} · MANCHE {s.round} ·{' '}
                <span className={s.timer <= 5 ? 'text-[#ff4655]' : ''}>{s.timer}s</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <Coins size={15} className="text-[#ffd25d]" />
                  <span className="font-display font-bold text-2xl text-[#ffd25d]">{s.credits}</span>
                </div>
                <div className="font-display text-[9px] tracking-[.25em] text-white/40">CRÉDITS</div>
              </div>
              {/* fermeture toujours accessible */}
              <button onClick={close} title="Fermer (B ou Échap)"
                className="flex items-center justify-center w-11 h-11 transition-colors clip-btn"
                style={{ background: 'rgba(255,70,85,.18)', border: '1px solid rgba(255,70,85,.5)', color: '#ff8a93' }}>
                <X size={22} />
              </button>
            </div>
          </div>

          {/* équipement porté + achat auto */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="font-display text-[9px] font-bold tracking-[.22em] text-white/40">ÉQUIPÉ</span>
            {s.owned.map((w) => (
              <span key={w} className="font-display text-[10px] font-bold tracking-[.12em] text-[#4df3d3] px-2 py-0.5"
                style={{ background: 'rgba(77,243,211,.1)', border: '1px solid rgba(77,243,211,.25)' }}>
                {WEAPONS[w].name}
              </span>
            ))}
            <span className="flex items-center gap-1 font-display text-[10px] font-bold tracking-[.12em] text-[#7ab8ff] px-2 py-0.5"
              style={{ background: 'rgba(122,184,255,.1)', border: '1px solid rgba(122,184,255,.25)' }}>
              <Shield size={10} /> {s.shield}
            </span>
            <div className="flex-1" />
            <button onClick={() => game?.buyLoadout()} onMouseEnter={() => sfx.uiHover()}
              className="vbtn vbtn-ghost clip-btn px-3 py-1.5 text-[11px] flex items-center gap-1.5">
              <Zap size={13} /> ÉQUIPEMENT RECOMMANDÉ
            </button>
          </div>
        </div>

        {/* ═══ LISTE DÉFILANTE ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {SHOP_ORDER.map((group) => (
            <div key={group.cat} className="mb-3.5">
              <div className="flex items-center gap-3 mb-1.5">
                <span className="font-display text-[10px] font-bold tracking-[.3em] text-[#ff4655]">{group.cat.toUpperCase()}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {group.ids.map((id) => {
                  const w = WEAPONS[id];
                  const own = equipped.has(id);
                  const afford = s.credits >= w.price;
                  const buyable = afford && !own;
                  return (
                    <button key={id} onClick={() => tryBuy(id)} onMouseEnter={() => sfx.uiHover()}
                      className="clip-card text-left p-2.5 transition-all duration-150 group relative"
                      style={{
                        background: own ? 'rgba(34,211,182,.14)' : buyable ? 'rgba(236,232,225,.055)' : 'rgba(255,70,85,.05)',
                        border: `1px solid ${own ? '#22d3b6' : buyable ? 'rgba(236,232,225,.16)' : 'rgba(255,70,85,.18)'}`,
                        cursor: 'pointer',
                      }}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <div className={`font-display font-bold text-[15px] tracking-wider truncate ${buyable || own ? 'text-[#ece8e1] group-hover:text-white' : 'text-white/45'}`}>
                            {w.name}
                          </div>
                          <div className="font-display text-[8px] tracking-[.18em] text-[#ff4655]/80 font-semibold truncate">{w.codename}</div>
                        </div>
                        <div className="flex items-center gap-1 font-display font-bold text-[13px] shrink-0"
                          style={{ color: own ? '#22d3b6' : afford ? '#ffd25d' : '#ff6d7a' }}>
                          {own ? 'ÉQUIPÉE' : <>{w.price}<Coins size={11} /></>}
                        </div>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {([['DÉG', w.ui.degats], ['CAD', w.ui.cadence], ['POR', w.ui.portee], ['CTL', w.ui.controle]] as const).map(([lb, v]) => (
                          <div key={lb} className="flex items-center gap-1.5">
                            <span className="font-display text-[8px] tracking-[.1em] text-white/35 w-5 font-semibold">{lb}</span>
                            <div className="flex gap-0.5 flex-1">
                              {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="h-1 flex-1" style={{
                                  background: i < v ? (own ? '#22d3b6' : afford ? '#ff4655' : 'rgba(255,70,85,.35)') : 'rgba(255,255,255,.09)',
                                }} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!afford && !own && (
                        <div className="mt-1 font-display text-[9px] font-bold tracking-[.14em] text-[#ff6d7a]">
                          IL MANQUE {w.price - s.credits} CR
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-display text-[10px] font-bold tracking-[.3em] text-[#7ab8ff]">PROTECTION</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <div className="flex gap-2">
            {[SHIELD_LIGHT, SHIELD_HEAVY].map((sh) => {
              const has = s.shield >= sh.amount;
              const afford = s.credits >= sh.price;
              return (
                <button key={sh.name} onMouseEnter={() => sfx.uiHover()}
                  onClick={() => {
                    if (has) { sfx.buyNo(); setDeny(`${sh.name} déjà actif`); return; }
                    if (!afford) { sfx.buyNo(); setDeny(`Crédits insuffisants — il manque ${sh.price - s.credits} cr`); return; }
                    game?.buyShield(sh.amount === 50);
                  }}
                  className="clip-card flex-1 flex items-center justify-between px-3 py-2.5 transition-all"
                  style={{
                    background: has ? 'rgba(34,211,182,.12)' : 'rgba(122,184,255,.07)',
                    border: `1px solid ${has ? '#22d3b6' : afford ? 'rgba(122,184,255,.35)' : 'rgba(255,70,85,.2)'}`,
                    cursor: 'pointer',
                  }}>
                  <div className="flex items-center gap-2.5">
                    {sh.amount === 50 ? <Shield size={17} className="text-[#7ab8ff]" /> : <ShieldHalf size={17} className="text-[#7ab8ff]" />}
                    <div className="text-left">
                      <div className="font-display font-bold tracking-wider text-[13px] text-[#ece8e1]">{sh.name.toUpperCase()}</div>
                      <div className="font-display text-[9px] text-white/40 tracking-widest">+{sh.amount} PV · ABSORBE 66 %</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 font-display font-bold text-[13px]"
                    style={{ color: has ? '#22d3b6' : afford ? '#ffd25d' : '#ff6d7a' }}>
                    {has ? 'ACTIF' : <>{sh.price}<Coins size={12} /></>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ PIED FIXE ═══ */}
        <div className="shrink-0 px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,.09)', background: 'rgba(8,14,20,.9)' }}>
          <div className="font-display text-[10px] tracking-[.18em] text-white/40 min-w-0">
            [1] PISTOLET · [2] PRINCIPALE · [B] OU [ÉCHAP] POUR FERMER
          </div>
          <button onClick={close}
            className="vbtn vbtn-red clip-btn px-7 py-2.5 text-sm flex items-center gap-2 shrink-0">
            <Play size={15} fill="currentColor" /> COMBATTRE
          </button>
        </div>

        {/* message de refus */}
        {deny && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-20 px-4 py-2 clip-tag anim-reveal pointer-events-none"
            style={{ background: 'rgba(40,8,12,.96)', border: '1px solid #ff4655' }}>
            <span className="font-display text-xs font-bold tracking-[.14em] text-[#ff8a93]">{deny}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ————— Scoreboard —————
function Scoreboard() {
  const s = useSnap();
  if (!s.scoreOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(4,8,12,.5)' }}>
      <div className="clip-card w-[580px] p-6 anim-reveal" style={{ background: 'rgba(12,20,29,.96)', border: '1px solid rgba(255,255,255,.1)' }}>
        <div className="font-display font-bold text-2xl tracking-[.25em] text-center mb-1">
          <span className="text-[#4df3d3]">{s.score[0]}</span>
          <span className="text-white/30 mx-4">MANCHE {s.round}</span>
          <span className="text-[#ff4655]">{s.score[1]}</span>
        </div>
        <div className="text-center font-display text-[10px] tracking-[.3em] text-white/35 mb-4">{getMap(s.mapId).name} · PREMIER À {s.targetWins}</div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[10px] font-bold tracking-[.3em] text-[#4df3d3]">VOTRE ÉQUIPE</span>
            <div className="flex-1 h-px bg-[#4df3d3]/20" />
          </div>
          <div className="flex items-center justify-between px-3 py-2 clip-tag" style={{ background: 'rgba(34,211,182,.14)', border: '1px solid rgba(34,211,182,.4)' }}>
            <span className="font-display font-bold tracking-widest text-[#4df3d3]">VOUS — « {s.agentId.toUpperCase()} »</span>
            <span className="font-mono-t text-sm text-white/80">{s.kills} ÉLIM. / {s.deaths} MORTS</span>
          </div>
          {s.allies.map((a, i) => (
            <div key={'a' + i} className="flex items-center justify-between px-3 py-2 clip-tag"
              style={{ background: 'rgba(34,211,182,.06)', border: '1px solid rgba(34,211,182,.18)', opacity: a.alive ? 1 : 0.45 }}>
              <span className="flex items-center gap-2 font-display font-bold tracking-widest" style={{ color: a.color }}>
                {!a.alive && <Skull size={13} />} {a.name}
              </span>
              <span className="font-mono-t text-sm text-white/70">{a.kills} ÉLIM.</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mb-1 mt-3">
            <span className="font-display text-[10px] font-bold tracking-[.3em] text-[#ff4655]">DÉFENSEURS</span>
            <div className="flex-1 h-px bg-[#ff4655]/20" />
          </div>
          {s.bots.map((b, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 clip-tag"
              style={{ background: 'rgba(255,70,85,.07)', border: '1px solid rgba(255,70,85,.2)', opacity: b.alive ? 1 : 0.45 }}>
              <span className="flex items-center gap-2 font-display font-bold tracking-widest" style={{ color: b.color }}>
                {!b.alive && <Skull size={13} />} {b.name}
              </span>
              <span className="font-mono-t text-sm text-white/70">{b.kills} ÉLIM.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ————— Bouton d'accès à la boutique (toujours visible en phase d'achat) —————
function ShopButton({ touch }: { touch: boolean }) {
  const s = useSnap();
  if (s.phase !== 'buy' || s.buyOpen || s.paused) return null;
  return (
    <div className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto ${touch ? 'top-[52%]' : 'bottom-36'}`}>
      <button
        onClick={() => { sfx.uiClick(); store.set({ buyOpen: true }); document.exitPointerLock?.(); }}
        onMouseEnter={() => sfx.uiHover()}
        className="vbtn vbtn-red clip-btn px-7 py-3 flex items-center gap-3"
        style={{ boxShadow: '0 0 34px rgba(255,70,85,.45)' }}>
        <ShoppingCart size={19} />
        <span className="text-left leading-tight">
          <span className="block text-base">OUVRIR LA BOUTIQUE</span>
          <span className="block font-display text-[10px] tracking-[.2em] opacity-80">
            {touch ? 'OU BOUTON ACHAT' : 'TOUCHE [B]'} · {s.credits} CRÉDITS · {s.timer}s
          </span>
        </span>
      </button>
    </div>
  );
}

// ————— FPS —————
function FpsCounter() {
  const s = useSnap();
  if (!s.settings.showFps) return null;
  const col = s.fps >= 55 ? '#4df3d3' : s.fps >= 30 ? '#ffd25d' : '#ff4655';
  return (
    <div className="absolute top-6 right-6 z-20 flex items-center gap-1.5 px-2.5 py-1 clip-tag pointer-events-none"
      style={{ background: 'rgba(10,18,26,.7)' }}>
      <Gauge size={12} style={{ color: col }} />
      <span className="font-mono-t text-sm" style={{ color: col }}>{s.fps}</span>
      <span className="font-display text-[9px] tracking-[.2em] text-white/40">IPS</span>
    </div>
  );
}

// ————— Pause —————
function PauseOverlay({ game, onQuit }: { game: Game | null; onQuit: () => void }) {
  const s = useSnap();
  if (!s.paused || s.phase === 'matchEnd' || s.buyOpen) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-8 pointer-events-auto"
      style={{ background: 'rgba(4,8,12,.74)', backdropFilter: 'blur(8px)' }}>
      <div className="anim-reveal text-center">
        <div className="font-display font-bold text-6xl tracking-[.25em] text-[#ece8e1]">PAUSE <span className="text-[#ff4655]">//</span></div>
        <div className="font-display text-sm tracking-[.35em] text-white/50 mt-2">LA PARTIE EST GELÉE — {getMap(s.mapId).name}</div>
      </div>
      <div className="anim-reveal flex flex-col gap-3 w-80" style={{ animationDelay: '.08s' }}>
        <button className="vbtn vbtn-red clip-btn px-8 py-4 text-lg flex items-center justify-center gap-2" onClick={() => game?.requestLock()}>
          <Play size={18} fill="currentColor" /> REPRENDRE
        </button>
        {s.phase === 'buy' && (
          <button className="vbtn vbtn-ghost clip-btn px-8 py-3 flex items-center justify-center gap-2"
            onClick={() => { sfx.uiClick(); store.set({ buyOpen: true, paused: false }); }}>
            <Coins size={16} /> OUVRIR LA BOUTIQUE
          </button>
        )}
        <button className="vbtn vbtn-ghost clip-btn px-8 py-3 flex items-center justify-center gap-2" onClick={() => { sfx.uiClick(); onQuit(); }}>
          <LogOut size={16} /> ABANDONNER LE MATCH
        </button>
      </div>
    </div>
  );
}

// ————— Fin de match —————
function MatchEnd({ game, onQuit }: { game: Game | null; onQuit: () => void }) {
  const s = useSnap();
  if (s.phase !== 'matchEnd') return null;
  const win = s.matchResult === 'win';
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-auto"
      style={{ background: 'rgba(4,8,12,.74)', backdropFilter: 'blur(6px)' }}>
      <div className="anim-reveal relative text-center px-20 py-12">
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(90deg, transparent, rgba(10,18,26,.93) 15%, rgba(10,18,26,.93) 85%, transparent)',
          borderTop: `3px solid ${win ? '#4df3d3' : '#ff4655'}`, borderBottom: `3px solid ${win ? '#4df3d3' : '#ff4655'}`,
        }} />
        <div className="relative">
          <div className="anim-banner-txt font-display font-bold text-8xl tracking-[.18em]"
            style={{ color: win ? '#4df3d3' : '#ff4655', textShadow: `0 0 60px ${win ? '#4df3d3' : '#ff4655'}` }}>
            {win ? 'VICTOIRE' : 'DÉFAITE'}
          </div>
          <div className="font-display text-xl tracking-[.4em] text-white/70 mt-2">{s.score[0]} — {s.score[1]} · {getMap(s.mapId).name}</div>
          <div className="flex justify-center gap-8 mt-5 font-display text-sm tracking-widest text-white/60">
            <span><b className="text-[#ffd25d] text-lg">{s.kills}</b> ÉLIMINATIONS</span>
            <span><b className="text-[#ff6d7a] text-lg">{s.deaths}</b> MORTS</span>
            <span><b className="text-[#4df3d3] text-lg">{s.kills && s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2)}</b> RATIO</span>
          </div>
          {s.rewardCoins > 0 && (
            <div className="flex justify-center gap-3 mt-5">
              <span className="flex items-center gap-2 px-4 py-2 clip-tag font-display font-bold tracking-widest text-[#ffd25d]"
                style={{ background: 'rgba(255,210,93,.12)', border: '1px solid rgba(255,210,93,.4)' }}>
                <Coins size={16} /> +{s.rewardCoins} CRÉDITS
              </span>
              <span className="flex items-center gap-2 px-4 py-2 clip-tag font-display font-bold tracking-widest text-[#4df3d3]"
                style={{ background: 'rgba(77,243,211,.1)', border: '1px solid rgba(77,243,211,.35)' }}>
                <Star size={16} /> +{s.rewardXp} XP
              </span>
              {s.rewardLevel > 0 && (
                <span className="flex items-center gap-2 px-4 py-2 clip-tag font-display font-bold tracking-widest text-[#ff4655]"
                  style={{ background: 'rgba(255,70,85,.14)', border: '1px solid #ff4655' }}>
                  <TrendingUp size={16} /> NIVEAU {s.rewardLevel} !
                </span>
              )}
            </div>
          )}
          <div className="flex justify-center gap-4 mt-8">
            <button className="vbtn vbtn-red clip-btn px-10 py-3.5 text-lg" onClick={() => game?.restart()}>REVANCHE</button>
            <button className="vbtn vbtn-ghost clip-btn px-8 py-3.5" onClick={() => { sfx.uiClick(); onQuit(); }}>MENU PRINCIPAL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ————— Racine —————
export default function HUD({ game, onQuit, touch = false }: { game: Game | null; onQuit: () => void; touch?: boolean }) {
  const s = useSnap();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(force, 220);
    return () => clearInterval(id);
  }, []);
  const fx = s.settings.screenFx;
  return (
    <div className={`absolute inset-0 z-10 overflow-hidden pointer-events-none vignette ${fx ? 'scanlines' : ''}`}>
      {fx && <div className="grain" />}
      <Minimap touch={touch} />
      <TopBar />
      <FpsCounter />
      <KillFeed />
      <Crosshair />
      <ScopeOverlay />
      <Hitmarker />
      <DamageIndicator />
      <KillToast />
      <Vitals touch={touch} />
      <WeaponPanel touch={touch} />
      <Banner />
      <Abilities touch={touch} />
      <FlashOverlay />
      <SpikeHud touch={touch} />
      <Halftime />
      <Spectating />
      <ShopButton touch={touch} />
      <BuyMenu game={game} />
      <Scoreboard />
      <PauseOverlay game={game} onQuit={onQuit} />
      <MatchEnd game={game} onQuit={onQuit} />
    </div>
  );
}
