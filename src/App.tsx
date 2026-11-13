import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowRight, Award, Check, CircleHelp, ClipboardList, Copy, Crosshair, LockKeyhole,
  Play, Radio, RotateCcw, Settings2, ShoppingBag, Target, Trophy, UsersRound, Volume2, VolumeX, X,
} from 'lucide-react';
import GameScreen from './game/GameScreen';
import { ACHIEVEMENTS, currentQuests, DIFFICULTIES, formatNumber, isSkinUnlocked, levelForXp, loadProfile, MAPS, MODES, questTimeRemaining, QUESTS, saveProfile, skinUnlockText, SKINS, type Difficulty, type GameMode, type MapId, type MatchResult, type Profile, type Quest, type Skin, type SkinId } from './game/data';
import { randomRoomCode, RoomConnection, type RoomStatus } from './game/network';
import WeaponArt from './game/WeaponArt';
import TouchSettings from './game/TouchSettings';
import { defaultTouchLayout, DEFAULT_TOUCH_SIZES, loadTouchCustom, saveTouchCustom, type TouchControl, type TouchPoint, type TouchSizes } from './game/touchLayout';

type Panel = 'play' | 'arsenal' | 'quests' | 'achievements' | 'scores' | 'room' | 'help' | 'settings';

function BrandMark({ small = false }: { small?: boolean }) {
  return <div className={`brand-lockup ${small ? 'brand-small' : ''}`}>
    <svg className="brand-symbol" viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M4 14V5h9M29 5h9v9M38 28v9h-9M13 37H4v-9" stroke="currentColor" strokeWidth="2" /><path d="M12 28V13h10c4 0 6 2 6 5 0 2-1 3-3 4 2 1 3 2 3 4 0 3-2 5-6 5h-7v-4h6c1 0 2-1 2-2s-1-2-2-2h-6v-4h6c1 0 2 0 2-1s-1-2-2-2h-5v12h-4Z" fill="currentColor" /></svg>
    <span className="brand-words"><strong>BREACH<span>POINT</span></strong><small>TACTICAL OPERATIONS</small></span>
  </div>;
}

