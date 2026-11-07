// ─────────────────────────────────────────────────────────────
//  VALENCE — Menu principal, sélection de carte, arsenal, réglages
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Settings, saveSettings, DEFAULT_SETTINGS, DIFFICULTIES, type MapId } from '../game/store';
import { MAP_LIST, getMap, type MapDef } from '../game/maps';
import { WEAPONS, SHOP_ORDER, type WeaponCat } from '../game/weapons';
import { sfx } from '../game/audio';
import { CrosshairView } from './HUD';
import PadEditor from './PadEditor';
import {
  Play, Keyboard, SlidersHorizontal, Crosshair, Volume2, Gauge, X, Swords,
  Map as MapIcon, Eye, Monitor, Trophy, RotateCcw, Check, ChevronRight, Coins, Flame, Smartphone, Wifi, Sparkles,
} from 'lucide-react';

type Panel = 'none' | 'deploy' | 'arsenal' | 'settings' | 'controls' | 'pad' | 'online' | 'shop';

// ——— mini-plan de carte dessiné depuis les données ———
function MapPlan({ map, size = 150, highlight }: { map: MapDef; size?: number; highlight?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext('2d')!;
    const S = size * 2, R = 86;
    const k = S / R;
    const X = (x: number) => (x + R / 2) * k;
    const Z = (z: number) => (z + R / 2) * k;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#0a1018'; g.fillRect(0, 0, S, S);
    for (const z of map.zones) {
      g.fillStyle = highlight ? '#23384d' : '#1a2a3a';
      g.fillRect(X(z.x0), Z(z.z0), (z.x1 - z.x0) * k, (z.z1 - z.z0) * k);
    }
    for (const so of map.solids) {
      g.fillStyle = '#05080c';
      g.fillRect(X(so.x - so.w / 2), Z(so.z - so.d / 2), so.w * k, so.d * k);
    }
    for (const site of [map.siteA, map.siteB]) {
      g.strokeStyle = map.theme.accentCss; g.lineWidth = 2.5; g.setLineDash([7, 5]);
      g.beginPath(); g.arc(X(site.x), Z(site.z), site.r * k, 0, 7); g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,.88)';
      g.font = `800 ${16 * (size / 150) * 2}px Rajdhani, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(site.name, X(site.x), Z(site.z));
    }
    // spawns
    g.fillStyle = '#4df3d3';
    for (const a of map.attackSpawns) { g.beginPath(); g.arc(X(a.x), Z(a.z), 3.6, 0, 7); g.fill(); }
    g.fillStyle = '#ff4655';
    for (const b of map.defenseSpawns) { g.beginPath(); g.arc(X(b.x), Z(b.z), 3.6, 0, 7); g.fill(); }
  }, [map, size, highlight]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size, display: 'block' }} />;
}

// ——— contrôle slider réutilisable ———
function Slider({ icon, label, value, min, max, step, fmt, onChange }: {
  icon?: React.ReactNode; label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-2 font-display text-[12px] font-bold tracking-[.18em] text-white/70">{icon}{label}</span>
        <span className="font-mono-t text-sm text-[#4df3d3]">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} className="w-full"
        onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => { sfx.uiClick(); onChange(!value); }}
      className="w-full flex items-center justify-between py-2.5 group" style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <span className="text-left">
        <span className="block font-display text-[12px] font-bold tracking-[.18em] text-white/75 group-hover:text-white">{label}</span>
        {hint && <span className="block font-display text-[10px] tracking-wide text-white/35">{hint}</span>}
      </span>
      <span className="relative w-11 h-5 shrink-0 transition-colors" style={{ background: value ? '#ff4655' : 'rgba(255,255,255,.14)' }}>
        <span className="absolute top-0.5 w-4 h-4 bg-white transition-all" style={{ left: value ? 24 : 4 }} />
      </span>
    </button>
  );
}

function Segment<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: { v: T; t: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="font-display text-[12px] font-bold tracking-[.18em] text-white/70 mb-1.5">{label}</div>
      <div className="flex gap-1.5">
        {options.map((o) => (
          <button key={String(o.v)} onClick={() => { sfx.uiClick(); onChange(o.v); }}
            className="clip-btn flex-1 py-2 font-display font-bold tracking-[.14em] text-[11px] transition-all"
            style={{
              background: value === o.v ? '#ff4655' : 'rgba(255,255,255,.05)',
              color: value === o.v ? '#fff' : 'rgba(255,255,255,.52)',
              border: `1px solid ${value === o.v ? '#ff4655' : 'rgba(255,255,255,.13)'}`,
            }}>{o.t}</button>
        ))}
      </div>
    </div>
  );
}

// ═══════════ Panneau : déploiement ═══════════
function DeployPanel({ settings, set, onLaunch, onClose }: {
  settings: Settings; set: (s: Settings) => void; onLaunch: () => void; onClose: () => void;
}) {
  const map = getMap(settings.mapId);
  return (
    <Shell title="DÉPLOIEMENT" icon={<Swords size={21} className="text-[#ff4655]" />} onClose={onClose} width={960}>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {MAP_LIST.map((m) => {
          const sel = m.id === settings.mapId;
          return (
            <button key={m.id} onMouseEnter={() => sfx.uiHover()} onClick={() => { sfx.uiClick(); set({ ...settings, mapId: m.id as MapId }); }}
              className="clip-card p-3 text-left transition-all group relative overflow-hidden"
              style={{ background: sel ? 'rgba(255,70,85,.14)' : 'rgba(255,255,255,.04)', border: `1px solid ${sel ? '#ff4655' : 'rgba(255,255,255,.1)'}` }}>
              <div className="flex gap-3">
                <div className="shrink-0 clip-tag overflow-hidden" style={{ border: '1px solid rgba(255,255,255,.12)' }}>
                  <MapPlan map={m} size={104} highlight={sel} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-xl tracking-[.12em] text-[#ece8e1] leading-tight">{m.name}</div>
                  <div className="font-display text-[9px] tracking-[.22em] font-semibold mb-1.5" style={{ color: m.theme.accentCss }}>{m.codename}</div>
                  <div className="font-display text-[10px] tracking-wide text-white/40 leading-snug">{m.region}</div>
                  {sel && (
                    <div className="mt-2 inline-flex items-center gap-1 font-display text-[10px] font-bold tracking-[.2em] text-[#ff4655]">
                      <Check size={12} /> SÉLECTIONNÉE
                    </div>
                  )}
                </div>
              </div>
              <div className="font-display text-[10px] text-white/45 leading-snug mt-2.5 line-clamp-2">{m.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <div className="font-display text-[11px] font-bold tracking-[.3em] text-[#ff4655] mb-2">DIFFICULTÉ DES AGENTS</div>
          <div className="space-y-1.5">
            {DIFFICULTIES.map((d) => {
              const sel = settings.difficulty === d.v;
              return (
                <button key={d.v} onMouseEnter={() => sfx.uiHover()} onClick={() => { sfx.uiClick(); set({ ...settings, difficulty: d.v }); }}
                  className="w-full clip-tag px-3 py-2 flex items-center justify-between transition-all"
                  style={{ background: sel ? 'rgba(255,70,85,.16)' : 'rgba(255,255,255,.035)', border: `1px solid ${sel ? '#ff465588' : 'rgba(255,255,255,.08)'}` }}>
                  <span className="text-left">
                    <span className={`block font-display font-bold tracking-[.2em] text-sm ${sel ? 'text-[#ff4655]' : 'text-white/70'}`}>{d.name}</span>
                    <span className="block font-display text-[10px] tracking-wide text-white/35">{d.desc}</span>
                  </span>
                  <span className="flex gap-0.5 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Flame key={i} size={11} style={{ color: i < d.v ? '#ff4655' : 'rgba(255,255,255,.14)' }} fill={i < d.v ? '#ff4655' : 'none'} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <Segment label="FORMAT DU MATCH" value={settings.matchWins}
            options={[{ v: 2, t: 'RAPIDE · 2' }, { v: 4, t: 'STANDARD · 4' }, { v: 7, t: 'LONG · 7' }]}
            onChange={(v) => set({ ...settings, matchWins: v })} />
          <div className="clip-card p-4" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)' }}>
            <div className="font-display text-[11px] font-bold tracking-[.3em] text-white/50 mb-2.5">BRIEFING DE MISSION</div>
            {[
              ['Attaque', 'Poser le Spike sur le site A ou B'],
              ['Défense', 'Empêcher la pose ou désamorcer'],
              ['Votre escouade', '4 coéquipiers IA + vous'],
              ['Mi-match', 'Changement de camp + économie remise à zéro'],
              ['Économie', '800 crédits de départ · +200 / élimination'],
              ['Chrono', '18 s d\'achat · 1 min 40 de combat'],
              ['Victoire', `Premier camp à ${settings.matchWins} manches`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1" style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <span className="font-display text-[11px] tracking-wider text-white/40">{k}</span>
                <span className="font-display text-[11px] font-bold tracking-wider text-white/75 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={() => { sfx.uiClick(); onLaunch(); }}
        className="vbtn vbtn-red clip-btn w-full py-4 text-xl flex items-center justify-center gap-3">
        <Play size={20} fill="currentColor" /> LANCER LA PARTIE — {map.name}
      </button>
    </Shell>
  );
}

// ═══════════ Panneau : arsenal ═══════════
function ArsenalPanel({ onClose }: { onClose: () => void }) {
  const [cat, setCat] = useState<WeaponCat | 'Tout'>('Tout');
  const cats: (WeaponCat | 'Tout')[] = ['Tout', ...SHOP_ORDER.map((g) => g.cat)];
  const list = useMemo(() => {
    const all = SHOP_ORDER.flatMap((g) => g.ids);
    return ['classic' as const, ...all].filter((id) => cat === 'Tout' || WEAPONS[id].cat === cat);
  }, [cat]);
  return (
    <Shell title="ARSENAL" icon={<Crosshair size={21} className="text-[#ff4655]" />} onClose={onClose} width={900}>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {cats.map((c) => (
          <button key={c} onClick={() => { sfx.uiClick(); setCat(c); }}
            className="clip-tag px-3 py-1.5 font-display font-bold text-[11px] tracking-[.18em] transition-all"
            style={{
              background: cat === c ? '#ff4655' : 'rgba(255,255,255,.05)',
              color: cat === c ? '#fff' : 'rgba(255,255,255,.5)',
              border: `1px solid ${cat === c ? '#ff4655' : 'rgba(255,255,255,.12)'}`,
            }}>{c.toUpperCase()}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 max-h-[58vh] overflow-y-auto pr-1">
        {list.map((id) => {
          const w = WEAPONS[id];
          return (
            <div key={id} className="clip-card p-3.5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)' }}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <div className="font-display font-bold text-lg tracking-[.12em] text-[#ece8e1]">{w.name}</div>
                  <div className="font-display text-[9px] tracking-[.22em] text-[#ff4655] font-semibold">{w.codename}</div>
                </div>
                <div className="flex items-center gap-1 font-display font-bold text-[#ffd25d]">
                  {w.price === 0 ? 'GRATUIT' : <>{w.price}<Coins size={13} /></>}
                </div>
              </div>
              <div className="font-display text-[10px] text-white/45 leading-snug mb-2 min-h-[26px]">{w.desc}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2">
                {([['DÉGÂTS', w.ui.degats], ['CADENCE', w.ui.cadence], ['PORTÉE', w.ui.portee], ['CONTRÔLE', w.ui.controle]] as const).map(([lb, v]) => (
                  <div key={lb} className="flex items-center gap-1.5">
                    <span className="font-display text-[8px] tracking-[.1em] text-white/35 w-12 font-semibold">{lb}</span>
                    <div className="flex gap-0.5 flex-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-1 flex-1" style={{ background: i < v ? '#ff4655' : 'rgba(255,255,255,.09)' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 font-mono-t text-[10px] text-white/40">
                <span>TÊTE {w.dmg[0]}</span><span>CORPS {w.dmg[1]}</span>
                <span>CHRG {w.mag}</span><span>{w.auto ? 'AUTO' : 'SEMI'}</span>
                {w.pellets > 1 && <span>{w.pellets} PLOMBS</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// ═══════════ Panneau : réglages ═══════════
type STab = 'jeu' | 'viseur' | 'video' | 'audio';
function SettingsPanel({ settings, set, onClose }: { settings: Settings; set: (s: Settings) => void; onClose: () => void }) {
  const [tab, setTab] = useState<STab>('jeu');
  const ch = settings.crosshair;
  const setCh = (p: Partial<typeof ch>) => set({ ...settings, crosshair: { ...ch, ...p } });
  const tabs: { v: STab; t: string; i: React.ReactNode }[] = [
    { v: 'jeu', t: 'VISÉE', i: <Eye size={14} /> },
    { v: 'viseur', t: 'RÉTICULE', i: <Crosshair size={14} /> },
    { v: 'video', t: 'VIDÉO', i: <Monitor size={14} /> },
    { v: 'audio', t: 'AUDIO', i: <Volume2 size={14} /> },
  ];
  const COLORS = ['#4df3d3', '#ffffff', '#ff4655', '#ffd25d', '#7affa0', '#ff5fe0', '#59d7ff'];

  return (
    <Shell title="PARAMÈTRES" icon={<SlidersHorizontal size={20} className="text-[#ff4655]" />} onClose={onClose} width={660}>
      <div className="flex gap-1.5 mb-5">
        {tabs.map((t) => (
          <button key={t.v} onClick={() => { sfx.uiClick(); setTab(t.v); }}
            className="clip-tag flex-1 py-2 font-display font-bold text-[11px] tracking-[.18em] flex items-center justify-center gap-1.5 transition-all"
            style={{
              background: tab === t.v ? '#ff4655' : 'rgba(255,255,255,.05)',
              color: tab === t.v ? '#fff' : 'rgba(255,255,255,.5)',
              border: `1px solid ${tab === t.v ? '#ff4655' : 'rgba(255,255,255,.12)'}`,
            }}>{t.i}{t.t}</button>
        ))}
      </div>

      <div className="space-y-4 min-h-[320px]">
        {tab === 'jeu' && (<>
          <Slider icon={<Crosshair size={14} />} label="SENSIBILITÉ SOURIS" value={settings.sensitivity} min={0.15} max={2.5} step={0.05}
            fmt={(v) => v.toFixed(2)} onChange={(v) => set({ ...settings, sensitivity: v })} />
          <Slider icon={<Eye size={14} />} label="SENSIBILITÉ EN VISÉE" value={settings.adsSens} min={0.3} max={1.5} step={0.05}
            fmt={(v) => `×${v.toFixed(2)}`} onChange={(v) => set({ ...settings, adsSens: v })} />
          <Slider icon={<Monitor size={14} />} label="CHAMP DE VISION" value={settings.fov} min={70} max={103} step={1}
            fmt={(v) => `${v}°`} onChange={(v) => set({ ...settings, fov: v })} />
          <Toggle label="INVERSER L'AXE VERTICAL" hint="La souris vers le haut fait regarder vers le bas"
            value={settings.invertY} onChange={(v) => set({ ...settings, invertY: v })} />
          <Toggle label="AFFICHER L'ARME" hint="Masque le modèle d'arme en vue subjective"
            value={settings.viewmodel} onChange={(v) => set({ ...settings, viewmodel: v })} />
        </>)}

        {tab === 'viseur' && (<>
          <div className="relative h-28 clip-card flex items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(circle at center, #2b3a46, #121a22)', border: '1px solid rgba(255,255,255,.1)' }}>
            <CrosshairView cfg={ch} spread={0} />
            <span className="absolute bottom-1.5 right-2 font-display text-[9px] tracking-[.25em] text-white/30">APERÇU</span>
          </div>
          <div>
            <div className="font-display text-[12px] font-bold tracking-[.18em] text-white/70 mb-1.5">COULEUR</div>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => { sfx.uiClick(); setCh({ color: c }); }}
                  className="w-8 h-8 transition-transform hover:scale-110"
                  style={{ background: c, border: ch.color === c ? '2px solid #fff' : '2px solid rgba(255,255,255,.2)', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }} />
              ))}
            </div>
          </div>
          <Slider label="LONGUEUR" value={ch.length} min={2} max={20} step={1} fmt={(v) => `${v} px`} onChange={(v) => setCh({ length: v })} />
          <Slider label="ÉPAISSEUR" value={ch.thickness} min={1} max={6} step={0.5} fmt={(v) => `${v} px`} onChange={(v) => setCh({ thickness: v })} />
          <Slider label="ÉCARTEMENT" value={ch.gap} min={0} max={24} step={1} fmt={(v) => `${v} px`} onChange={(v) => setCh({ gap: v })} />
          <Toggle label="POINT CENTRAL" value={ch.dot} onChange={(v) => setCh({ dot: v })} />
          <Toggle label="CONTOUR NOIR" hint="Améliore la lisibilité sur fond clair" value={ch.outline} onChange={(v) => setCh({ outline: v })} />
          <Toggle label="RÉTICULE DYNAMIQUE" hint="S'ouvre selon la dispersion réelle de l'arme" value={ch.dynamic} onChange={(v) => setCh({ dynamic: v })} />
        </>)}

        {tab === 'video' && (<>
          <Segment label="QUALITÉ GRAPHIQUE" value={settings.quality}
            options={[{ v: 'low' as const, t: 'PERFORMANCE' }, { v: 'medium' as const, t: 'ÉQUILIBRÉ' }, { v: 'high' as const, t: 'MAXIMALE' }]}
            onChange={(v) => set({ ...settings, quality: v })} />
          <Toggle label="OMBRES DYNAMIQUES" hint="Désactivez pour gagner des images par seconde"
            value={settings.shadows} onChange={(v) => set({ ...settings, shadows: v })} />
          <Toggle label="EFFETS D'ÉCRAN" hint="Grain argentique et lignes de balayage"
            value={settings.screenFx} onChange={(v) => set({ ...settings, screenFx: v })} />
          <Toggle label="COMPTEUR D'IMAGES" hint="Affiche les IPS en haut à droite"
            value={settings.showFps} onChange={(v) => set({ ...settings, showFps: v })} />
        </>)}

        {tab === 'audio' && (<>
          <Slider icon={<Volume2 size={14} />} label="VOLUME GÉNÉRAL" value={settings.volume} min={0} max={1} step={0.05}
            fmt={(v) => `${Math.round(v * 100)} %`} onChange={(v) => set({ ...settings, volume: v })} />
          <div className="clip-card p-4" style={{ background: 'rgba(255,255,255,.035)', border: '1px solid rgba(255,255,255,.08)' }}>
            <div className="font-display text-[11px] font-bold tracking-[.3em] text-white/50 mb-2">TEST AUDIO</div>
            <div className="flex gap-2 flex-wrap">
              {([['TIR', () => sfx.shot('rifle')], ['IMPACT', () => sfx.hit(true)], ['ÉLIMINATION', () => sfx.kill()],
              ['RECHARGE', () => sfx.reload()], ['MANCHE', () => sfx.roundWin()]] as const).map(([t, fn]) => (
                <button key={t} onClick={() => { sfx.init(); fn(); }}
                  className="vbtn vbtn-ghost clip-btn px-3 py-1.5 text-[11px]">{t}</button>
              ))}
            </div>
          </div>
        </>)}
      </div>

      <button onClick={() => { sfx.uiClick(); set({ ...DEFAULT_SETTINGS, mapId: settings.mapId }); }}
        className="vbtn vbtn-ghost clip-btn w-full mt-5 py-2.5 text-xs flex items-center justify-center gap-2">
        <RotateCcw size={14} /> RÉINITIALISER LES PARAMÈTRES
      </button>
    </Shell>
  );
}

// ═══════════ Panneau : commandes ═══════════
function ControlsPanel({ onClose }: { onClose: () => void }) {
  const groups: [string, [string, string][]][] = [
    ['DÉPLACEMENT', [
      ['Z Q S D / Flèches', 'Se déplacer'],
      ['MAJ', 'Pas feutrés (silencieux et précis)'],
      ['CTRL / C', 'S\'accroupir'],
      ['ESPACE', 'Sauter'],
    ]],
    ['COMBAT', [
      ['Clic gauche', 'Tirer'],
      ['Clic droit', 'Visée / lunette (jusqu\'à 2 zooms)'],
      ['E / F (maintenir)', 'Poser ou désamorcer le Spike'],
      ['R', 'Recharger'],
      ['1 / 2 / Molette', 'Pistolet / arme principale'],
    ]],
    ['INTERFACE', [
      ['B', 'Ouvrir et fermer la boutique'],
      ['TAB', 'Tableau des scores'],
      ['ÉCHAP', 'Pause (libère la souris)'],
    ]],
  ];
  return (
    <Shell title="COMMANDES" icon={<Keyboard size={21} className="text-[#ff4655]" />} onClose={onClose} width={560}>
      <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1">
        {groups.map(([g, rows]) => (
          <div key={g}>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-display text-[11px] font-bold tracking-[.35em] text-[#ff4655]">{g}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            {rows.map(([k, a]) => (
              <div key={k} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,.055)' }}>
                <span className="font-mono-t text-[12px] text-[#4df3d3] bg-white/5 px-2 py-0.5">{k}</span>
                <span className="font-display text-[13px] tracking-wider text-white/70 font-semibold text-right">{a}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ——— coquille de panneau ———
function Shell({ title, icon, onClose, width, children }: {
  title: string; icon: React.ReactNode; onClose: () => void; width: number; children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(4,8,12,.82)', backdropFilter: 'blur(10px)' }}>
      <div className="anim-reveal clip-card p-6 overflow-y-auto" style={{ width, maxWidth: '96vw', maxHeight: '94vh', background: 'rgba(12,20,29,.97)', border: '1px solid rgba(255,70,85,.35)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-display font-bold text-2xl tracking-[.2em] text-[#ece8e1]">{title}</span>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-[#ff4655] transition-colors"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ═══════════ MENU PRINCIPAL ═══════════
export default function MainMenu({ settings, onPlay, onSettings, onOnline, onShop, profile }: {
  settings: Settings; onPlay: () => void; onSettings: (s: Settings) => void;
  onOnline: () => void; onShop: () => void;
  profile: { coins: number; agent: string; level: number };
}) {
  const [panel, setPanel] = useState<Panel>('none');
  const set = (s: Settings) => { onSettings(s); saveSettings(s); };
  const map = getMap(settings.mapId);
  const diff = DIFFICULTIES.find((d) => d.v === settings.difficulty) ?? DIFFICULTIES[1];

  const items: { k: Panel | 'play'; t: string; s: string; i: React.ReactNode; red?: boolean }[] = [
    { k: 'play', t: 'JOUER', s: 'Lancer une partie contre les agents', i: <Play size={20} fill="currentColor" />, red: true },
    { k: 'online', t: 'EN LIGNE', s: 'Rejoindre ou héberger une partie', i: <Wifi size={20} /> },
    { k: 'shop', t: 'BOUTIQUE', s: `${profile.coins} crédits · agents et livrées`, i: <Sparkles size={20} /> },
    { k: 'deploy', t: 'PRÉPARER', s: `${map.name} · difficulté ${diff.name}`, i: <MapIcon size={20} /> },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden scanlines" style={{ background: '#0f1923' }}>
      <div className="absolute inset-0">
        <img src="menu-art.jpg" alt="" className="w-full h-full object-cover" style={{ animation: 'floatSlow 16s ease-in-out infinite', transform: 'scale(1.07)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(10,17,25,.97) 0%, rgba(10,17,25,.88) 38%, rgba(10,17,25,.3) 72%, rgba(10,17,25,.6) 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,17,25,.96), transparent 42%)' }} />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="hazard absolute -left-40 top-[14%] w-[130%] h-[3px] opacity-55" style={{ animation: 'diagSlide 9s ease-in-out infinite alternate' }} />
        <div className="hazard absolute -left-40 top-[74%] w-[130%] h-[2px] opacity-25" style={{ animation: 'diagSlide 13s ease-in-out infinite alternate-reverse' }} />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center max-w-6xl"
        style={{ paddingLeft: 'clamp(28px, 6vw, 86px)', paddingRight: '24px' }}>
        <div className="anim-reveal flex items-center gap-3 mb-2" style={{ animationDelay: '.05s' }}>
          <div className="w-10 h-[3px] bg-[#ff4655]" />
          <span className="font-display text-xs font-bold tracking-[.45em] text-[#ff4655]">FPS TACTIQUE 5 CONTRE 5 — ÉPISODE 01</span>
        </div>
        <h1 className="anim-reveal font-display font-bold leading-[.86] text-[#ece8e1]" style={{ fontSize: 'clamp(58px, 9.5vw, 112px)', animationDelay: '.12s' }}>
          VALEN<span className="text-[#ff4655]" style={{ textShadow: '0 0 55px rgba(255,70,85,.55)' }}>CE</span>
        </h1>
        <p className="anim-reveal font-display text-base tracking-[.3em] text-white/55 font-semibold mt-2 mb-7" style={{ animationDelay: '.2s' }}>
          4 CARTES · 12 ARMES · SPIKE · EN LIGNE
        </p>

        <div className="anim-reveal grid grid-cols-1 sm:grid-cols-2 gap-3 w-[min(560px,90vw)]" style={{ animationDelay: '.3s' }}>
          {items.map((it) => (
            <button key={it.k} onMouseEnter={() => sfx.uiHover()}
              onClick={() => { sfx.init(); sfx.uiClick(); if (it.k === 'play') onPlay(); else if (it.k === 'online') onOnline(); else if (it.k === 'shop') onShop(); else setPanel(it.k as Panel); }}
              className={`group clip-btn flex items-center gap-3 px-5 py-4 min-h-[76px] transition-all text-left hover:-translate-y-0.5 hover:brightness-125 min-h-[76px]`}
              style={{
                background: it.red ? '#ff4655' : 'rgba(236,232,225,.055)',
                border: `1px solid ${it.red ? '#ff4655' : 'rgba(236,232,225,.16)'}`,
              }}>
              <span className={it.red ? 'text-white' : 'text-[#ff4655]'}>{it.i}</span>
              <span className="flex-1 min-w-0">
                <span className={`block font-display font-bold tracking-[.16em] ${it.red ? 'text-white text-xl' : 'text-[#ece8e1] text-[15px]'}`}>{it.t}</span>
                <span className={`block font-display text-[10px] tracking-[.14em] truncate ${it.red ? 'text-white/75' : 'text-white/35'}`}>{it.s}</span>
              </span>
              <ChevronRight size={16} className={`shrink-0 transition-transform group-hover:translate-x-1 ${it.red ? 'text-white/80' : 'text-white/30'}`} />
            </button>
          ))}
        </div>
        <div className="anim-reveal flex flex-wrap items-center gap-2 mt-4" style={{ animationDelay: '.42s' }}>
          {[
            ['ARSENAL', 'arsenal'], ['PARAMÈTRES', 'settings'],
            ['COMMANDES', 'controls'], ['TACTILE', 'pad'],
          ].map(([label, key]) => (
            <button key={key} onClick={() => { sfx.uiClick(); setPanel(key as Panel); }}
              className="clip-tag px-3 py-2 font-display text-[10px] font-bold tracking-[.2em] text-white/55 hover:text-white transition-colors"
              style={{ background: 'rgba(236,232,225,.055)', border: '1px solid rgba(236,232,225,.13)' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-between px-7 py-3.5"
        style={{ borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(10,17,25,.6)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-2 font-display text-[11px] tracking-[.26em] text-white/40">
          <Trophy size={12} className="text-[#ffd25d]" /> OBJECTIF : {settings.matchWins} MANCHES
          <span className="mx-2 text-[#ff4655]">//</span>
          <MapIcon size={12} /> {map.name}
          <span className="mx-2 text-[#ff4655]">//</span>
          <Gauge size={12} /> {diff.name}
        </div>
        <div className="flex items-center gap-3 font-display text-[11px] tracking-[.22em] text-white/40">
          <span className="text-[#4df3d3]">NIV. {profile.level}</span>
          <span className="text-[#ffd25d]">{profile.coins} CR</span>
          <span className="text-[#ff4655]">{profile.agent.toUpperCase()}</span>
        </div>
      </div>

      {panel === 'deploy' && <DeployPanel settings={settings} set={set} onClose={() => setPanel('none')} onLaunch={() => { setPanel('none'); onPlay(); }} />}
      {panel === 'arsenal' && <ArsenalPanel onClose={() => setPanel('none')} />}
      {panel === 'settings' && <SettingsPanel settings={settings} set={set} onClose={() => setPanel('none')} />}
      {panel === 'pad' && <PadEditor settings={settings} set={set} onClose={() => setPanel('none')} />}
      {panel === 'controls' && <ControlsPanel onClose={() => setPanel('none')} />}
    </div>
  );
}
