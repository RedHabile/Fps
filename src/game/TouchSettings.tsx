import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Bomb, Crosshair, Flashlight, Move, Pause, Repeat2, RotateCcw, Settings2, X, Zap } from 'lucide-react';
import {
  TOUCH_CONTROLS, TOUCH_SIZE_MAX, TOUCH_SIZE_MIN,
  type TouchControl, type TouchLayout, type TouchPoint, type TouchSizes, type ViewportSize,
} from './touchLayout';

interface TouchSettingsProps {
  layout: TouchLayout;
  sizes: TouchSizes;
  viewport: ViewportSize;
  onMove: (control: TouchControl, point: TouchPoint) => void;
  onSize: (control: TouchControl, size: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const names: Record<TouchControl, string> = {
  move: 'D\u00e9placement', fire: 'Tir', reload: 'Rechargement', action: 'Interaction', pause: 'Pause',
  swap: 'Changer d\u2019arme', frag: 'Grenade', flash: 'Flash',
};
const baseSizes: Record<TouchControl, number> = { move: 50, fire: 36, reload: 28, action: 28, pause: 28, swap: 30, frag: 30, flash: 30 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function TouchSettings({ layout, sizes, viewport, onMove, onSize, onReset, onClose }: TouchSettingsProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ control: TouchControl; pointer: number; dx: number; dy: number } | null>(null);
  const [selected, setSelected] = useState<TouchControl>('fire');
  const maxHeight = Math.min(340, Math.max(200, viewport.height * 0.48));
  const previewWidth = Math.max(130, maxHeight * viewport.width / Math.max(1, viewport.height));

  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [onClose]);

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, control: TouchControl) => {
    event.preventDefault();
    setSelected(control);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { control, pointer: event.pointerId, dx: event.clientX - rect.left - rect.width / 2, dy: event.clientY - rect.top - rect.height / 2 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const preview = previewRef.current;
    if (!drag || drag.pointer !== event.pointerId || !preview) return;
    const rect = preview.getBoundingClientRect();
    const radius = (baseSizes[drag.control] * sizes[drag.control]) / 2;
    onMove(drag.control, {
      x: clamp((event.clientX - rect.left - drag.dx) / rect.width, radius / rect.width, 1 - radius / rect.width),
      y: clamp((event.clientY - rect.top - drag.dy) / rect.height, radius / rect.height, 1 - radius / rect.height),
    });
  };

  const keyMove = (event: KeyboardEvent<HTMLButtonElement>, control: TouchControl) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    onMove(control, { x: clamp(layout[control].x + dx, 0, 1), y: clamp(layout[control].y + dy, 0, 1) });
  };

  const touchRelease = (event: PointerEvent<HTMLButtonElement>, action: () => void) => {
    if (event.pointerType !== 'touch') return;
    event.preventDefault();
    action();
  };

  const icon = (control: TouchControl) => {
    if (control === 'move') return <Move size={19} />;
    if (control === 'fire') return <Crosshair size={18} />;
    if (control === 'reload') return <RotateCcw size={14} />;
    if (control === 'action') return <Zap size={14} />;
    if (control === 'swap') return <Repeat2 size={15} />;
    if (control === 'frag') return <Bomb size={14} />;
    if (control === 'flash') return <Flashlight size={14} />;
    return <Pause size={13} fill="currentColor" />;
  };

  return <div className="panel-backdrop touch-settings-backdrop" onClick={onClose}>
    <section className="menu-panel touch-settings-panel" aria-label="Param&egrave;tres des commandes tactiles" onClick={(event) => event.stopPropagation()}>
      <div className="panel-top"><div className="panel-kicker"><span /> BREACH POINT <i>/</i> PARAM&Egrave;TRES</div><button className="panel-close" onClick={onClose} onPointerUp={(event) => touchRelease(event, onClose)} aria-label="Fermer les param&egrave;tres"><X size={20} /></button></div>
      <div className="panel-heading"><div><h2>COMMANDES<br /><span>TACTILES.</span></h2><p>Placez chaque commande l&agrave; o&ugrave; elle vous convient.</p></div><div className="touch-heading-actions"><button className="touch-reset-compact" onClick={onReset} onPointerUp={(event) => touchRelease(event, onReset)} aria-label="R&eacute;initialiser les commandes" title="R&eacute;initialiser"><RotateCcw size={16} /></button><Settings2 className="panel-heading-icon" size={36} strokeWidth={1.1} /></div></div>
      <div className="touch-settings-body">
        <div className="touch-preview-wrap"><div ref={previewRef} className="touch-preview" style={{ aspectRatio: `${viewport.width} / ${viewport.height}`, width: `min(100%, ${previewWidth}px)` }}>
          <div className="preview-horizon" /><div className="preview-crosshair">+</div><div className="preview-map">A <span>/</span> B</div>
          {TOUCH_CONTROLS.map((control) => {
            const size = baseSizes[control] * sizes[control];
            const radius = size / 2;
            return <button key={control} className={`layout-control layout-${control} ${selected === control ? 'is-selected' : ''}`} aria-label={`D\u00e9placer ${names[control]}`} title={names[control]} style={{ width: size, height: size, left: `clamp(${radius}px, ${layout[control].x * 100}%, calc(100% - ${radius}px))`, top: `clamp(${radius}px, ${layout[control].y * 100}%, calc(100% - ${radius}px))` }} onPointerDown={(event) => pointerDown(event, control)} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={(event) => keyMove(event, control)} onFocus={() => setSelected(control)}>{icon(control)}</button>;
          })}
        </div></div>
        <div className="touch-settings-copy"><span>01 / PERSONNALISATION</span><h3>VOTRE JEU,<br />VOS COMMANDES.</h3><p>Faites glisser les commandes sans les superposer. Les positions sont sauvegard&eacute;es sur cet appareil.</p>
          <div className="touch-size-block"><div className="touch-size-head"><span>TAILLE : {names[selected].toUpperCase()}</span><strong>{Math.round(sizes[selected] * 100)}%</strong></div><input className="touch-size-slider" type="range" min={TOUCH_SIZE_MIN} max={TOUCH_SIZE_MAX} step={0.05} value={sizes[selected]} onChange={(event) => onSize(selected, Number(event.target.value))} aria-label={`Taille du bouton ${names[selected]}`} /><div className="touch-size-row">{TOUCH_CONTROLS.map((control) => <button key={control} className={`touch-size-chip ${selected === control ? 'active' : ''}`} onClick={() => setSelected(control)}>{names[control]}</button>)}</div></div>
          <p className="touch-settings-hint">AU CLAVIER : UTILISEZ LES FL&Egrave;CHES POUR D&Eacute;PLACER UN BOUTON.</p><button className="secondary-button touch-reset" onClick={onReset} onPointerUp={(event) => touchRelease(event, onReset)}><RotateCcw size={16} /> R&Eacute;INITIALISER</button></div>
      </div>
      <div className="panel-footnote"><span className="status-dot" /> LES CHANGEMENTS S'APPLIQUENT IMM&Eacute;DIATEMENT EN PARTIE</div>
    </section>
  </div>;
}
