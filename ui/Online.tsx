// ─────────────────────────────────────────────────────────────
//  VALENCE — Salon en ligne : créer / rejoindre avec un code 4 chiffres
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Net, type NetStatus } from '../game/net';
import { sfx } from '../game/audio';
import {
  X, Wifi, Users, Copy, Check, LogIn, Plus, Play, Loader2, AlertTriangle, Crown,
} from 'lucide-react';

type Tab = 'menu' | 'create' | 'join';

export default function Online({ net, onClose, onStart }: {
  net: Net;
  onClose: () => void;
  onStart: () => void;
}) {
  const [tab, setTab] = useState<Tab>('menu');
  const [code, setCode] = useState('');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [name, setName] = useState(() => localStorage.getItem('valence-name') || 'AGENT');
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [info, setInfo] = useState('');
  const [roster, setRoster] = useState(net.roster);
  const [copied, setCopied] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // branchement des retours réseau
  useEffect(() => {
    const prevStatus = net['ev'].onStatus;
    const prevRoster = net['ev'].onRoster;
    net['ev'].onStatus = (s, i) => { setStatus(s); setInfo(i ?? ''); prevStatus?.(s, i); };
    net['ev'].onRoster = (r) => { setRoster([...r]); prevRoster?.(r); };
    return () => { net['ev'].onStatus = prevStatus; net['ev'].onRoster = prevRoster; };
  }, [net]);

  useEffect(() => { localStorage.setItem('valence-name', name); }, [name]);

  const createLobby = () => {
    sfx.uiClick();
    const c = Net.newCode();
    setCode(c);
    setTab('create');
    net.host(c, name.trim().toUpperCase() || 'AGENT');
  };

  const joinLobby = () => {
    const c = digits.join('');
    if (c.length !== 4) return;
    sfx.uiClick();
    setCode(c);
    net.join(c, name.trim().toUpperCase() || 'AGENT');
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 3) inputs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'Enter') joinLobby();
  };

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => { /* ignore */ });
  };

  const back = () => { sfx.uiClick(); net.close(); setTab('menu'); setDigits(['', '', '', '']); setInfo(''); };

  const connected = status === 'connected';
  const busy = status === 'hosting' || status === 'joining';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(4,8,12,.88)', backdropFilter: 'blur(10px)' }}>
      <div className="anim-reveal clip-card w-[560px] max-w-[96vw] flex flex-col"
        style={{ maxHeight: '94vh', background: 'rgba(12,20,29,.98)', border: '1px solid rgba(255,70,85,.4)' }}>

        {/* en-tête */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,.09)' }}>
          <div className="flex items-center gap-3">
            <Wifi size={20} className="text-[#ff4655]" />
            <div>
              <div className="font-display font-bold text-xl tracking-[.18em] text-[#ece8e1]">PARTIE EN LIGNE</div>
              <div className="font-display text-[10px] tracking-[.2em] text-white/40">CONNEXION DIRECTE ENTRE JOUEURS</div>
            </div>
          </div>
          <button onClick={() => { net.close(); onClose(); }} className="text-white/45 hover:text-[#ff4655] transition-colors"><X size={22} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {/* pseudo */}
          <label className="block mb-5">
            <span className="font-display text-[11px] font-bold tracking-[.25em] text-white/50">VOTRE PSEUDO</span>
            <input value={name} maxLength={12} disabled={connected || busy}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="w-full mt-1.5 px-3 py-2.5 font-display font-bold tracking-[.18em] text-[#ece8e1] outline-none"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.16)' }} />
          </label>

          {/* ── choix ── */}
          {tab === 'menu' && (
            <div className="space-y-3">
              <button onClick={createLobby} onMouseEnter={() => sfx.uiHover()}
                className="w-full clip-card p-4 flex items-center gap-4 text-left transition-all group"
                style={{ background: 'rgba(255,70,85,.14)', border: '1px solid rgba(255,70,85,.45)' }}>
                <Plus size={26} className="text-[#ff4655] shrink-0" />
                <span>
                  <span className="block font-display font-bold text-lg tracking-[.14em] text-[#ece8e1]">CRÉER UN SALON</span>
                  <span className="block font-display text-[11px] tracking-wide text-white/45">Un code à 4 chiffres sera généré pour vos amis</span>
                </span>
              </button>
              <button onClick={() => { sfx.uiClick(); setTab('join'); setTimeout(() => inputs.current[0]?.focus(), 60); }}
                onMouseEnter={() => sfx.uiHover()}
                className="w-full clip-card p-4 flex items-center gap-4 text-left transition-all"
                style={{ background: 'rgba(77,243,211,.1)', border: '1px solid rgba(77,243,211,.35)' }}>
                <LogIn size={26} className="text-[#4df3d3] shrink-0" />
                <span>
                  <span className="block font-display font-bold text-lg tracking-[.14em] text-[#ece8e1]">REJOINDRE UN SALON</span>
                  <span className="block font-display text-[11px] tracking-wide text-white/45">Saisissez le code à 4 chiffres reçu</span>
                </span>
              </button>
              <div className="clip-card p-3 mt-4" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)' }}>
                <div className="font-display text-[10px] font-bold tracking-[.25em] text-white/45 mb-1.5">COMMENT ÇA MARCHE</div>
                <div className="font-display text-[11px] leading-relaxed text-white/50">
                  La partie se joue en connexion directe entre navigateurs. L'hôte gère la manche, le Spike
                  et les bots ; chacun voit les autres joueurs en temps réel. Jusqu'à 5 joueurs par salon.
                </div>
              </div>
            </div>
          )}

          {/* ── saisie du code ── */}
          {tab === 'join' && !connected && (
            <div>
              <div className="font-display text-[11px] font-bold tracking-[.25em] text-white/50 mb-2">CODE DU SALON</div>
              <div className="flex gap-2.5 justify-center my-4">
                {digits.map((d, i) => (
                  <input key={i} ref={(el) => { inputs.current[i] = el; }}
                    value={d} inputMode="numeric" maxLength={1} disabled={busy}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKey(i, e)}
                    className="w-16 h-20 text-center font-display font-bold text-4xl text-[#4df3d3] outline-none transition-all"
                    style={{
                      background: 'rgba(77,243,211,.07)',
                      border: `2px solid ${d ? '#4df3d3' : 'rgba(255,255,255,.18)'}`,
                    }} />
                ))}
              </div>
              <button onClick={joinLobby} disabled={digits.join('').length !== 4 || busy}
                className="vbtn vbtn-red clip-btn w-full py-3.5 text-base flex items-center justify-center gap-2"
                style={{ opacity: digits.join('').length === 4 && !busy ? 1 : 0.4 }}>
                {busy ? <><Loader2 size={17} className="animate-spin" /> CONNEXION…</> : <><LogIn size={17} /> REJOINDRE</>}
              </button>
              <button onClick={back} className="vbtn vbtn-ghost clip-btn w-full py-2.5 mt-2.5 text-xs">RETOUR</button>
            </div>
          )}

          {/* ── salon créé / rejoint ── */}
          {(tab === 'create' || connected) && (
            <div>
              {net.isHost && (
                <div className="clip-card p-4 mb-4 text-center" style={{ background: 'rgba(255,70,85,.1)', border: '1px solid rgba(255,70,85,.4)' }}>
                  <div className="font-display text-[11px] font-bold tracking-[.3em] text-white/50 mb-1">CODE À PARTAGER</div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-display font-bold text-6xl tracking-[.25em] text-[#ff4655]"
                      style={{ textShadow: '0 0 30px rgba(255,70,85,.5)' }}>{code}</span>
                    <button onClick={copy} onMouseEnter={() => sfx.uiHover()}
                      className="p-2.5 transition-colors clip-btn"
                      style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)' }}>
                      {copied ? <Check size={18} className="text-[#4df3d3]" /> : <Copy size={18} className="text-white/60" />}
                    </button>
                  </div>
                  <div className="font-display text-[10px] tracking-[.2em] text-white/35 mt-1.5">
                    {copied ? 'COPIÉ !' : 'DONNEZ CE CODE À VOS AMIS'}
                  </div>
                </div>
              )}

              {/* état */}
              <div className="flex items-center gap-2 mb-3 px-3 py-2 clip-tag"
                style={{
                  background: connected ? 'rgba(77,243,211,.1)' : status === 'error' ? 'rgba(255,70,85,.12)' : 'rgba(255,255,255,.05)',
                  border: `1px solid ${connected ? 'rgba(77,243,211,.4)' : status === 'error' ? 'rgba(255,70,85,.45)' : 'rgba(255,255,255,.14)'}`,
                }}>
                {connected ? <Wifi size={14} className="text-[#4df3d3]" />
                  : status === 'error' ? <AlertTriangle size={14} className="text-[#ff6d7a]" />
                    : <Loader2 size={14} className="text-white/60 animate-spin" />}
                <span className="font-display text-[11px] font-bold tracking-[.16em]"
                  style={{ color: connected ? '#4df3d3' : status === 'error' ? '#ff8a93' : 'rgba(255,255,255,.6)' }}>
                  {connected ? `SALON ${code} ACTIF` : status === 'error' ? info : 'CONNEXION AU SERVEUR…'}
                </span>
              </div>

              {/* liste des joueurs */}
              <div className="flex items-center gap-2 mb-2">
                <Users size={13} className="text-white/45" />
                <span className="font-display text-[10px] font-bold tracking-[.25em] text-white/45">
                  JOUEURS ({roster.length}/5)
                </span>
              </div>
              <div className="space-y-1.5 mb-4">
                {roster.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 clip-tag"
                    style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)' }}>
                    <span className="flex items-center gap-2 font-display font-bold tracking-[.14em] text-[#ece8e1]">
                      {p.id === 'H' && <Crown size={13} className="text-[#ffd25d]" />}
                      {p.name}
                      {p.id === net.myId && <span className="text-[10px] text-white/35">(vous)</span>}
                    </span>
                    <span className="font-display text-[10px] tracking-widest text-[#4df3d3]">CONNECTÉ</span>
                  </div>
                ))}
                {roster.length < 2 && connected && (
                  <div className="px-3 py-3 text-center font-display text-[11px] tracking-[.16em] text-white/30"
                    style={{ border: '1px dashed rgba(255,255,255,.14)' }}>
                    EN ATTENTE D'AUTRES JOUEURS…
                  </div>
                )}
              </div>

              <button onClick={() => { sfx.uiClick(); onStart(); }} disabled={!connected}
                className="vbtn vbtn-red clip-btn w-full py-3.5 text-base flex items-center justify-center gap-2"
                style={{ opacity: connected ? 1 : 0.4 }}>
                <Play size={17} fill="currentColor" /> LANCER LA PARTIE
              </button>
              <button onClick={back} className="vbtn vbtn-ghost clip-btn w-full py-2.5 mt-2.5 text-xs">
                QUITTER LE SALON
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