function App() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [panel, setPanel] = useState<Panel>('play');
  const [selectedSkin, setSelectedSkin] = useState<SkinId>(profile.equippedSkin);
  const [selectedMap, setSelectedMap] = useState<MapId>('depot');
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [sound, setSound] = useState(true);
  const [room, setRoom] = useState<RoomConnection | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [code, setCode] = useState('');
  const [toast, setToast] = useState('');
  const [touchCustom, setTouchCustom] = useState(loadTouchCustom);
  const [selectedMode, setSelectedMode] = useState<GameMode>('sd');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('normal');
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [questClock, setQuestClock] = useState(() => Date.now());
  const [countdownTarget, setCountdownTarget] = useState<number | null>(null);
  const [countdownClock, setCountdownClock] = useState(() => Date.now());
  const roomRef = useRef<RoomConnection | null>(null);

  useEffect(() => { saveProfile(profile); }, [profile]);
  useEffect(() => { saveTouchCustom(touchCustom); }, [touchCustom]);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => () => { roomRef.current?.destroy(); }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setQuestClock(now);
      setProfile((previous) => {
        const quests = currentQuests(previous.quests, now);
        return quests === previous.quests ? previous : { ...previous, quests };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timeout);
  }, [toast]);

  const beginGame = useCallback(() => {
    setCountdownTarget(null);
    setPanel('play');
    setRunId((value) => value + 1);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!room) return;
    return room.subscribe((message) => {
      if (room.status.role !== 'guest') return;
      if (message.type === 'room-settings' || message.type === 'start') {
        if (MAPS.some((map) => map.id === message.mapId)) setSelectedMap(message.mapId as MapId);
        if (message.gameMode === 'sd' || message.gameMode === 'tdm') setSelectedMode(message.gameMode);
        if (message.difficulty === 'easy' || message.difficulty === 'normal' || message.difficulty === 'hard') setSelectedDifficulty(message.difficulty);
        if (message.type === 'start') {
          if (message.lateJoin === true) beginGame();
          else if (typeof message.startAt === 'number') setCountdownTarget(message.startAt);
        }
      }
    });
  }, [room, beginGame]);

  useEffect(() => {
    if (room?.status.role === 'host' && !room.status.inMatch) {
      room.setRoomSettings(selectedMap, selectedMode, selectedDifficulty);
    }
  }, [room, selectedMap, selectedMode, selectedDifficulty]);

  // Both players render against the same host-owned deadline. Recomputing from
  // the deadline (rather than decrementing a counter) prevents drift and catches
  // up immediately after a throttled or backgrounded browser tab.
  useEffect(() => {
    if (countdownTarget === null) return;
    let frame = 0;
    const tick = () => {
      const now = room?.getHostNow() ?? Date.now();
      setCountdownClock(now);
      if (now >= countdownTarget) {
        setCountdownTarget(null);
        beginGame();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [countdownTarget, room, beginGame]);

  const closeRoom = () => {
    roomRef.current?.destroy();
    roomRef.current = null;
    setRoom(null);
    setRoomStatus(null);
  };

  const startSolo = () => {
    closeRoom();
    beginGame();
  };

  const createRoom = () => {
    closeRoom();
    const nextRoom = new RoomConnection('host', randomRoomCode(), setRoomStatus);
    roomRef.current = nextRoom;
    setRoom(nextRoom);
  };

  const joinRoom = () => {
    if (!/^\d{4}$/.test(code)) {
      setToast('ENTREZ UN CODE \u00c0 4 CHIFFRES');
      return;
    }
    closeRoom();
    const nextRoom = new RoomConnection('guest', code, setRoomStatus);
    roomRef.current = nextRoom;
    setRoom(nextRoom);
  };

  const copyRoomCode = async () => {
    if (!roomStatus) return;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(roomStatus.code);
      else {
        const input = document.createElement('textarea');
        input.value = roomStatus.code;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      setToast('CODE COPI\u00c9');
    } catch {
      setToast('COPIE IMPOSSIBLE / NOTEZ LE CODE');
    }
  };

  const startRoom = () => {
    const startAt = room?.startMatch(selectedMap, selectedMode, selectedDifficulty);
    if (typeof startAt === 'number') setCountdownTarget(startAt);
  };

  const exitGame = useCallback(() => {
    roomRef.current?.destroy();
    roomRef.current = null;
    setRoom(null);
    setRoomStatus(null);
    setRunning(false);
    setPanel('play');
  }, []);

  const restartGame = useCallback(() => setRunId((value) => value + 1), []);
  const closeSettings = useCallback(() => setPanel('play'), []);
  const moveTouchControl = useCallback((control: TouchControl, point: TouchPoint) => {
    setTouchCustom((previous) => {
      const base = previous ?? { positions: defaultTouchLayout(window.innerWidth, window.innerHeight), sizes: { ...DEFAULT_TOUCH_SIZES } };
      return { ...base, positions: { ...base.positions, [control]: point } };
    });
  }, []);

  const sizeTouchControl = useCallback((control: TouchControl, size: number) => {
    setTouchCustom((previous) => {
      const base = previous ?? { positions: defaultTouchLayout(window.innerWidth, window.innerHeight), sizes: { ...DEFAULT_TOUCH_SIZES } };
      return { ...base, sizes: { ...base.sizes, [control]: size } };
    });
  }, []);

  const recordResult = useCallback((result: MatchResult) => {
    setProfile((previous) => {
      const records = [...previous.records, { points: result.points, kills: result.kills, won: result.won, date: new Date().toLocaleDateString('fr-FR'), mode: result.mode }].sort((x, y) => y.points - x.points).slice(0, 10);
      const quests = currentQuests(previous.quests);
      const roundsWon = result.mode === 'tdm' ? (result.won ? 1 : 0) : result.blueScore;
      const matches = previous.matches + 1, wins = previous.wins + (result.won ? 1 : 0);
      const totalKills = previous.totalKills + result.kills;
      const hardWins = previous.hardWins + (selectedDifficulty === 'hard' && result.won ? 1 : 0);
      const bestMatchKills = Math.max(previous.bestMatchKills, result.kills);
      const xp = previous.xp + 100 + result.kills * 25 + (result.won ? 150 : 0);
      const level = levelForXp(xp);
      const metrics = { wins, matches, kills: totalKills, hardWins, bestMatchKills, level };
      const achievements = Array.from(new Set([...previous.achievements, ...ACHIEVEMENTS.filter((item) => metrics[item.metric] >= item.target).map((item) => item.id)]));
      const bonusSkins = SKINS.filter((skin) => (skin.unlockLevel !== undefined && level >= skin.unlockLevel) || (skin.achievementId !== undefined && achievements.includes(skin.achievementId))).map((skin) => skin.id);
      const nextQuests = { ...quests, matches: quests.matches + 1, kills: quests.kills + result.kills, rounds: quests.rounds + roundsWon, wins: quests.wins + (result.won ? 1 : 0), points: quests.points + result.points, hardWins: quests.hardWins + (selectedDifficulty === 'hard' && result.won ? 1 : 0) };
      return { ...previous, credits: previous.credits + result.credits, records, matches, wins, xp, totalKills, hardWins, bestMatchKills, achievements, ownedSkins: Array.from(new Set([...previous.ownedSkins, ...bonusSkins])), quests: nextQuests };
    });
  }, [selectedDifficulty]);

  const chooseSkin = (skin: Skin) => {
    if (profile.ownedSkins.includes(skin.id)) {
      setProfile((previous) => ({ ...previous, equippedSkin: skin.id }));
      setToast(`${skin.name} ÉQUIPÉ`);
    } else if (isSkinUnlocked(skin, profile)) {
      setProfile((previous) => ({ ...previous, ownedSkins: [...previous.ownedSkins, skin.id], equippedSkin: skin.id }));
      setToast(`${skin.name} DÉVERROUILLÉ`);
    } else if (skin.unlockLevel || skin.achievementId) {
      setToast(`VERROUILLÉ : ${skinUnlockText(skin)}`);
    } else if (profile.credits >= skin.price) {
      setProfile((previous) => ({ ...previous, credits: previous.credits - skin.price, ownedSkins: [...previous.ownedSkins, skin.id], equippedSkin: skin.id }));
      setToast(`${skin.name} DÉVERROUILLÉ`);
    }
  };

  const openQuests = () => {
    setProfile((previous) => {
      const quests = currentQuests(previous.quests);
      return quests === previous.quests ? previous : { ...previous, quests };
    });
    setPanel('quests');
  };

  const claimQuest = (quest: Quest) => {
    const quests = currentQuests(profile.quests);
    if (quests.claimed.includes(quest.id) || quests[quest.id] < quest.target) return;
    setProfile((previous) => {
      const current = currentQuests(previous.quests);
      if (current.claimed.includes(quest.id) || current[quest.id] < quest.target) return previous;
      return { ...previous, credits: previous.credits + quest.reward, quests: { ...current, claimed: [...current.claimed, quest.id] } };
    });
    setToast(`R\u00c9COMPENSE R\u00c9CUP\u00c9R\u00c9E +${quest.reward} CR`);
  };

  const equippedSkin = SKINS.find((skin) => skin.id === profile.equippedSkin) ?? SKINS[0];
  const activeSkin = SKINS.find((skin) => skin.id === selectedSkin) ?? SKINS[0];
  const quests = currentQuests(profile.quests);
  const activeQuests = QUESTS.filter((quest) => quests.activeIds.includes(quest.id));
  const claimable = activeQuests.some((quest) => quests[quest.id] >= quest.target && !quests.claimed.includes(quest.id));
  const questRemaining = questTimeRemaining(quests, questClock);
  const questHours = Math.floor(questRemaining / 3600000), questMinutes = Math.floor((questRemaining % 3600000) / 60000), questSeconds = Math.floor((questRemaining % 60000) / 1000);
  const playerLevel = levelForXp(profile.xp), xpProgress = profile.xp % 500;
  const activeMap = MAPS.find((map) => map.id === selectedMap) ?? MAPS[0];
  const touchLayout = touchCustom?.positions ?? defaultTouchLayout(viewport.width, viewport.height);
  const touchSizes: TouchSizes = touchCustom?.sizes ?? { ...DEFAULT_TOUCH_SIZES };
  const settingsPanel = panel === 'settings' ? <TouchSettings layout={touchLayout} sizes={touchSizes} viewport={viewport} onMove={moveTouchControl} onSize={sizeTouchControl} onReset={() => setTouchCustom(null)} onClose={closeSettings} /> : null;

  if (running) return <><GameScreen key={runId} skin={equippedSkin} mapId={selectedMap} mode={selectedMode} difficulty={selectedDifficulty} room={room} sound={sound} touchLayout={touchLayout} touchSizes={touchSizes} viewport={viewport} onSettings={() => setPanel('settings')} onExit={exitGame} onRestart={restartGame} onResult={recordResult} />{settingsPanel}</>;

  return <main className="lobby">
    <div className="lobby-art" />
    <div className="lobby-shade" />
    <div className="lobby-grain" />
    <header className="main-header">
      <button className="logo-button" onClick={() => setPanel('play')} aria-label="Accueil Breach Point"><BrandMark /></button>
      <nav className="main-nav" aria-label="Navigation principale">
        <button className={panel === 'play' ? 'active' : ''} onClick={() => setPanel('play')}>JOUER</button>
        <button className={panel === 'arsenal' ? 'active' : ''} onClick={() => { setSelectedSkin(profile.equippedSkin); setPanel('arsenal'); }}>BOUTIQUE</button>
        <button className={panel === 'quests' ? 'active' : ''} onClick={openQuests}>QU&Ecirc;TES{claimable && <i className="nav-notice" />}</button>
        <button className={panel === 'achievements' ? 'active' : ''} onClick={() => setPanel('achievements')}>SUCC&Egrave;S</button>
        <button className={panel === 'scores' ? 'active' : ''} onClick={() => setPanel('scores')}>CLASSEMENT</button>
      </nav>
      <div className="header-right"><div className="season-label"><span>SAISON</span><strong>01</strong></div><div className="header-divider" /><button className="credit-display" onClick={() => { setSelectedSkin(profile.equippedSkin); setPanel('arsenal'); }} title="Ouvrir la boutique de skins"><span className="credit-icon">&#9670;</span><strong>{formatNumber(profile.credits)}</strong><small>CR</small><span className="credit-plus">+</span></button><div className="operator-avatar"><span>BP</span><i /></div></div>
    </header>

    <aside className="side-rail" aria-label="Raccourcis">
      <div className="rail-top">
        <button className={panel === 'play' ? 'active' : ''} onClick={() => setPanel('play')} aria-label="Jouer" title="Jouer"><Crosshair size={20} /></button>
        <button className={panel === 'arsenal' ? 'active' : ''} onClick={() => { setSelectedSkin(profile.equippedSkin); setPanel('arsenal'); }} aria-label="Boutique de skins" title="Boutique de skins"><ShoppingBag size={19} /></button>
        <button className={panel === 'quests' ? 'active' : ''} onClick={openQuests} aria-label="Qu&ecirc;tes" title="Qu&ecirc;tes"><ClipboardList size={19} />{claimable && <i className="rail-notice" />}</button>
        <button className={panel === 'scores' ? 'active' : ''} onClick={() => setPanel('scores')} aria-label="Classement" title="Classement"><Trophy size={19} /></button>
        <button className={panel === 'room' ? 'active' : ''} onClick={() => setPanel('room')} aria-label="Salon priv&eacute;" title="Salon priv&eacute;"><UsersRound size={19} /></button>
      </div>
      <div className="rail-bottom"><button className={panel === 'settings' ? 'active' : ''} onClick={() => setPanel('settings')} aria-label="Param&egrave;tres tactiles" title="Param&egrave;tres tactiles"><Settings2 size={19} /></button><button onClick={() => setSound((value) => !value)} aria-label={sound ? 'Couper le son' : 'Activer le son'} title={sound ? 'Couper le son' : 'Activer le son'}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button><button className={panel === 'help' ? 'active' : ''} onClick={() => setPanel('help')} aria-label="Comment jouer" title="Comment jouer"><CircleHelp size={19} /></button><span className="rail-code">BP / 01</span></div>
    </aside>

    <div className="lobby-content">
      <section className="hero-copy" aria-label="Breach Point Search and Destroy">
        <h1 className="hero-game-title">BREACH<br /><span>POINT</span><i>.</i></h1>
        <div className="mode-picker" role="group" aria-label="Choisir le mode de jeu">{MODES.map((entry) => <button key={entry.id} className={`mode-choice ${selectedMode === entry.id ? 'active' : ''}`} onClick={() => setSelectedMode(entry.id)}><strong>{entry.name}</strong><small>{entry.tagline}</small></button>)}</div>
        <div className="difficulty-picker" role="group" aria-label="Choisir la difficulté"><span>DIFFICULTÉ DE L'IA</span>{DIFFICULTIES.map((entry) => <button key={entry.id} className={selectedDifficulty === entry.id ? 'active' : ''} onClick={() => setSelectedDifficulty(entry.id)}><strong>{entry.name}</strong><small>{entry.tagline}</small></button>)}</div>
        <div className="hero-actions"><button className="primary-button deploy-button" onClick={startSolo}><span className="play-box"><Play size={15} fill="currentColor" /></span><span>LANCER LA PARTIE<small>JOUER CONTRE L'IA</small></span><ArrowRight className="button-arrow" size={20} /></button><button className="secondary-button" onClick={() => setPanel('room')}><UsersRound size={19} /><span>SALON PRIV&Eacute;<small>JOUER AVEC DES AMIS</small></span></button></div>
        <button className="how-link" onClick={() => setPanel('help')}><CircleHelp size={14} /> NOUVEL OP&Eacute;RATEUR ? <span>COMMENT JOUER</span> <ArrowRight size={13} /></button>
      </section>

      <div className="lobby-footer">
        <button className="footer-mission" onClick={() => setSelectedMap((map) => MAPS[(MAPS.findIndex((entry) => entry.id === map) + 1) % MAPS.length].id)} aria-label={`Changer de carte. Carte actuelle : ${activeMap.name}`} title="Changer de carte"><div className="map-thumb"><span>A</span><i /><span>B</span></div><div><small>ZONE D'OP&Eacute;RATION / CHANGER</small><strong>{activeMap.name} <ArrowDownRight size={14} /></strong></div></button>
        <div className="footer-mode"><small>MODE EN VEDETTE</small><strong>{selectedMode === 'sd' ? 'SEARCH & DESTROY' : 'COMBAT EN ÉQUIPE'} <span> / </span> 5 VS 5</strong></div>
        <div className="footer-ready"><span className="status-dot" /> SYST&Egrave;ME OP&Eacute;RATIONNEL <i /> <span>V 1.04</span></div>
      </div>
      <div className="hero-side-note"><span>{String(MAPS.findIndex((map) => map.id === selectedMap) + 1).padStart(2, '0')} / 04</span><i /><span>THE OBJECTIVE IS EVERYTHING</span></div>
    </div>

    {panel !== 'play' && panel !== 'settings' && <div className="panel-backdrop" onClick={() => setPanel('play')}><section className={`menu-panel panel-${panel}`} onClick={(event) => event.stopPropagation()} aria-label={panel === 'arsenal' ? 'Boutique de skins' : panel === 'quests' ? 'Qu\u00eates' : panel === 'achievements' ? 'Succ\u00e8s' : panel === 'scores' ? 'Classement' : panel === 'room' ? 'Salon priv\u00e9' : 'Comment jouer'}>
      <div className="panel-top"><div className="panel-kicker"><span /> BREACH POINT <i>/</i> {panel === 'arsenal' ? 'COLLECTION' : panel === 'quests' ? 'MISSIONS QUOTIDIENNES' : panel === 'achievements' ? 'DISTINCTIONS' : panel === 'scores' ? 'ARCHIVES' : panel === 'room' ? 'ESCOUADE' : 'GUIDE TACTIQUE'}</div><button className="panel-close" onClick={() => setPanel('play')} aria-label="Fermer"><X size={20} /></button></div>
      {panel === 'arsenal' && <>
        <div className="panel-heading"><div><h2>BOUTIQUE<span>.</span></h2><p>38 skins à collectionner. Progressez, réussissez des défis extrêmes ou dépensez vos crédits.</p></div><div className="panel-balance"><small>VOTRE SOLDE</small><strong><span>&#9670;</span> {formatNumber(profile.credits)} <i>CR</i></strong></div></div>
        <div className="profile-progression"><div className="profile-level"><span>NIVEAU OPÉRATEUR</span><strong>{playerLevel}</strong></div><div className="profile-xp"><div><b>{formatNumber(xpProgress)} / 500 XP</b><small>{formatNumber(profile.xp)} XP AU TOTAL</small></div><div className="quest-progress"><i style={{ width: `${xpProgress / 500 * 100}%` }} /></div></div><div className="profile-achievement-count"><strong>{profile.achievements.length}/{ACHIEVEMENTS.length}</strong><small>SUCCÈS</small></div></div>
        <div className="weapon-grid skin-grid">{SKINS.map((skin, index) => { const unlocked = isSkinUnlocked(skin, profile); return <button key={skin.id} className={`weapon-card skin-card ${selectedSkin === skin.id ? 'selected' : ''} ${unlocked ? 'skin-unlocked' : 'skin-locked'}`} onClick={() => setSelectedSkin(skin.id)}><div className="weapon-card-top"><span>{String(index + 1).padStart(2, '0')} / {skin.rarity}</span>{profile.equippedSkin === skin.id ? <b><Check size={12} /> ÉQUIPÉ</b> : profile.ownedSkins.includes(skin.id) ? <b>ACQUIS</b> : unlocked ? <b>DISPONIBLE</b> : <b className="skin-lock-label"><LockKeyhole size={11} /> {skinUnlockText(skin)}</b>}</div><WeaponArt id="viper" skin={skin} /><div className="weapon-card-bottom"><strong>{skin.name}</strong><span>{skin.unlockLevel ? skinUnlockText(skin) : skin.achievementId ? 'SUCCÈS' : skin.price === 0 ? 'INCLUS' : <><i>&#9670;</i> {formatNumber(skin.price)} CR</>}</span></div></button>; })}</div>
        <div className="weapon-detail skin-detail"><div><small>SKIN S&Eacute;LECTIONN&Eacute; / {activeSkin.rarity}</small><h3>{activeSkin.name}</h3><p>{activeSkin.description}</p></div><div className="skin-colors"><span style={{ background: activeSkin.body }} /><span style={{ background: activeSkin.detail }} /><span style={{ background: activeSkin.accent }} /><small>TOUTES LES ARMES</small></div><button className="primary-button purchase-button" disabled={profile.equippedSkin === activeSkin.id || (!isSkinUnlocked(activeSkin, profile) && (!!activeSkin.unlockLevel || !!activeSkin.achievementId || profile.credits < activeSkin.price))} onClick={() => chooseSkin(activeSkin)}>{profile.equippedSkin === activeSkin.id ? <><Check size={17} /> &Eacute;QUIP&Eacute;</> : profile.ownedSkins.includes(activeSkin.id) ? <> &Eacute;QUIPER <ArrowRight size={17} /></> : profile.credits < activeSkin.price ? 'CR\u00c9DITS INSUFFISANTS' : <>ACHETER LE SKIN <ArrowRight size={17} /></>}</button></div>
        <div className="panel-footnote"><span className="status-dot" /> SKINS COSM&Eacute;TIQUES CONSERV&Eacute;S SUR CET APPAREIL / SANS AVANTAGE DE COMBAT</div>
      </>}
      {panel === 'quests' && <>
        <div className="panel-heading"><div><h2>VOS QU&Ecirc;TES<span>.</span></h2><p>Trois missions aléatoires, renouvelées exactement toutes les 24 heures.</p></div><div className="quest-reset"><small>PROCHAIN RENOUVELLEMENT</small><strong>{String(questHours).padStart(2, '0')}:{String(questMinutes).padStart(2, '0')}:{String(questSeconds).padStart(2, '0')}</strong></div></div>
        <div className="quest-list">{activeQuests.map((quest, index) => {
          const progress = Math.min(quests[quest.id], quest.target);
          const claimed = quests.claimed.includes(quest.id);
          const complete = progress >= quest.target;
          return <div className={`quest-row ${complete && !claimed ? 'complete' : ''}`} key={quest.id}><span className="quest-index">0{index + 1}</span><div className="quest-copy"><strong>{quest.name}</strong><p>{quest.description}</p><div className="quest-progress"><i style={{ width: `${progress / quest.target * 100}%` }} /></div></div><div className="quest-count"><strong>{progress}<span> / {quest.target}</span></strong><small>PROGRESSION</small></div><button className="quest-claim" disabled={!complete || claimed} onClick={() => claimQuest(quest)}>{claimed ? <><Check size={14} /> R&Eacute;CUP&Eacute;R&Eacute;</> : complete ? <>R&Eacute;CUP&Eacute;RER <span>+{quest.reward} CR</span></> : <>R&Eacute;COMPENSE <span>+{quest.reward} CR</span></>}</button></div>;
        })}</div>
        <div className="panel-footnote"><span className="status-dot" /> 3 MISSIONS ALÉATOIRES / RENOUVELLEMENT AUTOMATIQUE TOUTES LES 24 HEURES</div>
      </>}
      {panel === 'achievements' && <>
        <div className="panel-heading"><div><h2>SUCCÈS<span>.</span></h2><p>Défis permanents. Certains skins exclusifs ne s'obtiennent qu'en les terminant.</p></div><div className="record-summary"><div><small>DÉBLOQUÉS</small><strong>{profile.achievements.length}/{ACHIEVEMENTS.length}</strong></div><div><small>NIVEAU</small><strong>{playerLevel}</strong></div></div></div>
        <div className="achievement-list">{ACHIEVEMENTS.map((achievement) => {
          const unlocked = profile.achievements.includes(achievement.id);
          const value = achievement.metric === 'wins' ? profile.wins : achievement.metric === 'matches' ? profile.matches : achievement.metric === 'kills' ? profile.totalKills : achievement.metric === 'hardWins' ? profile.hardWins : achievement.metric === 'bestMatchKills' ? profile.bestMatchKills : playerLevel;
          const progress = Math.min(value, achievement.target);
          const rewardSkin = SKINS.find((skin) => skin.achievementId === achievement.id);
          return <div className={`achievement-row \${unlocked ? 'unlocked' : ''}`} key={achievement.id}><div className="achievement-medal"><Award size={22} /></div><div className="achievement-copy"><strong>{achievement.name}</strong><p>{achievement.description}</p><div className="quest-progress"><i style={{ width: `\${progress / achievement.target * 100}%` }} /></div><small>{progress} / {achievement.target}</small></div><div className="achievement-reward"><b>{unlocked ? 'DÉBLOQUÉ' : 'EN COURS'}</b><span>{rewardSkin ? `SKIN \${rewardSkin.name}` : 'DISTINCTION'}</span></div></div>;
        })}</div>
        <div className="panel-footnote"><span className="status-dot" /> SUCCÈS PERMANENTS / SKINS EXCLUSIFS CONSERVÉS SUR CET APPAREIL</div>
      </>}
      {panel === 'scores' && <>
        <div className="panel-heading"><div><h2>VOS ARCHIVES<span>.</span></h2><p>Chaque mission laisse une trace. Voici vos meilleurs r&eacute;sultats.</p></div><div className="record-summary"><div><small>MISSIONS</small><strong>{profile.matches}</strong></div><div><small>VICTOIRES</small><strong>{profile.wins}</strong></div></div></div>
        <div className="score-table"><div className="score-table-head"><span>RANG</span><span>R&Eacute;SULTAT</span><span>&Eacute;LIMINATIONS</span><span>DATE</span><span>POINTS</span></div>        {profile.records.length ? profile.records.map((record, index) => <div className="score-row" key={`${record.date}-${index}`}><strong><i>{String(index + 1).padStart(2, '0')}</i></strong><span className={record.won ? 'win-text' : ''}>{record.won ? 'VICTOIRE' : 'D\u00c9FAITE'} <i className="mode-tag">{record.mode === 'tdm' ? 'TDM' : 'S&D'}</i></span><span>{record.kills}</span><span>{record.date}</span><strong>{formatNumber(record.points)}</strong></div>) : <div className="empty-scores"><Trophy size={31} strokeWidth={1.2} /><strong>AUCUNE MISSION ENREGISTR&Eacute;E</strong><span>Votre l&eacute;gende commence &agrave; votre premi&egrave;re partie.</span><button onClick={startSolo}>LANCER UNE PARTIE <ArrowRight size={15} /></button></div>}</div>
        <div className="panel-footnote"><span className="status-dot" /> CLASSEMENT LOCAL / ENREGISTR&Eacute; SUR CET APPAREIL</div>
      </>}
      {panel === 'room' && <>
        <div className="panel-heading"><div><h2>SALON PRIV&Eacute;<span>.</span></h2><p>Jusqu'&agrave; 10 joueurs. Choisissez votre &eacute;quipe, l'IA occupe les places libres.</p></div><UsersRound className="panel-heading-icon" size={38} strokeWidth={1.1} /></div>
        {!roomStatus ? <div className="room-options"><div className="room-option"><span className="room-number">01 / CR&Eacute;ER</span><h3>FORMER UN SALON</h3><p>Cr&eacute;ez un salon 5 contre 5 et partagez le code &agrave; 4 chiffres.</p><button className="primary-button" onClick={createRoom}>CR&Eacute;ER UN SALON <ArrowRight size={17} /></button></div><div className="room-separator"><span>OU</span></div><div className="room-option"><span className="room-number">02 / REJOINDRE</span><h3>REJOINDRE UNE PARTIE</h3><p>Entrez le code transmis par l'h&ocirc;te, puis choisissez votre &eacute;quipe.</p><div className="join-row"><input aria-label="Code du salon &agrave; 4 chiffres" inputMode="numeric" maxLength={4} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} onKeyDown={(event) => { if (event.key === 'Enter') joinRoom(); }} placeholder="0000" /><button className="secondary-button" onClick={joinRoom}>REJOINDRE <ArrowRight size={16} /></button></div></div></div> : <div className="room-waiting room-lobby">
          <div className="room-code-block"><div><span className="room-number">CODE DU SALON / PARTAGEZ AVEC VOS AMIS</span><div className="room-code">{roomStatus.code.split('').map((digit, index) => <span key={index}>{digit}</span>)}<button aria-label="Copier le code" onClick={copyRoomCode}><Copy size={17} /></button></div><div className={`room-status ${roomStatus.stage}`}><span className="status-dot" /> {roomStatus.message}</div></div><div className="room-map"><small>CARTE DE L'H&Ocirc;TE</small><strong>{roomStatus.role === 'host' ? activeMap.name : "CHOISIE PAR L'H\u00d4TE"}</strong></div></div>
          <div className="room-team-grid">{(['blue', 'red'] as const).map((team) => {
            const members = roomStatus.players.filter((player) => player.team === team);
            const currentTeam = roomStatus.players.find((player) => player.id === roomStatus.selfId)?.team;
            return <div className={`room-team team-${team}`} key={team}><div className="room-team-head"><div><span>{team === 'blue' ? '\u00c9QUIPE BLEUE' : '\u00c9QUIPE ORANGE'}</span><strong>{members.length} / 5 JOUEURS</strong></div><button disabled={!roomStatus.selfId || currentTeam === team || members.length >= 5 || roomStatus.stage === 'error'} onClick={() => room?.requestTeam(team)}>{currentTeam === team ? 'VOTRE \u00c9QUIPE' : 'REJOINDRE'}</button></div><div className="room-seats">{Array.from({ length: 5 }, (_, index) => {
              const id = `p${(team === 'blue' ? 1 : 6) + index}`;
              const player = roomStatus.players.find((entry) => entry.id === id);
              return <div key={id} className={player ? 'human-seat' : ''}><span>{String(index + 1).padStart(2, '0')}</span><strong>{player ? player.id === roomStatus.selfId ? 'VOUS' : player.host ? 'H\u00d4TE' : `JOUEUR ${id.slice(1).padStart(2, '0')}` : 'AGENT IA'}</strong><small>{player ? 'CONNECT\u00c9' : 'PLACE LIBRE'}</small></div>;
            })}</div></div>;
          })}</div>
          <div className="room-mode-row"><small>MODE DE LA PARTIE</small><div className="room-mode-choices">{roomStatus.role === 'host' ? MODES.map((entry) => <button key={entry.id} className={`room-mode-choice ${selectedMode === entry.id ? 'active' : ''}`} onClick={() => setSelectedMode(entry.id)}>{entry.name}</button>) : <strong>{selectedMode === 'sd' ? 'SEARCH & DESTROY' : 'COMBAT EN ÉQUIPE'}</strong>}</div></div>
          <div className="room-mode-row"><small>CARTE DE LA MISSION</small><div className="room-mode-choices">{roomStatus.role === 'host' ? MAPS.map((entry) => <button key={entry.id} className={`room-mode-choice ${selectedMap === entry.id ? 'active' : ''}`} onClick={() => setSelectedMap(entry.id)}>{entry.name}</button>) : <strong>{MAPS.find((entry) => entry.id === selectedMap)?.name ?? MAPS[0].name}</strong>}</div></div>
          <div className="room-mode-row"><small>DIFFICULTÉ DE L'IA</small><div className="room-mode-choices">{roomStatus.role === 'host' ? DIFFICULTIES.map((entry) => <button key={entry.id} className={`room-mode-choice ${selectedDifficulty === entry.id ? 'active' : ''}`} onClick={() => setSelectedDifficulty(entry.id)}>{entry.name}</button>) : <strong>{DIFFICULTIES.find((entry) => entry.id === selectedDifficulty)?.name ?? 'NORMAL'}</strong>}</div></div>
          <div className="room-actions">{roomStatus.role === 'host' && <button className="primary-button" disabled={!['waiting', 'connected'].includes(roomStatus.stage)} onClick={startRoom}>LANCER LA MISSION <ArrowRight size={17} /></button>}{roomStatus.role === 'guest' && roomStatus.stage === 'connected' && <span className="waiting-host">EN ATTENTE DU D&Eacute;PLOIEMENT PAR L'H&Ocirc;TE</span>}<button className="text-button" onClick={closeRoom}><RotateCcw size={15} /> QUITTER LE SALON</button></div>
        </div>}
        <div className="panel-footnote"><Radio size={13} /> CONNEXION DIRECTE ENTRE NAVIGATEURS / INTERNET REQUIS</div>
      </>}
      {panel === 'help' && <>
        <div className="panel-heading"><div><h2>BRIEFING<span>.</span></h2><p>Tout ce qu'il faut savoir avant de vous d&eacute;ployer.</p></div><Target className="panel-heading-icon" size={38} strokeWidth={1.1} /></div>
        <div className="briefing-intro"><span>01 / LA MISSION</span><p>Deux &eacute;quipes de 5, une seule vie par manche. La premi&egrave;re &eacute;quipe &agrave; 10 points avec 2 points d'&eacute;cart gagne. Les c&ocirc;t&eacute;s s'&eacute;changent apr&egrave;s 5 manches. D&egrave;s la 14e manche, la prolongation alterne attaque et d&eacute;fense &agrave; chaque manche. Premi&egrave;re manche aux pistolets ; achetez vos armes et armures pendant 15 secondes. Les survivants gardent leur arsenal : 1 arme de poing + 1 arme principale.</p></div>
        <div className="briefing-intro"><span>02 / COMBAT EN &Eacute;QUIPE</span><p>R&eacute;apparition apr&egrave;s avoir choisi votre arme. 10 minutes, premi&egrave;re &eacute;quipe &agrave; 50 &eacute;liminations. 1 grenade + 1 flash &agrave; chaque apparition.</p></div>
        <div className="controls-grid"><div><span>03 / CLAVIER + SOURIS</span><div className="control-row"><b>Z Q S D / W A S D</b><small>SE D&Eacute;PLACER</small></div><div className="control-row"><b>SOURIS + CLIC</b><small>VISER / TIRER</small></div><div className="control-row"><b>E <i>/</i> R <i>/</i> SHIFT</b><small>INTERAGIR / RECHARGER / COURIR</small></div><div className="control-row"><b>F <i>/</i> G <i>/</i> V</b><small>CHANGER D'ARME / GRENADE / FLASH</small></div><div className="control-row"><b>ESC</b><small>PAUSE</small></div></div><div><span>03 / MOBILE + TACTILE</span><div className="control-row"><b>JOYSTICK GAUCHE</b><small>SE D&Eacute;PLACER</small></div><div className="control-row"><b>GLISSER &Agrave; DROITE</b><small>VISER</small></div><div className="control-row"><b>BOUTONS &Agrave; DROITE</b><small>TIRER / RECHARGER / INTERAGIR</small></div><div className="control-row"><b>PAUSE</b><small>EN HAUT &Agrave; DROITE</small></div></div></div>
        <button className="primary-button briefing-button" onClick={startSolo}><Play size={16} fill="currentColor" /> C'EST PARTI <ArrowRight size={17} /></button>
      </>}
    </section></div>}
    {settingsPanel}
    {countdownTarget !== null && <div role="status" aria-live="assertive" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', background: 'rgba(3, 8, 13, 0.94)', color: '#f4f7f8', textAlign: 'center', fontFamily: 'inherit' }}><div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}><span style={{ color: '#72d9d0', fontSize: 12, letterSpacing: '0.28em', fontWeight: 800 }}>BREACH POINT / DÉPLOIEMENT</span><strong style={{ fontSize: 'clamp(110px, 24vw, 220px)', lineHeight: 0.9, fontWeight: 900, fontVariantNumeric: 'tabular-nums', textShadow: '0 0 42px rgba(74, 218, 204, 0.28)' }}>{Math.max(1, Math.ceil((countdownTarget - countdownClock) / 1000))}</strong><span style={{ color: '#aab9c2', fontSize: 13, letterSpacing: '0.22em' }}>PRÉPAREZ-VOUS</span></div></div>}
    {toast && <div className="toast"><Check size={15} /> {toast}</div>}
  </main>;
}

export default App;