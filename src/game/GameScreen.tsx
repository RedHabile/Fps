import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Bomb, Crosshair, Flashlight, Pause, Play, Repeat2, RotateCcw, Settings2, Shield, Target, Zap } from 'lucide-react';
import { ARMORS, formatNumber, MAPS, TDM_KILL_TARGET, WEAPONS, type Difficulty, type GameMode, type MapId, type MatchResult, type Skin } from './data';
import { BreachEngine, type GameHUD } from './engine';
import { type RoomConnection } from './network';
import WeaponArt from './WeaponArt';
import { touchPosition, type TouchLayout, type TouchSizes, type ViewportSize } from './touchLayout';

interface GameScreenProps {
  skin: Skin;
  mapId: MapId;
  mode: GameMode;
  difficulty: Difficulty;
  room: RoomConnection | null;
  sound: boolean;
  touchLayout: TouchLayout;
  touchSizes: TouchSizes;
  viewport: ViewportSize;
  onSettings: () => void;
  onExit: () => void;
  onRestart: () => void;
  onResult: (result: MatchResult) => void;
}

const initialHud: GameHUD = {
  phase: 'buy', mode: 'sd', buyTime: 15, roundCredits: 1600, weaponId: 'p12', weaponName: 'P-12 VIGIL',
  sidearmId: 'p12', sidearmName: 'P-12 VIGIL', primaryId: null, primaryName: '—', activeSlot: 'sidearm',
  fragLeft: 1, flashLeft: 1, respawnIn: 0, flashBlind: 0, ready: false,
  health: 100, armor: 0, armorId: 'none', armorCapacity: 0, ammo: 12, reserve: 36, reloading: false, reloadProgress: 0, round: 1, overtime: false,
  blueScore: 0, redScore: 0, time: 75, attacking: true, bombTime: null, bombSite: null,
  prompt: '', actionProgress: 0, actionLabel: '', hit: false, damaged: false,
  kills: 0, points: 0, banner: 'MANCHE 01', bannerSub: 'ATTAQUEZ LES SITES A OU B',
  aliveBlue: 5, aliveRed: 5, dead: false, locked: false, markers: [], feed: '',
};

