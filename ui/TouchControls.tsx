// ─────────────────────────────────────────────────────────────
//  VALENCE — Contrôles tactiles (mobile / tablette)
//  Disposition entièrement personnalisable depuis le menu.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { store, type PadId, type PadLayout } from '../game/store';
import { WEAPONS } from '../game/weapons';
import { useSnap } from './HUD';
import {
  Crosshair, RotateCw, ChevronsDown, ArrowBigUpDash, Pause,
  Footprints, ShoppingCart, Bomb, Repeat, Zap, Star,
} from 'lucide-react';

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return !!(coarse && touch);
}

// ——— état lu par le moteur ———
export const touchState = {
  active: false,
  moveX: 0, moveY: 0,
  lookX: 0, lookY: 0,
  firing: false,
  ads: false,
  crouch: false,
  jump: false,
  walk: false,
  consumeLook() {
    const x = this.lookX, y = this.lookY;
    this.lookX = 0; this.lookY = 0;
    return [x, y] as const;
  },
  reset() {
    this.moveX = 0; this.moveY = 0; this.lookX = 0; this.lookY = 0;
    this.firing = false; this.ads = false; this.crouch = false; this.jump = false; this.walk = false;
  },
};

type Cmd = 'reload' | 'swap' | 'shop' | 'pause' | 'jump' | 'useDown' | 'useUp' | 'abilityQ' | 'abilityX';

export const PAD_ICON: Record<PadId, React.ReactNode> = {
  stick: <Repeat size={18} />,
  fire: <Crosshair size={30} />,
  ads: <Crosshair size={20} />,
  use: <Bomb size={24} />,
  jump: <ArrowBigUpDash size={20} />,
  crouch: <ChevronsDown size={18} />,
  walk: <Footprints size={18} />,
  reload: <RotateCw size={18} />,
  swap: <span className="font-display font-bold text-base leading-none">1/2</span>,
  shop: <ShoppingCart size={20} />,
  pause: <Pause size={15} />,
  abQ: <Zap size={19} />,
  abX: <Star size={19} />,
};

export const PAD_LABEL: Record<PadId, string> = {
  stick: '', fire: 'FEU', ads: 'VISÉE', use: 'SPIKE', jump: 'SAUT',
  crouch: 'ACCR.', walk: 'LENT', reload: 'RECH.', swap: 'ARME',
  shop: 'BOUTIQUE', pause: '', abQ: 'POUVOIR', abX: 'ULTIME',
};

