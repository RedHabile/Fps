// ─────────────────────────────────────────────────────────────
//  VALENCE — Multijoueur en ligne (WebRTC pair-à-pair, PeerJS)
//  Un salon = un code à 4 chiffres. L'hôte fait autorité sur la
//  manche, le Spike et les bots ; chaque joueur simule son propre
//  déplacement et le diffuse.
// ─────────────────────────────────────────────────────────────
import Peer, { type DataConnection } from 'peerjs';

/** préfixe applicatif : le serveur public PeerJS a un espace de noms partagé */
const NS = 'valence9x-';
export const CODE_LEN = 4;

export type NetRole = 'host' | 'guest';
export type NetStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error';

/** position/état diffusés par chaque joueur, ~15 fois par seconde */
export interface PlayerState {
  id: string;
  name: string;
  x: number; z: number; y: number;
  yaw: number; pitch: number;
  hp: number;
  alive: boolean;
  firing: boolean;
  weapon: string;
  team: 'attack' | 'defense';
  kills: number;
  deaths: number;
}

/** instantané de la partie, diffusé par l'hôte */
export interface WorldSnapshot {
  phase: string;
  round: number;
  timer: number;
  score: [number, number];
  spike: string;
  spikeTimer: number;
  spikePos: { x: number; z: number } | null;
  mapId: string;
  side: 'attack' | 'defense';
  bots: { i: number; x: number; z: number; yaw: number; alive: boolean }[];
}

type Msg =
  | { t: 'hello'; name: string }
  | { t: 'welcome'; id: string; mapId: string; roster: { id: string; name: string }[] }
  | { t: 'state'; s: PlayerState }
  | { t: 'world'; w: WorldSnapshot }
  | { t: 'shot'; from: string; x: number; y: number; z: number; tx: number; ty: number; tz: number }
  | { t: 'hit'; from: string; target: string; dmg: number; head: boolean }
  | { t: 'chat'; from: string; text: string }
  | { t: 'leave'; id: string };

export interface NetEvents {
  onStatus: (s: NetStatus, info?: string) => void;
  onRoster: (players: { id: string; name: string }[]) => void;
  onPlayerState: (s: PlayerState) => void;
  onWorld: (w: WorldSnapshot) => void;
  onShot: (m: { from: string; x: number; y: number; z: number; tx: number; ty: number; tz: number }) => void;
  onHit: (m: { from: string; target: string; dmg: number; head: boolean }) => void;
  onLeave: (id: string) => void;
}

export class Net {
  private peer: Peer | null = null;
  private conns = new Map<string, DataConnection>();
  role: NetRole = 'host';
  status: NetStatus = 'idle';
  code = '';
  myId = '';
  myName = 'AGENT';
  roster: { id: string; name: string }[] = [];
  ev: NetEvents;
  private sendAcc = 0;

  constructor(ev: NetEvents) { this.ev = ev; }

  get connected() { return this.status === 'connected'; }
  get peerCount() { return this.conns.size; }
  get isHost() { return this.role === 'host'; }

  private setStatus(s: NetStatus, info?: string) {
    this.status = s;
    this.ev.onStatus(s, info);
  }

