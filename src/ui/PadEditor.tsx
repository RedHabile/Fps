// ─────────────────────────────────────────────────────────────
//  VALENCE — Éditeur de disposition des boutons tactiles
//  Glisser-déposer, redimensionnement, masquage, préréglages.
// ─────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import {
  type Settings, type PadId, type PadLayout, DEFAULT_PAD, PAD_META,
} from '../game/store';
import { PadBtn, PAD_ICON, PAD_LABEL } from './TouchControls';
import { sfx } from '../game/audio';
import { X, RotateCcw, Check, Move, Maximize2, Eye, EyeOff, Smartphone } from 'lucide-react';

// ——— préréglages ———
const mirror = (p: PadLayout): PadLayout => {
  const out = {} as PadLayout;
  (Object.keys(p) as PadId[]).forEach((k) => { out[k] = { ...p[k], x: 100 - p[k].x }; });
  return out;
};
const scaleAll = (p: PadLayout, k: number): PadLayout => {
  const out = {} as PadLayout;
  (Object.keys(p) as PadId[]).forEach((id) => { out[id] = { ...p[id], size: Math.round(p[id].size * k) }; });
  return out;
};

const PRESETS: { name: string; desc: string; pad: PadLayout }[] = [
  { name: 'STANDARD', desc: 'Équilibré, pouces aux coins', pad: DEFAULT_PAD },
  { name: 'COMPACT', desc: 'Petits écrans', pad: scaleAll(DEFAULT_PAD, 0.85) },
  { name: 'LARGE', desc: 'Tablettes, gros doigts', pad: scaleAll(DEFAULT_PAD, 1.22) },
  { name: 'GAUCHER', desc: 'Tout inversé', pad: mirror(DEFAULT_PAD) },
];

