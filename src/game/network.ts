import Peer, { type DataConnection } from 'peerjs';
import { type GameMode, type MapId, type Team } from './data';

export type RoomRole = 'host' | 'guest';
export type RoomStage = 'connecting' | 'waiting' | 'connected' | 'error';

export interface RoomPlayer {
  id: string;
  team: Team;
  host: boolean;
}

export interface RoomStatus {
  code: string;
  role: RoomRole;
  stage: RoomStage;
  message: string;
  selfId: string;
  players: RoomPlayer[];
  inMatch: boolean;
}

export interface NetworkMessage {
  type: string;
  [key: string]: unknown;
}

const peerId = (code: string) => `breachpoint-s03-${code}`;
export const teamForSeat = (id: string): Team => Number(id.slice(1)) <= 5 ? 'blue' : 'red';

function freeSeat(team: Team, players: RoomPlayer[]) {
  const start = team === 'blue' ? 1 : 6;
  for (let number = start; number < start + 5; number++) {
    const id = `p${number}`;
    if (!players.some((player) => player.id === id)) return id;
  }
  return null;
}

/** The host owns the simulation and relays snapshots to up to nine peers. */
export class RoomConnection {
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private connections = new Map<DataConnection, string>();
  private listeners = new Set<(message: NetworkMessage) => void>();
  private statusListener: (status: RoomStatus) => void;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  status: RoomStatus;

  constructor(role: RoomRole, code: string, onStatus: (status: RoomStatus) => void) {
    this.statusListener = onStatus;
    this.status = {
      role, code, stage: 'connecting', message: 'Connexion au service de salon...', inMatch: false,
      selfId: role === 'host' ? 'p1' : '', players: role === 'host' ? [{ id: 'p1', team: 'blue', host: true }] : [],
    };
    this.open();
  }

  private update(patch: Partial<RoomStatus>) {
    if (this.closed) return;
    this.status = { ...this.status, ...patch };
    this.statusListener(this.status);
  }

  private open() {
    this.statusListener(this.status);
    this.peer = this.status.role === 'host' ? new Peer(peerId(this.status.code)) : new Peer();
    this.timeout = setTimeout(() => {
      if (this.status.stage === 'connecting') this.update({ stage: 'error', message: 'Connexion impossible. V\u00e9rifiez votre r\u00e9seau et r\u00e9essayez.' });
    }, 15000);
    this.peer.on('open', () => {
      if (this.closed || !this.peer) return;
      if (this.status.role === 'host') {
        this.update({ stage: 'waiting', message: 'Salon cr\u00e9\u00e9. Invitez jusqu\u2019\u00e0 9 joueurs.' });
      } else {
        this.attachGuest(this.peer.connect(peerId(this.status.code), { reliable: true }));
      }
    });
    this.peer.on('connection', (connection) => this.attachHost(connection));
    this.peer.on('error', (error) => {
      const message = error.type === 'unavailable-id'
        ? 'Ce code est d\u00e9j\u00e0 utilis\u00e9. Cr\u00e9ez un nouveau salon.'
        : error.type === 'peer-unavailable'
          ? 'Salon introuvable. V\u00e9rifiez le code \u00e0 4 chiffres.'
          : 'Connexion interrompue. V\u00e9rifiez votre r\u00e9seau.';
      this.update({ stage: 'error', message });
    });
    this.peer.on('disconnected', () => {
      if (!this.hostConnection?.open && !this.connections.size) this.update({ stage: 'error', message: 'Le service de salon est indisponible.' });
    });
  }

  private attachHost(connection: DataConnection) {
    connection.on('open', () => {
      if (this.closed) return;
      if (this.status.inMatch || this.status.players.length >= 10) {
        connection.send({ type: 'rejected', reason: this.status.inMatch ? 'La partie a d\u00e9j\u00e0 commenc\u00e9.' : 'Ce salon est complet.' });
        setTimeout(() => connection.close(), 250);
        return;
      }
      const blue = this.status.players.filter((player) => player.team === 'blue').length;
      const red = this.status.players.filter((player) => player.team === 'red').length;
      const preferred: Team = blue <= red ? 'blue' : 'red';
      const id = freeSeat(preferred, this.status.players) ?? freeSeat(preferred === 'blue' ? 'red' : 'blue', this.status.players);
      if (!id) { connection.close(); return; }
      this.connections.set(connection, id);
      this.status = { ...this.status, players: [...this.status.players, { id, team: teamForSeat(id), host: false }] };
      this.publishRoster();
    });
    connection.on('data', (data) => {
      if (!data || typeof data !== 'object' || !('type' in data)) return;
      const id = this.connections.get(connection);
      if (!id) return;
      const message = data as NetworkMessage;
      if (message.type === 'team-request' && (message.team === 'blue' || message.team === 'red')) {
        this.movePlayer(id, message.team);
      } else this.listeners.forEach((listener) => listener({ ...message, from: id }));
    });
    connection.on('close', () => {
      const id = this.connections.get(connection);
      if (!id) return;
      this.connections.delete(connection);
      this.status = { ...this.status, players: this.status.players.filter((player) => player.id !== id) };
      this.publishRoster();
      if (this.status.inMatch) this.listeners.forEach((listener) => listener({ type: 'peer-left', from: id }));
    });
    connection.on('error', () => connection.close());
  }