/** Rendu commun d'un bouton rond (utilisé en jeu ET dans l'éditeur) */
export function PadBtn({ id, size, active, opacity, label, children, ...rest }: {
  id?: PadId; size: number; active?: boolean; opacity?: number; label?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const accent = id === 'fire' || id === 'shop';
  const spike = id === 'use';
  return (
    <div
      {...rest}
      className="rounded-full flex flex-col items-center justify-center select-none touch-none"
      style={{
        width: size, height: size, opacity: opacity ?? 1,
        background: active
          ? 'rgba(255,70,85,.5)'
          : spike ? 'rgba(255,210,93,.26)'
            : accent ? 'rgba(255,70,85,.3)' : 'rgba(10,18,26,.55)',
        border: `2px solid ${active ? '#ff4655' : spike ? '#ffd25d' : accent ? '#ff4655' : 'rgba(236,232,225,.3)'}`,
        color: spike ? '#ffd25d' : active || accent ? '#fff' : 'rgba(236,232,225,.85)',
        backdropFilter: 'blur(4px)',
        ...rest.style,
      }}>
      {children}
      {label && <span className="font-display text-[8px] font-bold tracking-[.12em] mt-0.5">{label}</span>}
    </div>
  );
}

const JOY_R = 62;
const KNOB_R = 30;

interface Props {
  onCommand: (c: Cmd) => void;
  sensitivity: number;
  pad: PadLayout;
  padScale: number;
  padOpacity: number;
}

export default function TouchControls({ onCommand, sensitivity, pad, padScale, padOpacity }: Props) {
  const s = useSnap();
  const [joy, setJoy] = useState<{ x: number; y: number } | null>(null);
  const [held, setHeld] = useState<Record<string, boolean>>({});
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef<{ x: number; y: number } | null>(null);
  const lookStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    touchState.active = true;
    return () => { touchState.active = false; touchState.reset(); };
  }, []);

  const blocked = s.paused || s.buyOpen || s.phase === 'matchEnd' || s.phase === 'halftime';
  useEffect(() => { if (blocked) { touchState.reset(); setHeld({}); } }, [blocked]);

  // ——— zone de visée & joystick libre ———
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const stickCx = () => (pad.stick.x / 100) * window.innerWidth;

    const down = (e: PointerEvent) => {
      if (blocked) return;
      const t = e.target as HTMLElement;
      if (t.closest('[data-ui]')) return;
      el.setPointerCapture?.(e.pointerId);
      // le joystick s'active du côté où il est configuré
      const onStickSide = pad.stick.on && (stickCx() < window.innerWidth / 2
        ? e.clientX < window.innerWidth * 0.46
        : e.clientX > window.innerWidth * 0.54);
      if (onStickSide && joyId.current === null) {
        joyId.current = e.pointerId;
        joyOrigin.current = { x: e.clientX, y: e.clientY };
        setJoy({ x: 0, y: 0 });
      } else if (lookId.current === null) {
        lookId.current = e.pointerId;
        lookLast.current = { x: e.clientX, y: e.clientY };
        lookStart.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === joyId.current && joyOrigin.current) {
        let dx = e.clientX - joyOrigin.current.x;
        let dy = e.clientY - joyOrigin.current.y;
        const d = Math.hypot(dx, dy);
        const R = JOY_R * padScale;
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        setJoy({ x: dx, y: dy });
        touchState.moveX = dx / R;
        touchState.moveY = dy / R;
      } else if (e.pointerId === lookId.current && lookLast.current) {
        const dx = e.clientX - lookLast.current.x;
        const dy = e.clientY - lookLast.current.y;
        lookLast.current = { x: e.clientX, y: e.clientY };
        const k = 2.1 * sensitivity;
        touchState.lookX += dx * k;
        touchState.lookY += dy * k;
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === joyId.current) {
        joyId.current = null; joyOrigin.current = null;
        setJoy(null);
        touchState.moveX = 0; touchState.moveY = 0;
      } else if (e.pointerId === lookId.current) {
        const st = lookStart.current;
        if (st && performance.now() - st.t < 220 && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 14) {
          touchState.firing = true;
          setTimeout(() => { touchState.firing = false; }, 110);
        }
        lookId.current = null; lookLast.current = null; lookStart.current = null;
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [blocked, sensitivity, pad.stick.x, pad.stick.on, padScale]);

  const cfg = WEAPONS[s.weapon];

  /** place un bouton selon la disposition enregistrée */
  const place = (id: PadId, onDown: () => void, onUp?: () => void, active?: boolean, show = true) => {
    const b = pad[id];
    if (!b?.on || !show) return null;
    const size = b.size * padScale;
    return (
      <div key={id} data-ui
        className="absolute"
        style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%,-50%)' }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setHeld((h) => ({ ...h, [id]: true })); onDown(); }}
        onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); setHeld((h) => ({ ...h, [id]: false })); onUp?.(); }}
        onPointerLeave={() => { setHeld((h) => ({ ...h, [id]: false })); onUp?.(); }}
        onContextMenu={(e) => e.preventDefault()}>
        <PadBtn id={id} size={size} label={PAD_LABEL[id]} opacity={padOpacity}
          active={active ?? !!held[id]}>
          {PAD_ICON[id]}
        </PadBtn>
      </div>
    );
  };

  const stickB = pad.stick;
  const R = JOY_R * padScale;

  return (
    <div ref={rootRef} className="absolute inset-0 z-30 touch-none" style={{ pointerEvents: blocked ? 'none' : 'auto' }}>
      {/* joystick dynamique */}
      {joy && joyOrigin.current && (
        <div className="absolute pointer-events-none" style={{ left: joyOrigin.current.x - R, top: joyOrigin.current.y - R }}>
          <div className="rounded-full" style={{
            width: R * 2, height: R * 2,
            background: 'rgba(10,18,26,.4)', border: '2px solid rgba(236,232,225,.26)',
          }} />
          <div className="rounded-full absolute" style={{
            width: KNOB_R * 2 * padScale, height: KNOB_R * 2 * padScale,
            left: R - KNOB_R * padScale + joy.x, top: R - KNOB_R * padScale + joy.y,
            background: 'rgba(255,70,85,.55)', border: '2px solid #ff4655',
            boxShadow: '0 0 18px rgba(255,70,85,.5)',
          }} />
        </div>
      )}
      {/* repère du joystick au repos */}
      {!joy && stickB.on && (
        <div className="absolute pointer-events-none rounded-full"
          style={{
            left: `${stickB.x}%`, top: `${stickB.y}%`, transform: 'translate(-50%,-50%)',
            width: stickB.size * padScale, height: stickB.size * padScale,
            border: '2px dashed rgba(236,232,225,.45)', opacity: padOpacity * 0.3,
          }}>
          <div className="w-full h-full flex items-center justify-center font-display text-[9px] tracking-[.18em] text-white/70 text-center px-3">
            DÉPLACEMENT
          </div>
        </div>
      )}

      {place('fire', () => { touchState.firing = true; }, () => { touchState.firing = false; }, touchState.firing)}
      {place('ads', () => {
        const max = cfg.scopeLevels === 2 ? 2 : 1;
        const next = s.adsLevel >= max ? 0 : s.adsLevel + 1;
        store.set({ adsLevel: next as 0 | 1 | 2 });
        touchState.ads = next > 0;
      }, undefined, s.adsLevel > 0)}
      {place('use', () => onCommand('useDown'), () => onCommand('useUp'), undefined,
        s.canPlant || s.canDefuse || s.canPickup)}
      {place('jump', () => { touchState.jump = true; }, () => { touchState.jump = false; })}
      {place('crouch', () => { touchState.crouch = !touchState.crouch; }, undefined, touchState.crouch)}
      {place('walk', () => { touchState.walk = !touchState.walk; }, undefined, touchState.walk)}
      {place('reload', () => onCommand('reload'))}
      {place('swap', () => onCommand('swap'))}
      {place('shop', () => onCommand('shop'), undefined, true, s.phase === 'buy' && !s.buyOpen)}
      {place('abQ', () => onCommand('abilityQ'), undefined, s.abilityCharges > 0 && s.abilityCd >= 1)}
      {place('abX', () => onCommand('abilityX'), undefined, s.ultCharges > 0 && s.ultCd >= 1)}
      {place('pause', () => onCommand('pause'))}
    </div>
  );
}