function timeLabel(seconds: number) {
  const clamped = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, '0')}`;
}

export default function GameScreen({ skin, mapId, mode, difficulty, room, sound, touchLayout, touchSizes, viewport, onSettings, onExit, onRestart, onResult }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BreachEngine | null>(null);
  const aimRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const [hud, setHud] = useState<GameHUD>(initialHud);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [hostPaused, setHostPaused] = useState(false);
  const [error, setError] = useState(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const compactTouch = viewport.height <= 500 && viewport.width > 700;

  useEffect(() => {
    if (!containerRef.current || !minimapRef.current) return;
    let engine: BreachEngine;
    try {
      engine = new BreachEngine({
        container: containerRef.current,
        minimap: minimapRef.current,
        skin,
        mapId,
        mode,
        difficulty,
        room,
        sound,
        onHud: setHud,
        onFinish: (matchResult) => {
          setResult(matchResult);
          onResult(matchResult);
        },
        onPause: () => setPaused((value) => !value),
        onHostPause: setHostPaused,
        onDisconnect: () => setDisconnected(true),
      });
      engineRef.current = engine;
    } catch (cause) {
      console.error('Unable to start the 3D renderer', cause);
      setError(true);
      return;
    }
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // A new GameScreen is mounted for every deployment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused || Boolean(result) || disconnected);
  }, [paused, result, disconnected]);

  useEffect(() => {
    if (!room) return;
    return room.subscribe((message) => {
      if (message.type === 'restart' && room.status.role === 'guest') onRestart();
    });
  }, [room, onRestart]);

  const updateStick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.36);
    let y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.36);
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    setStick({ x, y });
    engineRef.current?.setMove(x, y);
  };

  const resetStick = () => {
    setStick({ x: 0, y: 0 });
    engineRef.current?.setMove(0, 0);
  };

  const startAgain = () => {
    if (room?.status.role === 'host') room.send({ type: 'restart' });
    onRestart();
  };

  const openSettings = () => {
    setPaused(true);
    onSettings();
  };

  return (
    <main className="game-screen" aria-label="Partie Search and Destroy">
      <div ref={containerRef} className="game-canvas" />
      <div className={`damage-vignette ${hud.damaged ? 'is-active' : ''}`} />
      <div className="game-vignette" />

      <div className={`flash-overlay ${hud.flashBlind > 0.02 ? 'is-active' : ''}`} style={{ opacity: hud.flashBlind > 0.02 ? Math.min(1, hud.flashBlind) : 0 }} />
      <div className="game-topbar">
        <div className="game-brand"><span className="mini-mark">B<span>.</span></span><span>BREACH<br /><b>POINT</b></span></div>
        <div className="game-scoreboard">
          <div className="score-side blue-side"><span>VOTRE &Eacute;QUIPE</span><strong>{hud.blueScore}</strong></div>
          <div className="score-center"><span>{hud.mode === 'tdm' ? `PREMIER À ${TDM_KILL_TARGET}` : hud.overtime ? 'PROLONGATION' : `MANCHE ${String(hud.round).padStart(2, '0')}`}</span><b>{hud.phase === 'buy' ? timeLabel(hud.buyTime) : hud.bombTime !== null ? timeLabel(hud.bombTime) : timeLabel(hud.time)}</b></div>
          <div className="score-side red-side"><strong>{hud.redScore}</strong><span>ADVERSAIRES</span></div>
        </div>
        {!touch && <button className="pause-button" onClick={() => setPaused(true)} aria-label="Mettre en pause"><Pause size={18} fill="currentColor" /></button>}
      </div>

      <div className="game-objective">
        <span className="objective-line" />
        <div><small>{hud.mode === 'tdm' ? 'COMBAT EN ÉQUIPE' : hud.attacking ? 'ATTAQUE' : 'D\u00c9FENSE'} <span>//</span> OBJECTIF</small><strong>{hud.mode === 'tdm' ? `ÉLIMINEZ L'ÉQUIPE ADVERSE` : hud.bombTime !== null ? `CHARGE POS\u00c9E : SITE ${hud.bombSite}` : hud.attacking ? 'POSEZ LA CHARGE' : 'PROT\u00c9GEZ LES SITES'}</strong></div>
      </div>
      {hud.phase !== 'buy' && <div className="game-wallet"><span>&#9670;</span> {formatNumber(hud.roundCredits)} <small>CR TACTIQUES</small></div>}
      <div className="minimap-wrap"><canvas ref={minimapRef} width={160} height={160} /><div className="minimap-caption"><span>{MAPS.find((map) => map.id === mapId)?.name}</span><span>N <b>+</b></span></div></div>

      {hud.markers.map((marker) => marker.visible && (
        <div className="world-marker" key={marker.id} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
          <span><b>{marker.id}</b></span><small>{marker.distance} M</small>
        </div>
      ))}

      {!hud.dead && hud.phase !== 'buy' && <div className={`crosshair ${hud.hit ? 'crosshair-hit' : ''}`}><i /><i /><i /><i />{hud.hit && <b>&times;</b>}</div>}
      {hud.banner && <div className="round-banner" key={`${hud.round}-${hud.banner}`}><span>BREACH POINT // {String(hud.round).padStart(2, '0')}</span><strong>{hud.banner}</strong><small>{hud.bannerSub}</small></div>}
      {hud.feed && <div className="kill-feed"><Crosshair size={15} /> {hud.feed}</div>}
      {hud.dead && !hud.banner && hud.mode === 'sd' && <div className="dead-message"><span>&Eacute;LIMIN&Eacute;</span><strong>VOTRE &Eacute;QUIPE COMBAT ENCORE</strong><small>Red&eacute;ploiement &agrave; la prochaine manche</small></div>}
      {(hud.prompt || hud.actionLabel) && !hud.dead && <div className="interaction-prompt">
        {hud.actionLabel ? <><strong>{hud.actionLabel}</strong><div className="action-progress"><i style={{ width: `${hud.actionProgress * 100}%` }} /></div></> : <><kbd>{touch ? 'TAP' : 'E'}</kbd><strong>{hud.prompt}</strong></>}
      </div>}
      {!hud.locked && hud.phase === 'playing' && !touch && !paused && !result && !hud.dead && <div className="lock-hint">CLIQUEZ DANS LE JEU POUR VISER <span> / </span> ZQSD POUR BOUGER</div>}

      <div className="game-bottom">
        <div className="vitals-group"><div className="health-panel"><div className="health-icon"><Shield size={20} /></div><div><small>INT&Eacute;GRIT&Eacute;</small><div className="health-number">{hud.health}<span> / 100</span></div><div className="health-bar"><i style={{ width: `${hud.health}%` }} /></div></div></div>{hud.armorId !== 'none' && <div className="armor-hud"><Shield size={17} /><div><small>ARMURE</small><strong>{hud.armor}<span> / {hud.armorCapacity}</span></strong><div className="armor-bar"><i style={{ width: `${hud.armorCapacity ? hud.armor / hud.armorCapacity * 100 : 0}%` }} /></div></div></div>}</div>
        <div className="team-count"><span className="teal-dot" /> {hud.aliveBlue} EN VIE <i /> {hud.mode === 'tdm' ? `${hud.redScore} ÉLIMINATIONS` : `${hud.aliveRed} ENNEMIS`} <span className="orange-dot" /></div>
        <div className="loadout-panel">
          <div className="weapon-slots">
            <button className={`weapon-slot ${hud.activeSlot === 'sidearm' ? 'active' : ''}`} onClick={() => engineRef.current?.swapWeapon()} aria-label="Arme de poing"><small>1 / POING</small><strong>{hud.sidearmName}</strong></button>
            <button className={`weapon-slot ${hud.activeSlot === 'primary' ? 'active' : ''} ${!hud.primaryId ? 'empty' : ''}`} disabled={!hud.primaryId} onClick={() => engineRef.current?.swapWeapon()} aria-label="Arme principale"><small>2 / PRINCIPALE</small><strong>{hud.primaryName}</strong></button>
          </div>
          <div className="grenade-counts"><span className={hud.fragLeft > 0 ? '' : 'depleted'}><Bomb size={13} /> ×{hud.fragLeft}</span><span className={hud.flashLeft > 0 ? '' : 'depleted'}><Flashlight size={13} /> ×{hud.flashLeft}</span></div>
          <div className="ammo-panel"><div><small>{hud.reloading ? 'RECHARGEMENT...' : hud.weaponName}</small><div className="ammo-number">{String(hud.ammo).padStart(2, '0')} <span>/ {hud.reserve}</span></div>{hud.reloading && <div className="reload-meter" role="progressbar" aria-label="Rechargement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.reloadProgress * 100)}><i style={{ width: `${hud.reloadProgress * 100}%` }} /></div>}</div><div className="ammo-icon"><Target size={22} /></div></div>
        </div>
      </div>

      {touch && hud.phase === 'playing' && !paused && !result && <>
        <div className="touch-look" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); aimRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; }} onPointerMove={(event) => { const last = aimRef.current; if (!last || last.id !== event.pointerId) return; engineRef.current?.look((event.clientX - last.x) * 1.5, (event.clientY - last.y) * 1.5); aimRef.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; }} onPointerUp={() => { aimRef.current = null; }} onPointerCancel={() => { aimRef.current = null; }} />
        <div className="touch-stick" style={{ ...touchPosition(touchLayout.move, (compactTouch ? 44 : 60) * touchSizes.move), width: (compactTouch ? 88 : 120) * touchSizes.move, height: (compactTouch ? 88 : 120) * touchSizes.move }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateStick(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateStick(event); }} onPointerUp={resetStick} onPointerCancel={resetStick}><div className="touch-stick-inner" style={{ transform: `translate(${stick.x * 30}px, ${stick.y * 30}px)` }} /></div>
        <button className="touch-fire" style={{ ...touchPosition(touchLayout.fire, (compactTouch ? 29 : 35) * touchSizes.fire), width: (compactTouch ? 58 : 70) * touchSizes.fire, height: (compactTouch ? 58 : 70) * touchSizes.fire }} aria-label="Tirer" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setFiring(true); }} onPointerUp={() => engineRef.current?.setFiring(false)} onPointerCancel={() => engineRef.current?.setFiring(false)}><Crosshair size={29} /></button>
        <button className={`touch-reload ${hud.reloading ? 'is-reloading' : ''}`} style={{ ...touchPosition(touchLayout.reload, (compactTouch ? 19 : 22) * touchSizes.reload), width: (compactTouch ? 38 : 44) * touchSizes.reload, height: (compactTouch ? 38 : 44) * touchSizes.reload }} aria-label="Recharger" onClick={() => engineRef.current?.reload()}><RotateCcw size={20} /></button>
        {hud.mode === 'sd' && <button className={`touch-action ${hud.prompt ? 'available' : ''}`} style={{ ...touchPosition(touchLayout.action, (compactTouch ? 19 : 22) * touchSizes.action), width: (compactTouch ? 38 : 44) * touchSizes.action, height: (compactTouch ? 38 : 44) * touchSizes.action }} aria-label="Interagir" onClick={() => engineRef.current?.interact()}><Zap size={19} /></button>}
        {hud.primaryId && <button className="touch-swap" style={{ ...touchPosition(touchLayout.swap, 20 * touchSizes.swap), width: 40 * touchSizes.swap, height: 40 * touchSizes.swap }} aria-label="Changer d'arme" onClick={() => engineRef.current?.swapWeapon()}><Repeat2 size={18} /></button>}
        <button className={`touch-grenade ${hud.fragLeft <= 0 ? 'depleted' : ''}`} style={{ ...touchPosition(touchLayout.frag, 19 * touchSizes.frag), width: 38 * touchSizes.frag, height: 38 * touchSizes.frag }} aria-label="Lancer une grenade" onClick={() => engineRef.current?.throwGrenade('frag')}><Bomb size={17} /><b>{hud.fragLeft}</b></button>
        <button className={`touch-grenade ${hud.flashLeft <= 0 ? 'depleted' : ''}`} style={{ ...touchPosition(touchLayout.flash, 19 * touchSizes.flash), width: 38 * touchSizes.flash, height: 38 * touchSizes.flash }} aria-label="Lancer une flash" onClick={() => engineRef.current?.throwGrenade('flash')}><Flashlight size={17} /><b>{hud.flashLeft}</b></button>
      </>}
      {touch && hud.phase !== 'buy' && !paused && !result && <button className="touch-pause" style={touchPosition(touchLayout.pause, 20)} aria-label="Mettre en pause" onClick={() => setPaused(true)}><Pause size={18} fill="currentColor" /></button>}

      {hud.phase === 'buy' && !result && !disconnected && !error && <div className="buy-overlay">
        <section className="buy-shell" aria-label="Achat d'armes de la manche">
          <div className="buy-topline"><span><i /> {hud.overtime ? 'PROLONGATION' : 'PR\u00c9PARATION'} / MANCHE {String(hud.round).padStart(2, '0')}</span><div className="buy-top-actions"><span>{hud.attacking ? 'ATTAQUE' : 'D\u00c9FENSE'} <b>//</b> {MAPS.find((map) => map.id === mapId)?.name}</span><button className="buy-pause" aria-label="Pause pendant l'achat" onClick={() => setPaused(true)}><Pause size={14} fill="currentColor" /></button></div></div>
          <div className="buy-heading"><div><h2>CHOISISSEZ<br /><em>VOTRE ARME.</em></h2><p>{hud.round === 1 && hud.mode === 'sd' ? 'Premi\u00e8re manche : armes de poing uniquement.' : hud.overtime ? 'Prolongation : changement de c\u00f4t\u00e9 \u00e0 chaque manche.' : hud.round > 1 ? 'Survivants : arsenal conserv\u00e9. 1 arme de poing + 1 arme principale.' : '15 secondes pour pr\u00e9parer votre \u00e9quipement.'}</p></div><div className="buy-wallet"><small>BUDGET TACTIQUE</small><strong><span>&#9670;</span> {formatNumber(hud.roundCredits)}</strong><small>CR&Eacute;DITS DE PARTIE</small></div></div>
          <div className="buy-grid">{WEAPONS.map((weapon, index) => {
            const selected = hud.weaponId === weapon.id;
            const currentPrice = WEAPONS.find((item) => item.id === hud.weaponId)?.price ?? 0;
            const affordable = weapon.price <= hud.roundCredits + currentPrice;
            const restricted = hud.round === 1 && weapon.kind !== 'pistol' && weapon.kind !== 'heavy-pistol';
            return <button key={weapon.id} className={`buy-card ${selected ? 'selected' : ''}`} disabled={hud.ready || !affordable || restricted} onClick={() => engineRef.current?.buyWeapon(weapon.id)}>
              <span className="buy-card-top"><span>0{index + 1} / {weapon.family}</span><b>{selected ? 'S\u00c9LECTIONN\u00c9' : restricted ? 'MANCHE PISTOLETS' : !affordable ? 'FONDS INSUFFISANTS' : 'CHOISIR'}</b></span>
              <WeaponArt id={weapon.id} skin={skin} />
              <span className="buy-card-name"><strong>{weapon.name}</strong><b>{weapon.price ? `${formatNumber(weapon.price)} CR` : 'OFFERT'}</b></span>
              <span className="buy-card-stats">D&Eacute;G&Acirc;TS {weapon.damage}{weapon.pellets ? ` x${weapon.pellets}` : ''} <i /> CHARGEUR {weapon.magazine}</span>
            </button>;
          })}</div>
          <div className="armor-buy"><div className="armor-buy-title"><Shield size={20} /><div><strong>PROTECTION</strong><small>ABSORBE UNE PARTIE DES D&Eacute;G&Acirc;TS</small></div></div><div className="armor-options">{ARMORS.map((armor) => {
            const selected = hud.armorId === armor.id;
            const currentPrice = ARMORS.find((entry) => entry.id === hud.armorId)?.price ?? 0;
            const affordable = armor.price <= hud.roundCredits + currentPrice;
            return <button key={armor.id} className={`armor-choice ${selected ? 'selected' : ''}`} disabled={hud.ready || !affordable} onClick={() => engineRef.current?.buyArmor(armor.id)}><span>{armor.name}</span><strong>{armor.price ? `${formatNumber(armor.price)} CR` : 'OFFERT'}</strong><small>{armor.capacity ? `${armor.capacity} ARMURE / ${Math.round(armor.absorption * 100)}%` : 'AUCUNE PROTECTION'}</small></button>;
          })}</div></div>
          <div className="buy-footer"><div><span className="buy-countdown">{String(hud.buyTime).padStart(2, '0')}<small>SEC</small></span><p>&Eacute;limination +200 / victoire +1 000 / d&eacute;faite +700.<br />1 grenade + 1 flash offertes par manche. D&eacute;ploiement automatique apr&egrave;s 15 secondes.</p></div><button className="primary-button buy-ready" onClick={() => engineRef.current?.readyToDeploy()}>{hud.ready ? 'MODIFIER L\u2019\u00c9QUIPEMENT' : 'VALIDER L\u2019\u00c9QUIPEMENT'} <Play size={16} fill="currentColor" /></button></div>
        </section>
      </div>}

      {hud.mode === 'tdm' && hud.dead && hud.phase === 'playing' && !result && !disconnected && !error && <div className="buy-overlay respawn-overlay">
        <section className="buy-shell" aria-label="Choisir son équipement avant réapparition">
          <div className="buy-topline"><span><i /> ÉLIMINÉ <b>//</b> RÉAPPARITION DANS {Math.ceil(hud.respawnIn)} SEC</span><div className="buy-top-actions"><span>{hud.weaponName} <b>//</b> {MAPS.find((map) => map.id === mapId)?.name}</span></div></div>
          <div className="buy-heading"><div><h2>CHOISISSEZ<br /><em>VOTRE ARME.</em></h2><p>Votre arsenal est conservé. Modifiez-le avant de réapparaître.</p></div><div className="buy-wallet"><small>BUDGET TACTIQUE</small><strong><span>&#9670;</span> {formatNumber(hud.roundCredits)}</strong><small>CR&Eacute;DITS DE PARTIE</small></div></div>
          <div className="buy-grid">{WEAPONS.map((weapon, index) => {
            const selected = hud.weaponId === weapon.id;
            const currentPrice = WEAPONS.find((item) => item.id === hud.weaponId)?.price ?? 0;
            const affordable = weapon.price <= hud.roundCredits + currentPrice;
            return <button key={weapon.id} className={`buy-card ${selected ? 'selected' : ''}`} disabled={!affordable} onClick={() => engineRef.current?.buyWeapon(weapon.id)}>
              <span className="buy-card-top"><span>0{index + 1} / {weapon.family}</span><b>{selected ? 'S\u00c9LECTIONN\u00c9' : !affordable ? 'FONDS INSUFFISANTS' : 'CHOISIR'}</b></span>
              <WeaponArt id={weapon.id} skin={skin} />
              <span className="buy-card-name"><strong>{weapon.name}</strong><b>{weapon.price ? `${formatNumber(weapon.price)} CR` : 'OFFERT'}</b></span>
              <span className="buy-card-stats">D&Eacute;G&Acirc;TS {weapon.damage}{weapon.pellets ? ` x${weapon.pellets}` : ''} <i /> CHARGEUR {weapon.magazine}</span>
            </button>;
          })}</div>
          <div className="armor-buy"><div className="armor-buy-title"><Shield size={20} /><div><strong>PROTECTION</strong><small>ABSORBE UNE PARTIE DES D&Eacute;G&Acirc;TS</small></div></div><div className="armor-options">{ARMORS.map((armor) => {
            const selected = hud.armorId === armor.id;
            const currentPrice = ARMORS.find((entry) => entry.id === hud.armorId)?.price ?? 0;
            const affordable = armor.price <= hud.roundCredits + currentPrice;
            return <button key={armor.id} className={`armor-choice ${selected ? 'selected' : ''}`} disabled={!affordable} onClick={() => engineRef.current?.buyArmor(armor.id)}><span>{armor.name}</span><strong>{armor.price ? `${formatNumber(armor.price)} CR` : 'OFFERT'}</strong><small>{armor.capacity ? `${armor.capacity} ARMURE / ${Math.round(armor.absorption * 100)}%` : 'AUCUNE PROTECTION'}</small></button>;
          })}</div></div>
          <div className="buy-footer"><div><span className="buy-countdown">{String(Math.ceil(hud.respawnIn)).padStart(2, '0')}<small>SEC</small></span><p>1 grenade + 1 flash à chaque réapparition.</p></div><button className="primary-button buy-ready" onClick={() => engineRef.current?.respawnPlayer()}>RÉAPPARAÎTRE <Play size={16} fill="currentColor" /></button></div>
        </section>
      </div>}

      {(paused || result || disconnected || error || hostPaused) && <div className="game-overlay">
        <div className="game-overlay-content">
          <div className="overlay-kicker"><span /> BREACH POINT // {result ? 'RAPPORT DE MISSION' : 'OP\u00c9RATION EN COURS'}</div>
          {error ? <><h2>CONNEXION<br /><em>3D IMPOSSIBLE.</em></h2><p>Ce navigateur ne peut pas initialiser WebGL. Essayez un navigateur r&eacute;cent avec l'acc&eacute;l&eacute;ration graphique activ&eacute;e.</p><button className="primary-button" onClick={onExit}><ArrowLeft size={18} /> RETOUR AU MENU</button></> : disconnected ? <><h2>CONNEXION<br /><em>INTERROMPUE.</em></h2><p>L'h&ocirc;te a quitt&eacute; la partie. Vous pouvez rejoindre un nouveau salon depuis le menu.</p><button className="primary-button" onClick={onExit}><ArrowLeft size={18} /> RETOUR AU MENU</button></> : result ? <>
            <h2>{result.won ? 'MISSION' : 'MISSION'}<br /><em>{result.won ? 'ACCOMPLIE.' : '\u00c9CHOU\u00c9E.'}</em></h2>
            <p>{result.won ? 'Votre escouade a pris le contr\u00f4le du d\u00e9p\u00f4t.' : 'Le d\u00e9p\u00f4t vous a \u00e9chapp\u00e9. Pr\u00e9parez votre revanche.'}</p>
            <div className="result-line"><div><small>SCORE</small><strong>{result.blueScore} <i>:</i> {result.redScore}</strong></div><div><small>&Eacute;LIMINATIONS</small><strong>{result.kills}</strong></div><div><small>POINTS</small><strong>{formatNumber(result.points)}</strong></div><div><small>CR&Eacute;DITS GAGN&Eacute;S</small><strong className="result-credits">+{formatNumber(result.credits)}</strong></div></div>
            <div className="overlay-actions">{room?.status.role === 'guest' ? <div className="waiting-restart">EN ATTENTE DE L'H&Ocirc;TE POUR REJOUER</div> : <button className="primary-button" onClick={startAgain}><RotateCcw size={17} /> REJOUER</button>}<button className="text-button" onClick={onExit}>RETOUR AU MENU <ArrowLeft size={16} /></button></div>
          </> : hostPaused ? <><h2>PARTIE<br /><em>EN PAUSE.</em></h2><p>L'h&ocirc;te a mis la mission en pause. La partie reprendra d&egrave;s son retour.</p><div className="overlay-actions"><button className="text-button" onClick={openSettings}><Settings2 size={16} /> PARAM&Egrave;TRES TACTILES</button><button className="text-button" onClick={onExit}>QUITTER LA PARTIE <ArrowLeft size={16} /></button></div></> : <><h2>PARTIE<br /><em>EN PAUSE.</em></h2><p>Reprenez votre souffle, op&eacute;rateur. La mission vous attend.</p>{room && <p className="pause-note">En salon, seul l'h&ocirc;te met la simulation en pause.</p>}<div className="overlay-actions"><button className="primary-button" onClick={() => setPaused(false)}><Play size={17} fill="currentColor" /> REPRENDRE</button><button className="text-button" onClick={openSettings}><Settings2 size={16} /> PARAM&Egrave;TRES TACTILES</button><button className="text-button" onClick={onExit}>QUITTER LA PARTIE <ArrowLeft size={16} /></button></div></>}
        </div>
      </div>}
    </main>
  );
}