  private attachGuest(connection: DataConnection) {
    this.hostConnection = connection;
    connection.on('data', (data) => {
      if (!data || typeof data !== 'object' || !('type' in data)) return;
      const message = data as NetworkMessage;
      if (message.type === 'roster' && Array.isArray(message.players) && typeof message.selfId === 'string') {
        if (this.timeout) clearTimeout(this.timeout);
        this.update({ stage: 'connected', selfId: message.selfId, players: message.players as RoomPlayer[], message: 'Connect\u00e9 au salon. Choisissez votre \u00e9quipe.' });
      } else if (message.type === 'notice' && typeof message.reason === 'string') {
        this.update({ message: message.reason });
      } else if (message.type === 'rejected') {
        this.update({ stage: 'error', message: typeof message.reason === 'string' ? message.reason : 'Salon indisponible.' });
      } else {
        if (message.type === 'start') this.update({ inMatch: true });
        this.listeners.forEach((listener) => listener(message));
      }
    });
    connection.on('close', () => {
      this.hostConnection = null;
      if (this.status.stage !== 'error') this.update({ stage: 'error', message: 'L\u2019h\u00f4te a quitt\u00e9 le salon.' });
      this.listeners.forEach((listener) => listener({ type: 'host-left' }));
    });
    connection.on('error', () => this.update({ stage: 'error', message: 'La connexion \u00e0 l\u2019h\u00f4te a \u00e9t\u00e9 interrompue.' }));
  }

  private publishRoster() {
    const players = [...this.status.players].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const count = players.length;
    this.update({ players, stage: count > 1 ? 'connected' : 'waiting', message: `${count} / 10 joueurs connect\u00e9s. Les places libres sont occup\u00e9es par l\u2019IA.` });
    this.connections.forEach((id, connection) => {
      if (connection.open) connection.send({ type: 'roster', players, selfId: id });
    });
  }

  private movePlayer(id: string, team: Team) {
    if (this.status.inMatch) return;
    const player = this.status.players.find((entry) => entry.id === id);
    if (!player || player.team === team) return;
    const nextId = freeSeat(team, this.status.players);
    if (!nextId) {
      if (player.host) this.update({ message: 'Cette \u00e9quipe est compl\u00e8te.' });
      else this.sendTo(id, { type: 'notice', reason: 'Cette \u00e9quipe est compl\u00e8te.' });
      return;
    }
    const players = this.status.players.map((entry) => entry.id === id ? { ...entry, id: nextId, team } : entry);
    this.connections.forEach((seat, connection) => { if (seat === id) this.connections.set(connection, nextId); });
    this.status = { ...this.status, players, selfId: player.host ? nextId : this.status.selfId };
    this.publishRoster();
  }

  requestTeam(team: Team) {
    if (this.status.inMatch || !this.status.selfId) return;
    if (this.status.role === 'host') this.movePlayer(this.status.selfId, team);
    else this.send({ type: 'team-request', team });
  }

  startMatch(mapId: MapId, gameMode: GameMode = 'sd') {
    if (this.status.role !== 'host' || !['waiting', 'connected'].includes(this.status.stage)) return false;
    this.update({ inMatch: true });
    this.send({ type: 'start', mapId, gameMode });
    return true;
  }

  send(message: NetworkMessage) {
    if (this.status.role === 'host') {
      this.connections.forEach((_id, connection) => { if (connection.open) connection.send(message); });
    } else if (this.hostConnection?.open) this.hostConnection.send(message);
  }

  sendTo(id: string, message: NetworkMessage) {
    if (this.status.role !== 'host') return;
    this.connections.forEach((seat, connection) => { if (seat === id && connection.open) connection.send(message); });
  }

  subscribe(listener: (message: NetworkMessage) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  destroy() {
    this.closed = true;
    if (this.timeout) clearTimeout(this.timeout);
    this.listeners.clear();
    this.hostConnection?.close();
    this.connections.forEach((_id, connection) => connection.close());
    this.connections.clear();
    this.peer?.destroy();
    this.hostConnection = null;
    this.peer = null;
  }
}

export function randomRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}