  /** génère un code à 4 chiffres */
  static newCode(): string {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ══════════ HÉBERGER ══════════
  host(code: string, name: string) {
    this.close();
    this.role = 'host';
    this.code = code;
    this.myName = name;
    this.myId = 'H';
    this.setStatus('hosting', code);

    const p = new Peer(NS + code, { debug: 0 });
    this.peer = p;

    p.on('open', () => {
      this.roster = [{ id: 'H', name }];
      this.ev.onRoster(this.roster);
      this.setStatus('connected', code);
    });

    p.on('connection', (c) => {
      c.on('open', () => {
        const gid = 'G' + (this.conns.size + 1);
        this.conns.set(gid, c);
        (c as DataConnection & { _vid?: string })._vid = gid;
        c.send({ t: 'welcome', id: gid, mapId: '', roster: this.roster } as Msg);
      });
      c.on('data', (d) => this.handle(d as Msg, c));
      c.on('close', () => this.dropConn(c));
      c.on('error', () => this.dropConn(c));
    });

    p.on('error', (e) => {
      const msg = String(e?.message ?? e);
      if (msg.includes('is taken') || msg.includes('unavailable')) {
        this.setStatus('error', 'Ce code est déjà utilisé — essayez-en un autre');
      } else if (msg.includes('Lost connection') || msg.includes('network')) {
        this.setStatus('error', 'Connexion au serveur impossible');
      } else {
        this.setStatus('error', msg.slice(0, 80));
      }
    });
  }

  // ══════════ REJOINDRE ══════════
  join(code: string, name: string) {
    this.close();
    this.role = 'guest';
    this.code = code;
    this.myName = name;
    this.setStatus('joining', code);

    const p = new Peer({ debug: 0 });
    this.peer = p;
    let settled = false;

    p.on('open', () => {
      const c = p.connect(NS + code, { reliable: false });
      const timer = setTimeout(() => {
        if (!settled) this.setStatus('error', `Aucun salon trouvé avec le code ${code}`);
      }, 9000);

      c.on('open', () => {
        settled = true;
        clearTimeout(timer);
        this.conns.set('H', c);
        c.send({ t: 'hello', name } as Msg);
        this.setStatus('connected', code);
      });
      c.on('data', (d) => this.handle(d as Msg, c));
      c.on('close', () => { this.setStatus('error', 'Hôte déconnecté'); this.conns.clear(); });
      c.on('error', () => {
        if (!settled) { clearTimeout(timer); this.setStatus('error', `Salon ${code} introuvable`); }
      });
    });

    p.on('error', (e) => {
      const msg = String(e?.message ?? e);
      if (!settled) {
        this.setStatus('error', msg.includes('peer-unavailable')
          ? `Aucun salon avec le code ${code}`
          : 'Connexion au serveur impossible');
      }
    });
  }

  private dropConn(c: DataConnection) {
    const id = (c as DataConnection & { _vid?: string })._vid;
    for (const [k, v] of this.conns) if (v === c) this.conns.delete(k);
    if (id) {
      this.roster = this.roster.filter((r) => r.id !== id);
      this.ev.onRoster(this.roster);
      this.ev.onLeave(id);
      this.broadcast({ t: 'leave', id });
    }
  }

  private handle(m: Msg, from: DataConnection) {
    switch (m.t) {
      case 'hello': {
        const id = (from as DataConnection & { _vid?: string })._vid ?? 'G?';
        this.roster = [...this.roster.filter((r) => r.id !== id), { id, name: m.name }];
        this.ev.onRoster(this.roster);
        this.broadcast({ t: 'welcome', id, mapId: '', roster: this.roster });
        break;
      }
      case 'welcome':
        if (!this.isHost) { this.myId = m.id; this.roster = m.roster; this.ev.onRoster(m.roster); }
        else { this.roster = m.roster; this.ev.onRoster(m.roster); }
        break;
      case 'state':
        this.ev.onPlayerState(m.s);
        if (this.isHost) this.relay(m, from);   // l'hôte répercute aux autres
        break;
      case 'world': if (!this.isHost) this.ev.onWorld(m.w); break;
      case 'shot': this.ev.onShot(m); if (this.isHost) this.relay(m, from); break;
      case 'hit': this.ev.onHit(m); if (this.isHost) this.relay(m, from); break;
      case 'leave': this.ev.onLeave(m.id); break;
    }
  }

  private relay(m: Msg, except: DataConnection) {
    for (const c of this.conns.values()) if (c !== except && c.open) { try { c.send(m); } catch { /* ignore */ } }
  }

  broadcast(m: Msg) {
    for (const c of this.conns.values()) if (c.open) { try { c.send(m); } catch { /* ignore */ } }
  }

  /** diffuse l'état local (limité à ~15 Hz) */
  sendState(dt: number, s: PlayerState) {
    if (!this.connected) return;
    this.sendAcc += dt;
    if (this.sendAcc < 1 / 15) return;
    this.sendAcc = 0;
    this.broadcast({ t: 'state', s });
  }

  sendWorld(w: WorldSnapshot) {
    if (this.isHost && this.connected) this.broadcast({ t: 'world', w });
  }

  sendShot(x: number, y: number, z: number, tx: number, ty: number, tz: number) {
    if (this.connected) this.broadcast({ t: 'shot', from: this.myId, x, y, z, tx, ty, tz });
  }

  sendHit(target: string, dmg: number, head: boolean) {
    if (this.connected) this.broadcast({ t: 'hit', from: this.myId, target, dmg, head });
  }

  close() {
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ignore */ } }
    this.conns.clear();
    try { this.peer?.destroy(); } catch { /* ignore */ }
    this.peer = null;
    this.roster = [];
    if (this.status !== 'idle') this.setStatus('idle');
  }
}
