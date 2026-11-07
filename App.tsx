// ─────────────────────────────────────────────────────────────
//  VALENCE — Racine de l'application
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { store, loadSettings, saveSettings, type Settings } from './game/store';
import { sfx } from './game/audio';
import { Game } from './game/engine';
import HUD from './ui/HUD';
import MainMenu from './ui/Menus';
import TouchControls, { isTouchDevice, touchState } from './ui/TouchControls';
import Online from './ui/Online';
import { Net } from './game/net';
import Shop from './ui/Shop';
import { loadProfile, saveProfile, matchReward, type Profile } from './game/agentsData';

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [touch, setTouch] = useState(isTouchDevice);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [profile, setProfileState] = useState<Profile>(loadProfile);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const setProfile = useCallback((p: Profile) => {
    setProfileState(p); saveProfile(p); store.set({ coins: p.coins });
    gameRef.current?.setProfile(p);
  }, []);
  const netRef = useRef<Net | null>(null);
  if (!netRef.current) {
    netRef.current = new Net({
      onStatus: () => { /* branché par l'UI du salon */ },
      onRoster: () => { /* idem */ },
      onPlayerState: (s) => gameRef.current?.netPlayerState(s),
      onWorld: (w) => gameRef.current?.netWorld(w),
      onShot: (m) => gameRef.current?.netShot(m),
      onHit: (m) => gameRef.current?.netHit(m),
      onLeave: (id) => gameRef.current?.netPlayerLeave(id),
    });
  }
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    if (screen !== 'game' || !canvasRef.current) return;
    const s = settingsRef.current;
    sfx.init();
    sfx.setVolume(s.volume);
    store.reset({
      screen: 'game',
      phase: 'buy',
      pointerLocked: false,
      paused: false,
      targetWins: s.matchWins,
      mapId: s.mapId,
      settings: s,
    });
    const g = new Game(canvasRef.current, s);
    gameRef.current = g;
    setGame(g);
    if (new URLSearchParams(window.location.search).has('debug')) {
      (window as unknown as { __V: Game }).__V = g;
    }
    if (netRef.current?.connected) g.attachNet(netRef.current);
    g.setProfile(profileRef.current);
    // récompenses de fin de match
    g.onMatchEnd = (win, kills, rounds) => {
      const cur = profileRef.current;
      const { coins, xp } = matchReward(win, kills, rounds);
      let lvl = cur.level, total = cur.xp + xp;
      while (total >= 500 + lvl * 250) { total -= 500 + lvl * 250; lvl++; }
      const next: Profile = {
        ...cur, coins: cur.coins + coins, xp: total, level: lvl,
        wins: cur.wins + (win ? 1 : 0), losses: cur.losses + (win ? 0 : 1),
        kills: cur.kills + kills,
      };
      setProfileState(next); saveProfile(next);
      store.set({ coins: next.coins, rewardCoins: coins, rewardXp: xp, rewardLevel: lvl > cur.level ? lvl : 0 });
    };
    // sur mobile : pas de verrou souris, les contrôles tactiles prennent le relais
    if (touch) {
      touchState.active = true;
      store.set({ pointerLocked: true });
    } else {
      g.requestLock();
    }

    const cvs = canvasRef.current;
    const onClick = () => {
      if (touch) return;
      const snap = store.getSnapshot();
      if (!snap.pointerLocked && !snap.buyOpen && snap.phase !== 'matchEnd') g.requestLock();
    };
    cvs.addEventListener('click', onClick);
    return () => {
      cvs.removeEventListener('click', onClick);
      touchState.active = false;
      g.dispose();
      gameRef.current = null;
      setGame(null);
    };
  }, [screen, touch]);

  // bascule automatique si l'utilisateur passe à la souris ou au tactile
  useEffect(() => {
    const toTouch = () => setTouch(true);
    const toMouse = (e: MouseEvent) => { if (e.movementX || e.movementY) setTouch(false); };
    window.addEventListener('touchstart', toTouch, { once: true });
    window.addEventListener('mousemove', toMouse);
    return () => {
      window.removeEventListener('touchstart', toTouch);
      window.removeEventListener('mousemove', toMouse);
    };
  }, []);

  const quitToMenu = useCallback(() => {
    document.exitPointerLock?.();
    setScreen('menu');
    store.set({ screen: 'menu', paused: false, buyOpen: false });
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    sfx.setVolume(s.volume);
    store.set({ settings: s });
    gameRef.current?.applySettings(s);
  }, []);

  return (
    <div className="w-full h-full relative" style={{ background: '#0f1923' }}>
      {screen === 'menu' ? (
        <>
          <MainMenu settings={settings} onPlay={() => setScreen('game')} onSettings={updateSettings}
            onOnline={() => setOnlineOpen(true)} onShop={() => setShopOpen(true)} profile={profile} />
          {shopOpen && (
            <Shop profile={profile} setProfile={setProfile} onClose={() => setShopOpen(false)} />
          )}
          {onlineOpen && netRef.current && (
            <Online net={netRef.current} onClose={() => setOnlineOpen(false)}
              onStart={() => { setOnlineOpen(false); setScreen('game'); }} />
          )}
        </>
      ) : (
        <>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
          <HUD game={game} onQuit={quitToMenu} touch={touch} />
          {touch && (
            <TouchControls sensitivity={settings.sensitivity} pad={settings.pad}
              padScale={settings.padScale} padOpacity={settings.padOpacity}
              onCommand={(c) => gameRef.current?.touchCommand(c)} />
          )}
        </>
      )}
    </div>
  );
}