export default function PadEditor({ settings, set, onClose }: {
  settings: Settings; set: (s: Settings) => void; onClose: () => void;
}) {
  const [sel, setSel] = useState<PadId>('fire');
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: PadId; dx: number; dy: number } | null>(null);
  const pad = settings.pad;

  const patch = (id: PadId, p: Partial<PadLayout[PadId]>) =>
    set({ ...settings, pad: { ...pad, [id]: { ...pad[id], ...p } } });

  const onDown = (id: PadId) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    setSel(id);
    sfx.uiClick();
    const cx = box.left + (pad[id].x / 100) * box.width;
    const cy = box.top + (pad[id].y / 100) * box.height;
    dragging.current = { id, dx: e.clientX - cx, dy: e.clientY - cy };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    const box = areaRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const x = ((e.clientX - d.dx - box.left) / box.width) * 100;
    const y = ((e.clientY - d.dy - box.top) / box.height) * 100;
    patch(d.id, {
      x: Math.max(3, Math.min(97, Math.round(x * 2) / 2)),
      y: Math.max(4, Math.min(96, Math.round(y * 2) / 2)),
    });
  };
  const onUp = () => { dragging.current = null; };

  const cur = pad[sel];
  const meta = PAD_META.find((m) => m.id === sel)!;
  // aperçu à l'échelle de la zone (la zone fait ~2,4× moins large qu'un écran)
  const previewScale = 0.52 * settings.padScale;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(4,8,12,.86)', backdropFilter: 'blur(10px)' }}>
      <div className="anim-reveal clip-card flex flex-col w-[1000px] max-w-[97vw]"
        style={{ height: 'min(94vh, 700px)', background: 'rgba(12,20,29,.98)', border: '1px solid rgba(255,70,85,.4)' }}>

        {/* en-tête */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-[#ff4655]" />
            <div>
              <div className="font-display font-bold text-xl tracking-[.18em] text-[#ece8e1]">DISPOSITION TACTILE</div>
              <div className="font-display text-[10px] tracking-[.2em] text-white/40">GLISSEZ LES BOUTONS POUR LES PLACER</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-[#ff4655] transition-colors"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 flex gap-4 p-4">
          {/* ═══ ZONE D'APERÇU ═══ */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div ref={areaRef}
              onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              className="relative flex-1 overflow-hidden clip-card touch-none"
              style={{
                background: 'linear-gradient(160deg,#20303d,#121a22 60%,#0d141b)',
                border: '1px solid rgba(255,255,255,.12)',
                aspectRatio: '16 / 9',
              }}>
              {/* repères d'écran */}
              <div className="absolute inset-0 pointer-events-none opacity-25">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-white/30" />
              </div>
              <div className="absolute top-2 left-1/2 -translate-x-1/2 font-display text-[10px] tracking-[.3em] text-white/30 pointer-events-none">
                APERÇU DE L'ÉCRAN DE JEU
              </div>

              {PAD_META.map((m) => {
                const b = pad[m.id];
                const isSel = sel === m.id;
                const size = (m.id === 'stick' ? b.size : b.size) * previewScale;
                return (
                  <div key={m.id}
                    onPointerDown={onDown(m.id)}
                    className="absolute cursor-move"
                    style={{
                      left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%,-50%)',
                      opacity: b.on ? 1 : 0.25,
                      filter: isSel ? 'drop-shadow(0 0 10px #ff4655)' : 'none',
                      zIndex: isSel ? 5 : 1,
                    }}>
                    {m.id === 'stick' ? (
                      <div className="rounded-full flex items-center justify-center"
                        style={{
                          width: size, height: size,
                          border: `2px dashed ${isSel ? '#ff4655' : 'rgba(236,232,225,.5)'}`,
                          background: 'rgba(10,18,26,.4)',
                        }}>
                        <span className="font-display text-[8px] tracking-[.14em] text-white/70">JOYSTICK</span>
                      </div>
                    ) : (
                      <PadBtn id={m.id} size={size} label={PAD_LABEL[m.id]}
                        style={{ outline: isSel ? '2px solid #ff4655' : 'none', outlineOffset: 3 }}>
                        {PAD_ICON[m.id]}
                      </PadBtn>
                    )}
                  </div>
                );
              })}
            </div>

            {/* préréglages */}
            <div className="shrink-0 mt-3">
              <div className="font-display text-[10px] font-bold tracking-[.3em] text-white/45 mb-1.5">PRÉRÉGLAGES</div>
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map((p) => (
                  <button key={p.name} onMouseEnter={() => sfx.uiHover()}
                    onClick={() => { sfx.uiClick(); set({ ...settings, pad: { ...p.pad } }); }}
                    className="clip-tag px-3 py-1.5 text-left transition-all"
                    style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)' }}>
                    <span className="block font-display text-[11px] font-bold tracking-[.14em] text-[#ece8e1]">{p.name}</span>
                    <span className="block font-display text-[9px] tracking-wide text-white/35">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ PANNEAU DE RÉGLAGE ═══ */}
          <div className="w-[270px] shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* sélecteur */}
            <div>
              <div className="font-display text-[10px] font-bold tracking-[.3em] text-white/45 mb-1.5">BOUTON</div>
              <div className="grid grid-cols-3 gap-1">
                {PAD_META.map((m) => (
                  <button key={m.id} onClick={() => { sfx.uiClick(); setSel(m.id); }}
                    className="clip-tag py-1.5 font-display text-[9px] font-bold tracking-[.1em] transition-all"
                    style={{
                      background: sel === m.id ? '#ff4655' : 'rgba(255,255,255,.05)',
                      color: sel === m.id ? '#fff' : pad[m.id].on ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.25)',
                      border: `1px solid ${sel === m.id ? '#ff4655' : 'rgba(255,255,255,.12)'}`,
                    }}>{m.label}</button>
                ))}
              </div>
            </div>

            <div className="clip-card p-3" style={{ background: 'rgba(255,70,85,.07)', border: '1px solid rgba(255,70,85,.25)' }}>
              <div className="font-display font-bold text-base tracking-[.14em] text-[#ff4655]">{meta.label}</div>
              <div className="font-display text-[10px] tracking-wide text-white/40 mb-2.5">{meta.hint}</div>

              <label className="block">
                <span className="flex items-center justify-between font-display text-[11px] font-bold tracking-[.14em] text-white/65 mb-1">
                  <span className="flex items-center gap-1.5"><Maximize2 size={12} /> TAILLE</span>
                  <span className="font-mono-t text-[#4df3d3]">{cur.size} px</span>
                </span>
                <input type="range" min={sel === 'stick' ? 80 : 34} max={sel === 'stick' ? 180 : 130} step={2}
                  value={cur.size} className="w-full"
                  onChange={(e) => patch(sel, { size: parseInt(e.target.value) })} />
              </label>

              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <label className="block">
                  <span className="flex items-center justify-between font-display text-[10px] font-bold tracking-[.1em] text-white/55 mb-1">
                    <span className="flex items-center gap-1"><Move size={11} /> X</span>
                    <span className="font-mono-t text-[#4df3d3]">{cur.x}%</span>
                  </span>
                  <input type="range" min={3} max={97} step={0.5} value={cur.x} className="w-full"
                    onChange={(e) => patch(sel, { x: parseFloat(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="flex items-center justify-between font-display text-[10px] font-bold tracking-[.1em] text-white/55 mb-1">
                    <span>Y</span><span className="font-mono-t text-[#4df3d3]">{cur.y}%</span>
                  </span>
                  <input type="range" min={4} max={96} step={0.5} value={cur.y} className="w-full"
                    onChange={(e) => patch(sel, { y: parseFloat(e.target.value) })} />
                </label>
              </div>

              <button onClick={() => { sfx.uiClick(); patch(sel, { on: !cur.on }); }}
                className="w-full mt-3 clip-btn py-2 font-display text-[11px] font-bold tracking-[.16em] flex items-center justify-center gap-2 transition-all"
                style={{
                  background: cur.on ? 'rgba(77,243,211,.14)' : 'rgba(255,70,85,.16)',
                  color: cur.on ? '#4df3d3' : '#ff8a93',
                  border: `1px solid ${cur.on ? 'rgba(77,243,211,.4)' : 'rgba(255,70,85,.4)'}`,
                }}>
                {cur.on ? <><Eye size={13} /> AFFICHÉ</> : <><EyeOff size={13} /> MASQUÉ</>}
              </button>
            </div>

            {/* réglages globaux */}
            <div className="clip-card p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}>
              <div className="font-display text-[10px] font-bold tracking-[.3em] text-white/45 mb-2">TOUS LES BOUTONS</div>
              <label className="block mb-2.5">
                <span className="flex items-center justify-between font-display text-[11px] font-bold tracking-[.12em] text-white/65 mb-1">
                  ÉCHELLE <span className="font-mono-t text-[#4df3d3]">×{settings.padScale.toFixed(2)}</span>
                </span>
                <input type="range" min={0.7} max={1.4} step={0.05} value={settings.padScale} className="w-full"
                  onChange={(e) => set({ ...settings, padScale: parseFloat(e.target.value) })} />
              </label>
              <label className="block">
                <span className="flex items-center justify-between font-display text-[11px] font-bold tracking-[.12em] text-white/65 mb-1">
                  OPACITÉ <span className="font-mono-t text-[#4df3d3]">{Math.round(settings.padOpacity * 100)}%</span>
                </span>
                <input type="range" min={0.3} max={1} step={0.05} value={settings.padOpacity} className="w-full"
                  onChange={(e) => set({ ...settings, padOpacity: parseFloat(e.target.value) })} />
              </label>
            </div>
          </div>
        </div>

        {/* pied */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,.09)', background: 'rgba(8,14,20,.9)' }}>
          <button onClick={() => { sfx.uiClick(); set({ ...settings, pad: { ...DEFAULT_PAD }, padScale: 1, padOpacity: 0.85 }); }}
            className="vbtn vbtn-ghost clip-btn px-4 py-2 text-[11px] flex items-center gap-2">
            <RotateCcw size={13} /> RÉINITIALISER
          </button>
          <button onClick={() => { sfx.uiClick(); onClose(); }}
            className="vbtn vbtn-red clip-btn px-7 py-2.5 text-sm flex items-center gap-2">
            <Check size={15} /> VALIDER
          </button>
        </div>
      </div>
    </div>
  );
}
