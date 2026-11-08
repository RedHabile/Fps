import * as THREE from 'three';
import { ARMORS, SKINS, TDM_DURATION, TDM_KILL_TARGET, TDM_RESPAWN_DELAY, WEAPONS, isPistolWeapon, slotForWeapon, type ArmorId, type GameMode, type GrenadeKind, type MapId, type MatchResult, type Skin, type SkinId, type Team, type Weapon, type WeaponSlot, type WeaponId } from './data';
import { type NetworkMessage, type RoomConnection } from './network';
import { blocked, buildWorld, findPath, lineClear, obstaclesForMap, SITES, type Obstacle } from './world';
import { buildOperator, setOperatorWeapon, type OperatorRig } from './character';
import { buildViewWeapon } from './weapons3d';

type SiteId = 'A' | 'B';
type Phase = 'buy' | 'playing' | 'intermission' | 'finished';

interface Actor extends OperatorRig {
  id: string;
  team: Team;
  bot: boolean;
  index: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  yaw: number;
  health: number;
  armor: number;
  armorId: ArmorId;
  alive: boolean;
  path: { x: number; z: number }[];
  planIn: number;
  shootIn: number;
  reaction: number;
  targetId: string;
  strafe: number;
  strafeIn: number;
  walk: number;
  moving: boolean;
  shotsLeft: number;
  reloadFor: number;
  reloadTotal: number;
  fireKick: number;
  weaponId: WeaponId;
  skinId: SkinId;
  sidearmId: WeaponId;
  primaryId: WeaponId | null;
  activeSlot: WeaponSlot;
  sidearmAmmo: number;
  sidearmReserve: number;
  primaryAmmo: number;
  primaryReserve: number;
  fragLeft: number;
  flashLeft: number;
  blindFor: number;
  spawnProt: number;
  respawnIn: number;
  diedThisRound: boolean;
}

interface Bomb {
  site: SiteId;
  time: number;
}

interface Action {
  actorId: string;
  kind: 'plant' | 'defuse';
  site: SiteId;
  time: number;
  total: number;
}

interface SnapshotActor {
  id: string;
  x: number;
  z: number;
  yaw: number;
  health: number;
  armor: number;
  armorId: ArmorId;
  alive: boolean;
  reloadFor: number;
  reloadTotal: number;
  fireKick: number;
  weaponId: WeaponId;
  skinId: SkinId;
  bot: boolean;
  sidearmId: WeaponId;
  primaryId: WeaponId | null;
  activeSlot: WeaponSlot;
}

interface Snapshot {
  round: number;
  phase: Phase;
  blueScore: number;
  redScore: number;
  time: number;
  buyTime: number;
  bomb: Bomb | null;
  action: Action | null;
  banner: string;
  bannerSub: string;
  roundWinner: Team | null;
  actors: SnapshotActor[];
}

export interface Marker {
  id: SiteId;
  x: number;
  y: number;
  visible: boolean;
  distance: number;
}

export interface GameHUD {
  phase: Phase;
  mode: GameMode;
  health: number;
  armor: number;
  armorId: ArmorId;
  armorCapacity: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  round: number;
  overtime: boolean;
  blueScore: number;
  redScore: number;
  time: number;
  buyTime: number;
  roundCredits: number;
  weaponId: WeaponId;
  weaponName: string;
  sidearmId: WeaponId;
  sidearmName: string;
  primaryId: WeaponId | null;
  primaryName: string;
  activeSlot: WeaponSlot;
  fragLeft: number;
  flashLeft: number;
  respawnIn: number;
  flashBlind: number;
  ready: boolean;
  attacking: boolean;
  bombTime: number | null;
  bombSite: SiteId | null;
  prompt: string;
  actionProgress: number;
  actionLabel: string;
  hit: boolean;
  damaged: boolean;
  kills: number;
  points: number;
  banner: string;
  bannerSub: string;
  aliveBlue: number;
  aliveRed: number;
  dead: boolean;
  locked: boolean;
  markers: Marker[];
  feed: string;
}

interface EngineOptions {
  container: HTMLDivElement;
  minimap: HTMLCanvasElement;
  skin: Skin;
  mapId: MapId;
  mode: GameMode;
  room: RoomConnection | null;
  sound: boolean;
  onHud: (hud: GameHUD) => void;
  onFinish: (result: MatchResult) => void;
  onPause: () => void;
  onHostPause: (paused: boolean) => void;
  onDisconnect: () => void;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface BlastEffect {
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  life: number;
  maxLife: number;
  size: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (x: number, z: number) => Math.atan2(-x, -z);
const angleDiff = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const otherTeam = (team: Team): Team => team === 'blue' ? 'red' : 'blue';
const smoothRange = (value: number, start: number, end: number) => {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

function meshBox(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeActor(id: string, team: Team, bot: boolean, index: number, displayTeam: Team): Actor {
  const rig = buildOperator(id, displayTeam);
  const sidearm = WEAPONS[0];
  return {
    id, team, bot, index, x: 0, z: 0, targetX: 0, targetZ: 0, yaw: 0,
    health: 100, armor: 0, armorId: 'none', alive: true, ...rig,
    path: [], planIn: 0, shootIn: 0.5, reaction: 0, targetId: '', strafe: 1,
    strafeIn: 0, walk: Math.random() * 4, moving: false,
    shotsLeft: sidearm.magazine, reloadFor: 0, reloadTotal: 1.6, fireKick: 0,
    weaponId: 'p12', skinId: 'recruit',
    sidearmId: 'p12', primaryId: null, activeSlot: 'sidearm',
    sidearmAmmo: sidearm.magazine, sidearmReserve: sidearm.magazine * 3,
    primaryAmmo: 0, primaryReserve: 0,
    fragLeft: 1, flashLeft: 1, blindFor: 0, spawnProt: 0, respawnIn: 0, diedThisRound: false,
  };
}

interface Grenade {
  id: string;
  kind: GrenadeKind;
  ownerId: string;
  team: Team;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fuse: number;
  mesh: THREE.Mesh;
}

export class BreachEngine {
  private options: EngineOptions;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(72, 1, 0.06, 120);
  private renderer: THREE.WebGLRenderer;
  private colliders: THREE.Object3D[];
  private obstacles: Obstacle[];
  private actors: Actor[] = [];
  private localId: string;
  private isHost: boolean;
  private gun: THREE.Group;
  private muzzleFlash: THREE.Mesh;
  private magazine: THREE.Group;
  private offhand: THREE.Group;
  private bolt: THREE.Group;
  private magazineHome: THREE.Vector3;
  private boltHomeZ: number;
  private handTravel: number;
  private viewZ: number;
  private pistolView: boolean;
  private bombMesh: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private firing = false;
  private paused = false;
  private hostPaused = false;
  private destroyed = false;
  private raf = 0;
  private lastFrame = 0;
  private elapsed = 0;
  private hudIn = 0;
  private networkIn = 0;
  private mapIn = 0;
  private yaw = 0;
  private pitch = 0;
  private round = 1;
  private blueScore = 0;
  private redScore = 0;
  private time = 75;
  private phase: Phase = 'buy';
  private intermission = 0;
  private buyTime = 15;
  private buyWarmup = 2;
  private buyGraceUntil = 0;
  private roundCredits = 1600;
  private spentSidearm = 0;
  private spentPrimary = 0;
  private spentArmor = 0;
  private selectedArmor: ArmorId = 'none';
  private localReady = false;
  private weapon = WEAPONS[0];
  private grenades: Grenade[] = [];
  private grenadeSeq = 0;
  private flashWhite = 0;
  private tdmTime = TDM_DURATION;
  private readonly isTdm: boolean;
  private bomb: Bomb | null = null;
  private action: Action | null = null;
  private banner = '';
  private bannerSub = '';
  private bannerFor = 0;
  private ammo: number;
  private reserve: number;
  private reloadFor = 0;
  private reloadStage = 0;
  private shotIn = 0;
  private gunKick = 0;
  private flashFor = 0;
  private shake = 0;
  private damageFor = 0;
  private hitFor = 0;
  private feed = '';
  private feedFor = 0;
  private kills = 0;
  private points = 0;
  private humanStats = new Map<string, { kills: number; points: number }>();
  private roundWinner: Team | null = null;
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private blastEffects: BlastEffect[] = [];
  private grenadeThrowFor = 0;
  private swapFor = 0;
  private particleGeometry = new THREE.SphereGeometry(0.055, 5, 4);
  private sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd59c });
  private hitMaterial = new THREE.MeshBasicMaterial({ color: 0x8cebd9 });
  private audio: AudioContext | null = null;
  private unsubscribe: (() => void) | null = null;
  private touchDevice = window.matchMedia('(pointer: coarse)').matches;

  constructor(options: EngineOptions) {
    this.options = options;
    this.isTdm = options.mode === 'tdm';
    this.localId = options.room?.status.selfId || 'p1';
    this.isHost = options.room?.status.role !== 'guest';
    this.ammo = this.weapon.magazine;
    this.reserve = this.weapon.magazine * 3;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.touchDevice, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.touchDevice ? 1.1 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    options.container.appendChild(this.renderer.domElement);
    this.obstacles = obstaclesForMap(options.mapId);
    this.colliders = buildWorld(this.scene, options.mapId);
    const weaponModel = buildViewWeapon(this.weapon, options.skin);
    this.gun = weaponModel.group;
    this.muzzleFlash = weaponModel.flash;
    this.magazine = weaponModel.magazine;
    this.offhand = weaponModel.offhand;
    this.bolt = weaponModel.bolt;
    this.magazineHome = weaponModel.magazineHome;
    this.boltHomeZ = weaponModel.boltHomeZ;
    this.handTravel = weaponModel.handTravel;
    this.viewZ = weaponModel.viewZ;
    this.pistolView = weaponModel.pistol;
    this.gun.scale.setScalar(this.touchDevice ? 0.53 : 0.72);
    this.camera.add(this.gun);
    this.scene.add(this.camera);
    this.bombMesh = this.makeBomb();
    this.scene.add(this.bombMesh);
    this.makeActors();
    this.startRound(1);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('mousemove', this.mouseMove);
    window.addEventListener('mouseup', this.mouseUp);
    window.addEventListener('blur', this.blur);
    this.renderer.domElement.addEventListener('mousedown', this.mouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.preventContext);
    if (options.room) this.unsubscribe = options.room.subscribe(this.receiveNetwork);
    this.raf = requestAnimationFrame(this.frame);
  }

  private get player() {
    return this.actors.find((actor) => actor.id === this.localId)!;
  }

  private get attackingTeam(): Team {
    if (this.round <= 5) return 'blue';
    if (this.round <= 13) return 'red';
    return this.round % 2 === 0 ? 'blue' : 'red';
  }

  private get matchDecided() {
    return Math.max(this.blueScore, this.redScore) >= 10 && Math.abs(this.blueScore - this.redScore) >= 2;
  }

  private makeActors() {
    const humans = new Set(this.options.room?.status.players.map((player) => player.id) ?? [this.localId]);
    const localTeam: Team = Number(this.localId.slice(1)) <= 5 ? 'blue' : 'red';
    this.actors = Array.from({ length: 10 }, (_, seat) => {
      const id = `p${seat + 1}`;
      const team: Team = seat < 5 ? 'blue' : 'red';
      const bot = !humans.has(id);
      const index = seat % 5;
      const actor = makeActor(id, team, bot, index, team === localTeam ? 'blue' : 'red');
      if (!bot) this.humanStats.set(id, { kills: 0, points: 0 });
      if (id === this.localId) actor.skinId = this.options.skin.id;
      this.scene.add(actor.group);
      return actor;
    });
  }

  private makeBomb() {
    const group = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: 0x263330, roughness: 0.7, metalness: 0.35 });
    group.add(meshBox(0.65, 0.2, 0.42, shell, 0, 0.12, 0));
    group.add(meshBox(0.3, 0.04, 0.16, new THREE.MeshBasicMaterial({ color: 0xff6f43 }), 0, 0.24, 0));
    group.visible = false;
    return group;
  }

  private spawnPoint(actor: Actor) {
    const attacking = this.isTdm ? actor.team === 'blue' : actor.team === this.attackingTeam;
    return { x: (actor.index - 2) * 2, z: attacking ? 27.8 : -28.5, yaw: attacking ? 0 : Math.PI };
  }

  private resetActorLoadout(actor: Actor, round: number) {
    actor.sidearmId = 'p12';
    actor.primaryId = null;
    actor.activeSlot = 'sidearm';
    const sidearm = WEAPONS[0];
    actor.sidearmAmmo = sidearm.magazine;
    actor.sidearmReserve = sidearm.magazine * 3;
    actor.primaryAmmo = 0;
    actor.primaryReserve = 0;
    if (actor.bot) {
      if (round > 1 || this.isTdm) {
        const pick = (['spectre', 'viper', 'bulldog', 'phantom', 'spectre'] as WeaponId[])[actor.index % 5];
        actor.primaryId = pick;
        actor.activeSlot = 'primary';
        const primary = WEAPONS.find((weapon) => weapon.id === pick) ?? WEAPONS[1];
        actor.primaryAmmo = primary.magazine;
        actor.primaryReserve = primary.magazine * 3;
      }
      if (round > 1 || this.isTdm) {
        actor.armorId = actor.index % 3 === 0 ? 'heavy' : actor.index % 3 === 1 ? 'light' : 'none';
      } else {
        actor.armorId = actor.index % 3 === 0 ? 'light' : 'none';
      }
    } else {
      actor.armorId = 'none';
    }
    actor.armor = (ARMORS.find((armor) => armor.id === actor.armorId) ?? ARMORS[0]).capacity;
    const active = actor.activeSlot === 'primary' && actor.primaryId
      ? WEAPONS.find((weapon) => weapon.id === actor.primaryId)!
      : WEAPONS.find((weapon) => weapon.id === actor.sidearmId)!;
    actor.weaponId = active.id;
    actor.shotsLeft = active.magazine;
    setOperatorWeapon(actor, actor.weaponId, SKINS.find((skin) => skin.id === actor.skinId));
  }

  private placeActor(actor: Actor) {
    const spawn = this.spawnPoint(actor);
    actor.x = spawn.x;
    actor.z = spawn.z;
    actor.targetX = actor.x;
    actor.targetZ = actor.z;
    actor.yaw = spawn.yaw;
    actor.health = 100;
    actor.alive = true;
    actor.diedThisRound = false;
    actor.group.position.set(actor.x, 0, actor.z);
    actor.group.rotation.set(0, actor.yaw, 0);
    actor.group.visible = actor.id !== this.localId;
    actor.path = [];
    actor.planIn = Math.random() * 0.5;
    actor.shootIn = 0.5 + Math.random();
    actor.targetId = '';
    actor.reaction = 0;
    actor.moving = false;
    actor.reloadFor = 0;
    actor.reloadTotal = 1.6;
    actor.fireKick = 0;
    actor.blindFor = 0;
    actor.fragLeft = 1;
    actor.flashLeft = 1;
    actor.spawnProt = this.isTdm ? 2 : 0;
    actor.respawnIn = 0;
  }

  private startRound(round: number) {
    this.round = round;
    this.phase = 'buy';
    this.time = this.isTdm ? TDM_DURATION : 75;
    this.tdmTime = TDM_DURATION;
    this.buyTime = 15;
    this.buyWarmup = 2;
    this.buyGraceUntil = 0;
    this.localReady = false;
    this.spentSidearm = 0;
    this.spentPrimary = 0;
    this.spentArmor = 0;
    this.bomb = null;
    this.action = null;
    this.bombMesh.visible = false;
    this.firing = false;
    this.pitch = 0;
    this.roundWinner = null;
    this.grenades.forEach((grenade) => this.scene.remove(grenade.mesh));
    this.grenades = [];
    this.actors.forEach((actor) => {
      const survived = round > 1 && actor.alive && !actor.diedThisRound;
      if (!survived) this.resetActorLoadout(actor, round);
      else {
        actor.fragLeft = 1;
        actor.flashLeft = 1;
        const sidearm = WEAPONS.find((weapon) => weapon.id === actor.sidearmId) ?? WEAPONS[0];
        actor.sidearmAmmo = sidearm.magazine;
        actor.sidearmReserve = sidearm.magazine * 3;
        if (actor.primaryId) {
          const primary = WEAPONS.find((weapon) => weapon.id === actor.primaryId)!;
          actor.primaryAmmo = primary.magazine;
          actor.primaryReserve = primary.magazine * 3;
        }
        if (actor.activeSlot === 'primary' && !actor.primaryId) actor.activeSlot = 'sidearm';
        const active = actor.activeSlot === 'primary' && actor.primaryId
          ? WEAPONS.find((weapon) => weapon.id === actor.primaryId)!
          : WEAPONS.find((weapon) => weapon.id === actor.sidearmId)!;
        actor.weaponId = active.id;
        setOperatorWeapon(actor, actor.weaponId, SKINS.find((skin) => skin.id === actor.skinId));
      }
      this.placeActor(actor);
    });
    const player = this.player;
    this.selectedArmor = player.armorId;
    this.equipSlot(player.activeSlot, false);
    this.yaw = player.yaw;
    this.banner = '';
    this.bannerFor = 0;
  }

  private savePlayerAmmo() {
    const player = this.player;
    if (player.activeSlot === 'primary') {
      player.primaryAmmo = this.ammo;
      player.primaryReserve = this.reserve;
    } else {
      player.sidearmAmmo = this.ammo;
      player.sidearmReserve = this.reserve;
    }
  }

  private equipSlot(slot: WeaponSlot, announce = true) {
    const player = this.player;
    if (slot === 'primary' && !player.primaryId) return;
    this.savePlayerAmmo();
    player.activeSlot = slot;
    const id = slot === 'primary' ? player.primaryId! : player.sidearmId;
    const weapon = WEAPONS.find((entry) => entry.id === id) ?? WEAPONS[0];
    if (weapon.id !== this.weapon.id) {
      this.camera.remove(this.gun);
      this.gun.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      const model = buildViewWeapon(weapon, this.options.skin);
      this.gun = model.group;
      this.muzzleFlash = model.flash;
      this.magazine = model.magazine;
      this.offhand = model.offhand;
      this.bolt = model.bolt;
      this.magazineHome = model.magazineHome;
      this.boltHomeZ = model.boltHomeZ;
      this.handTravel = model.handTravel;
      this.viewZ = model.viewZ;
      this.pistolView = model.pistol;
      this.gun.scale.setScalar(this.touchDevice ? 0.53 : 0.72);
      this.camera.add(this.gun);
    }
    this.weapon = weapon;
    player.weaponId = weapon.id;
    this.ammo = slot === 'primary' ? player.primaryAmmo : player.sidearmAmmo;
    this.reserve = slot === 'primary' ? player.primaryReserve : player.sidearmReserve;
    this.reloadFor = 0;
    this.reloadStage = 0;
    setOperatorWeapon(player, weapon.id, this.options.skin);
    if (announce) {
      this.swapFor = 0.42;
      this.ensureAudio();
      this.sound('swap');
      this.sendLoadout();
      this.publishHud();
    }
  }

  private changeWeapon(weapon: Weapon) {
    this.savePlayerAmmo();
    const slot = slotForWeapon(weapon.kind);
    const player = this.player;
    if (slot === 'primary') {
      player.primaryId = weapon.id;
      player.primaryAmmo = weapon.magazine;
      player.primaryReserve = weapon.magazine * 3;
    } else {
      player.sidearmId = weapon.id;
      player.sidearmAmmo = weapon.magazine;
      player.sidearmReserve = weapon.magazine * 3;
    }
    player.activeSlot = slot;
    this.camera.remove(this.gun);
    this.gun.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    const model = buildViewWeapon(weapon, this.options.skin);
    this.gun = model.group;
    this.muzzleFlash = model.flash;
    this.magazine = model.magazine;
    this.offhand = model.offhand;
    this.bolt = model.bolt;
    this.magazineHome = model.magazineHome;
    this.boltHomeZ = model.boltHomeZ;
    this.handTravel = model.handTravel;
    this.viewZ = model.viewZ;
    this.pistolView = model.pistol;
    this.gun.scale.setScalar(this.touchDevice ? 0.53 : 0.72);
    this.camera.add(this.gun);
    this.weapon = weapon;
    this.swapFor = 0.42;
    player.weaponId = weapon.id;
    this.ammo = weapon.magazine;
    this.reserve = weapon.magazine * 3;
    this.reloadFor = 0;
    this.reloadStage = 0;
    setOperatorWeapon(player, weapon.id, this.options.skin);
  }

  public buyWeapon(id: WeaponId) {
    if (this.paused || this.hostPaused) return;
    const canBuy = this.phase === 'buy' || (this.isTdm && !this.player.alive);
    if (!canBuy || (this.phase === 'buy' && this.localReady)) return;
    const weapon = WEAPONS.find((entry) => entry.id === id);
    if (!weapon || (this.round === 1 && !this.isTdm && weapon.kind !== 'pistol' && weapon.kind !== 'heavy-pistol')) return;
    const slot = slotForWeapon(weapon.kind);
    const spent = slot === 'primary' ? this.spentPrimary : this.spentSidearm;
    const currentId = slot === 'primary' ? this.player.primaryId : this.player.sidearmId;
    if (currentId === weapon.id) return;
    const available = this.roundCredits + spent;
    if (weapon.price > available) return;
    this.roundCredits = available - weapon.price;
    if (slot === 'primary') this.spentPrimary = weapon.price;
    else this.spentSidearm = weapon.price;
    this.changeWeapon(weapon);
    this.sendLoadout();
    this.ensureAudio();
    this.sound('action');
    this.publishHud();
  }

  public buyArmor(id: ArmorId) {
    if (this.paused || this.hostPaused) return;
    const canBuy = this.phase === 'buy' || (this.isTdm && !this.player.alive);
    if (!canBuy || (this.phase === 'buy' && this.localReady)) return;
    const armor = ARMORS.find((entry) => entry.id === id);
    if (!armor || this.selectedArmor === armor.id) return;
    const available = this.roundCredits + this.spentArmor;
    if (armor.price > available) return;
    this.roundCredits = available - armor.price;
    this.spentArmor = armor.price;
    this.selectedArmor = armor.id;
    this.player.armorId = armor.id;
    this.player.armor = armor.capacity;
    this.sendLoadout();
    this.ensureAudio();
    this.sound('action');
    this.publishHud();
  }

  private sendLoadout() {
    if (!this.isHost) this.options.room?.send({
      type: 'buy-choice', round: this.round, weaponId: this.weapon.id, skinId: this.options.skin.id,
      armorId: this.selectedArmor, sidearmId: this.player.sidearmId, primaryId: this.player.primaryId,
      activeSlot: this.player.activeSlot,
    });
  }

  public swapWeapon() {
    const player = this.player;
    if (this.paused || this.hostPaused || !player.alive || !player.primaryId) return;
    if (this.phase !== 'playing' && !(this.phase === 'buy' && !this.localReady)) return;
    this.equipSlot(player.activeSlot === 'primary' ? 'sidearm' : 'primary');
    if (!this.isHost) this.options.room?.send({ type: 'swap', round: this.round, activeSlot: player.activeSlot, weaponId: this.weapon.id });
  }

  public throwGrenade(kind: GrenadeKind) {
    const player = this.player;
    if (this.paused || this.hostPaused || this.phase !== 'playing' || !player.alive) return;
    if ((kind === 'frag' ? player.fragLeft : player.flashLeft) <= 0) return;
    if (this.shotIn > 0 || this.reloadFor > 0) return;
    this.ensureAudio();
    this.grenadeThrowFor = 0.56;
    const direction = this.direction(this.yaw, this.pitch);
    if (this.isHost) {
      this.spawnGrenade(player, kind, direction);
      this.options.room?.send({
        type: 'grenade-thrown', id: `${player.id}-${this.grenadeSeq - 1}`, kind, round: this.round,
        x: player.x, z: player.z, dx: direction.x, dy: direction.y, dz: direction.z,
      });
    } else {
      if (kind === 'frag') player.fragLeft--;
      else player.flashLeft--;
      this.shotIn = 0.8;
      this.sound('throw');
      this.options.room?.send({ type: 'grenade', round: this.round, kind, dx: direction.x, dy: direction.y, dz: direction.z });
      this.publishHud();
    }
  }

  private spawnGrenade(owner: Actor, kind: GrenadeKind, direction: THREE.Vector3) {
    if (kind === 'frag') owner.fragLeft = Math.max(0, owner.fragLeft - 1);
    else owner.flashLeft = Math.max(0, owner.flashLeft - 1);
    if (owner.id === this.localId) {
      this.grenadeThrowFor = 0.56;
      this.shotIn = 0.8;
      this.publishHud();
    }
    const id = `${owner.id}-${this.grenadeSeq++}`;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(kind === 'frag' ? 0.09 : 0.075, 8, 6),
      new THREE.MeshStandardMaterial({ color: kind === 'frag' ? 0x3d4a35 : 0xcfd8cf, roughness: 0.6 }),
    );
    const origin = new THREE.Vector3(owner.x, 1.5, owner.z).addScaledVector(direction, 0.5);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.grenades.push({
      id, kind, ownerId: owner.id, team: owner.team, pos: origin.clone(),
      vel: direction.clone().multiplyScalar(11).add(new THREE.Vector3(0, 3.5, 0)),
      fuse: kind === 'frag' ? 1.6 : 1.1, mesh,
    });
    this.sound('throw');
    return id;
  }

  private updateGrenades(dt: number, applyDamage: boolean) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const grenade = this.grenades[i];
      grenade.fuse -= dt;
      grenade.vel.y -= dt * 12;
      const nextX = grenade.pos.x + grenade.vel.x * dt;
      const nextZ = grenade.pos.z + grenade.vel.z * dt;
      let nextY = grenade.pos.y + grenade.vel.y * dt;
      if (!blocked(nextX, grenade.pos.z, 0.15, this.obstacles)) grenade.pos.x = clamp(nextX, -32, 32);
      else grenade.vel.x *= -0.4;
      if (!blocked(grenade.pos.x, nextZ, 0.15, this.obstacles)) grenade.pos.z = clamp(nextZ, -31.5, 31.5);
      else grenade.vel.z *= -0.4;
      if (nextY <= 0.08) {
        nextY = 0.08;
        grenade.vel.y *= -0.4;
        grenade.vel.x *= 0.7;
        grenade.vel.z *= 0.7;
      }
      grenade.pos.y = nextY;
      grenade.mesh.position.copy(grenade.pos);
      if (grenade.fuse <= 0) {
        this.grenades.splice(i, 1);
        this.scene.remove(grenade.mesh);
        grenade.mesh.geometry.dispose();
        (grenade.mesh.material as THREE.Material).dispose();
        this.explodeGrenade(grenade, applyDamage);
      }
    }
  }

  private spawnBlast(position: THREE.Vector3, size: number, color: number, duration: number) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffe1b0, transparent: true, opacity: 0.9, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), material);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.035, 6, 32), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    ring.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
    mesh.scale.setScalar(0.12);
    ring.scale.setScalar(0.18);
    this.scene.add(mesh, ring);
    this.blastEffects.push({ mesh, ring, life: duration, maxLife: duration, size });
  }

  private explodeGrenade(grenade: Grenade, applyDamage: boolean) {
    const pos = grenade.pos.clone();
    if (grenade.kind === 'frag') {
      this.spawnBlast(pos, 5.2, 0xff713b, 0.58);
      this.spawnParticles(pos, false, 28);
      this.spawnParticles(pos.clone().add(new THREE.Vector3(0, 0.3, 0)), true, 8);
      this.sound('boom');
      const distPlayer = Math.hypot(this.player.x - pos.x, this.player.z - pos.z);
      if (distPlayer < 12) this.shake = Math.max(this.shake, 0.3 * (1 - distPlayer / 12));
      if (applyDamage) {
        for (const target of this.actors) {
          if (!target.alive || target.team === grenade.team) continue;
          const dist = Math.hypot(target.x - pos.x, target.z - pos.z);
          if (dist > 7.5) continue;
          const shooter = this.actors.find((actor) => actor.id === grenade.ownerId) ?? target;
          this.damageActor(target, Math.max(10, Math.round(85 * (1 - dist / 8))), shooter);
        }
      }
    } else {
      this.spawnBlast(pos, 7.5, 0xf4ffff, 0.42);
      this.spawnParticles(pos, true, 18);
      this.sound('flashbang');
      if (applyDamage) {
        for (const target of this.actors) {
          if (!target.alive || target.team === grenade.team) continue;
          const dist = Math.hypot(target.x - pos.x, target.z - pos.z);
          if (dist > 20) continue;
          if (!lineClear(pos.x, pos.z, target.x, target.z, 0, this.obstacles)) continue;
          const strength = clamp(1.25 - dist / 20, 0.25, 1.25);
          if (target.id === this.localId) this.flashWhite = Math.max(this.flashWhite, strength);
          else target.blindFor = Math.max(target.blindFor, strength * 2.4);
        }
        const selfDist = Math.hypot(this.player.x - pos.x, this.player.z - pos.z);
        if (this.player.team === grenade.team && selfDist < 6 && lineClear(pos.x, pos.z, this.player.x, this.player.z, 0, this.obstacles)) {
          this.flashWhite = Math.max(this.flashWhite, 0.4);
        }
      }
    }
    if (this.isHost) this.options.room?.send({ type: 'grenade-exploded', id: grenade.id, kind: grenade.kind, x: pos.x, y: pos.y, z: pos.z });
  }

  public respawnPlayer() {
    const player = this.player;
    if (!this.isTdm || this.phase !== 'playing' || player.alive) return;
    this.placeActor(player);
    this.equipSlot(player.activeSlot, false);
    this.yaw = player.yaw;
    this.pitch = 0;
    this.ensureAudio();
    this.sound('round');
    this.sendLoadout();
    this.publishHud();
  }

  public readyToDeploy() {
    if (this.phase !== 'buy' || this.paused || this.hostPaused) return;
    this.localReady = !this.localReady;
    this.ensureAudio();
    this.sendLoadout();
    this.publishHud();
  }

  private beginRound() {
    if (this.phase !== 'buy') return;
    this.phase = 'playing';
    this.buyGraceUntil = performance.now() + 1000;
    if (this.isTdm) {
      this.banner = 'COMBAT EN ÉQUIPE';
      this.bannerSub = `PREMIER À ${TDM_KILL_TARGET} ÉLIMINATIONS`;
    } else {
      this.banner = this.round >= 14 ? 'PROLONGATION' : this.round === 6 ? 'CHANGEMENT DE C\u00d4T\u00c9' : `MANCHE ${String(this.round).padStart(2, '0')}`;
      this.bannerSub = this.attackingTeam === this.player.team ? 'ATTAQUEZ LES SITES A OU B' : 'D\u00c9FENDEZ LES SITES A ET B';
    }
    this.bannerFor = 2.6;
    this.sound('round');
  }

  private resize = () => {
    const width = this.options.container.clientWidth || window.innerWidth;
    const height = this.options.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private preventContext = (event: Event) => event.preventDefault();

  private keyDown = (event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      if (!event.repeat) {
        this.firing = false;
        this.options.onPause();
      }
      return;
    }
    if (this.paused || this.hostPaused) return;
    if (this.phase === 'playing' && ['KeyW', 'KeyZ', 'KeyA', 'KeyQ', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    this.ensureAudio();
    if (this.phase === 'buy') {
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(event.code);
      if (index >= 0) this.buyWeapon(WEAPONS[index].id);
      if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) this.readyToDeploy();
      return;
    }
    if (event.code === 'KeyR') this.reload();
    if (event.code === 'KeyE') this.interact();
    if (event.code === 'KeyF' || event.code === 'KeyX') this.swapWeapon();
    if (event.code === 'KeyG') this.throwGrenade('frag');
    if (event.code === 'KeyV') this.throwGrenade('flash');
    if (event.code === 'Space') this.setFiring(true);
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    if (event.code === 'Space') this.firing = false;
  };

  private mouseDown = (event: MouseEvent) => {
    if (event.button !== 0 || this.paused || this.touchDevice) return;
    this.ensureAudio();
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock?.();
    }
    this.setFiring(true);
  };

  private mouseUp = () => { this.firing = false; };

  private mouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement === this.renderer.domElement && !this.paused) {
      this.look(event.movementX, event.movementY);
    }
  };

  private blur = () => {
    this.keys.clear();
    this.firing = false;
  };

  public setPaused(paused: boolean) {
    this.paused = paused;
    this.firing = false;
    this.keys.clear();
    this.touchMove = { x: 0, y: 0 };
    if (paused && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    if (this.isHost && this.options.room) this.options.room.send({ type: 'host-pause', paused });
  }

  public look(dx: number, dy: number) {
    if (this.paused || this.hostPaused || this.phase !== 'playing' || !this.player.alive) return;
    this.yaw -= dx * 0.0024;
    this.pitch = clamp(this.pitch - dy * 0.0021, -1.05, 1.05);
  }

  public setMove(x: number, y: number) {
    this.touchMove = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  public setFiring(firing: boolean) {
    this.ensureAudio();
    this.firing = firing && !this.paused && !this.hostPaused;
    if (this.firing && this.phase === 'playing' && this.player.alive && this.shotIn <= 0 && this.reloadFor <= 0 && !this.actionFor(this.player)) {
      if (this.ammo > 0) this.firePlayer();
      else this.reload();
    }
  }

  public reload() {
    if (this.paused || this.hostPaused || this.phase !== 'playing' || !this.player.alive || this.reloadFor > 0 || this.ammo === this.weapon.magazine || this.reserve <= 0) return;
    this.ensureAudio();
    this.reloadFor = this.weapon.reload;
    this.reloadStage = 0;
    this.player.reloadFor = this.reloadFor;
    this.player.reloadTotal = this.weapon.reload;
    if (!this.isHost) this.options.room?.send({ type: 'reload', duration: this.weapon.reload, round: this.round });
    this.sound('reload');
  }

  public interact() {
    if (this.paused || this.hostPaused || this.phase !== 'playing' || !this.player.alive) return;
    this.ensureAudio();
    if (this.isHost) this.tryAction(this.player);
    else this.options.room?.send({ type: 'interact', round: this.round });
  }

  private moveActor(actor: Actor, dx: number, dz: number) {
    if (!blocked(actor.x + dx, actor.z, 0.55, this.obstacles)) actor.x += dx;
    if (!blocked(actor.x, actor.z + dz, 0.55, this.obstacles)) actor.z += dz;
    actor.x = clamp(actor.x, -32, 32);
    actor.z = clamp(actor.z, -31.5, 31.5);
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    const realDt = Math.max(0, (now - (this.lastFrame || now)) / 1000);
    const dt = Math.min(realDt, 0.05);
    this.lastFrame = now;
    if (!this.paused && !this.hostPaused) {
      this.elapsed += dt;
      this.bannerFor = Math.max(0, this.bannerFor - dt);
      this.damageFor = Math.max(0, this.damageFor - dt);
      this.hitFor = Math.max(0, this.hitFor - dt);
      this.feedFor = Math.max(0, this.feedFor - dt);
      this.shotIn = Math.max(0, this.shotIn - dt);
      this.flashFor = Math.max(0, this.flashFor - dt);
      this.grenadeThrowFor = Math.max(0, this.grenadeThrowFor - dt);
      this.swapFor = Math.max(0, this.swapFor - dt);
      this.gunKick = Math.max(0, this.gunKick - dt * 5);
      this.shake = Math.max(0, this.shake - dt * 2.4);
      this.muzzleFlash.visible = this.flashFor > 0;
      this.flashWhite = Math.max(0, this.flashWhite - dt * 0.7);

      if (this.phase === 'buy' && this.isHost) {
        if (this.buyWarmup > 0) this.buyWarmup--;
        else this.buyTime = Math.max(0, this.buyTime - realDt);
        if (this.buyTime <= 0) this.beginRound();
      } else if (this.phase === 'playing') {
        if (this.isHost) {
          if (this.isTdm) {
            this.tdmTime = Math.max(0, this.tdmTime - dt);
            this.time = this.tdmTime;
          } else this.time = Math.max(0, this.time - dt);
        }
        this.updatePlayer(dt);
        if (this.isHost) {
          this.updateBots(dt);
          // Grenades must keep simulating in every host game mode, not only TDM.
          this.updateGrenades(dt, true);
          if (!this.isTdm) {
            this.updateAction(dt);
            if (this.bomb) {
              this.bomb.time = Math.max(0, this.bomb.time - dt);
              if (this.bomb.time <= 0) {
                const site = SITES.find((entry) => entry.id === this.bomb?.site);
                if (site) {
                  const blast = new THREE.Vector3(site.x, 0.55, site.z);
                  this.spawnBlast(blast, 13, 0xff6338, 0.9);
                  this.spawnParticles(blast, false, 46);
                  this.spawnParticles(blast.clone().add(new THREE.Vector3(0, 0.35, 0)), true, 22);
                  this.shake = Math.max(this.shake, 0.65);
                  this.sound('boom');
                }
                this.endRound(this.attackingTeam, 'CHARGE DÉTONÉE');
              }
            } else if (this.time <= 0) {
              this.endRound(otherTeam(this.attackingTeam), 'TEMPS \u00c9COUL\u00c9');
            }
            this.checkEliminations();
          } else {
            this.updateRespawns(dt);
            if (this.blueScore >= TDM_KILL_TARGET || this.redScore >= TDM_KILL_TARGET || this.tdmTime <= 0) {
              this.finishTdm();
            }
          }
        } else {
          this.updateRemoteActors(dt);
          this.updateGrenades(dt, false);
        }
        for (const actor of this.actors) {
          if (actor.blindFor > 0) actor.blindFor = Math.max(0, actor.blindFor - dt);
          if (actor.spawnProt > 0) actor.spawnProt = Math.max(0, actor.spawnProt - dt);
        }
      } else if (this.phase === 'intermission' && this.isHost) {
        this.intermission -= dt;
        if (this.intermission <= 0) {
          if (this.matchDecided) this.finishMatch();
          else this.startRound(this.round + 1);
        }
      } else if (!this.isHost) {
        this.updateRemoteActors(dt);
      }
      this.updateVisuals(dt);
      this.updateEffects(dt);
      this.networkIn -= dt;
      if (this.networkIn <= 0 && this.options.room) {
        this.networkIn = 0.1;
        if (this.isHost) this.sendSnapshot();
        else if (this.phase === 'buy') this.sendLoadout();
        else if (this.phase === 'playing') this.options.room.send({ type: 'position', x: this.player.x, z: this.player.z, yaw: this.yaw, pitch: this.pitch, round: this.round, skinId: this.options.skin.id });
      }
      this.hudIn -= dt;
      if (this.hudIn <= 0) {
        this.hudIn = 0.09;
        this.publishHud();
      }
      this.mapIn -= dt;
      if (this.mapIn <= 0) {
        this.mapIn = 0.12;
        this.drawMinimap();
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private updatePlayer(dt: number) {
    const player = this.player;
    if (!player.alive) {
      this.firing = false;
      return;
    }
    if (this.reloadFor > 0) {
      this.reloadFor = Math.max(0, this.reloadFor - dt);
      const progress = 1 - this.reloadFor / this.weapon.reload;
      if (progress >= 0.2 && this.reloadStage < 1) { this.sound('mag-out'); this.reloadStage = 1; }
      if (progress >= 0.62 && this.reloadStage < 2) { this.sound('mag-in'); this.reloadStage = 2; }
      if (progress >= 0.84 && this.reloadStage < 3) { this.sound('bolt'); this.reloadStage = 3; }
      player.reloadFor = this.reloadFor;
      if (this.reloadFor <= 0) {
        const amount = Math.min(this.weapon.magazine - this.ammo, this.reserve);
        this.ammo += amount;
        this.reserve -= amount;
      }
    }
    let forward = (this.keys.has('KeyW') || this.keys.has('KeyZ') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.touchMove.y;
    let right = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('KeyQ') ? 1 : 0) + this.touchMove.x;
    const length = Math.hypot(forward, right);
    if (length > 1) {
      forward /= length;
      right /= length;
    }
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = (sprinting ? 7.3 : 5.4) * dt;
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * speed;
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * speed;
    const beforeX = player.x;
    const beforeZ = player.z;
    this.moveActor(player, dx, dz);
    player.moving = Math.hypot(player.x - beforeX, player.z - beforeZ) > 0.001;
    player.yaw = this.yaw;
    if (player.moving) player.walk += dt * (sprinting ? 12 : 9);
    if (this.firing && this.shotIn <= 0 && this.reloadFor <= 0 && !this.actionFor(player)) {
      if (this.ammo > 0) this.firePlayer();
      else this.reload();
    }
  }

  private updateBots(dt: number) {
    for (const actor of this.actors) {
      if (!actor.bot || !actor.alive) continue;
      actor.planIn -= dt;
      actor.shootIn -= dt;
      actor.strafeIn -= dt;
      if (actor.reloadFor > 0) {
        actor.reloadFor = Math.max(0, actor.reloadFor - dt);
        if (actor.reloadFor === 0) actor.shotsLeft = (WEAPONS.find((weapon) => weapon.id === actor.weaponId) ?? WEAPONS[0]).magazine;
      }
      actor.moving = false;
      if (this.actionFor(actor)) continue;

      const visible = this.actors
        .filter((target) => target.alive && target.team !== actor.team)
        .map((target) => ({ target, dist: distance(actor, target) }))
        .filter(({ target, dist }) => {
          if (dist > 20) return false;
          const dx = (target.x - actor.x) / Math.max(dist, 0.01);
          const dz = (target.z - actor.z) / Math.max(dist, 0.01);
          const facing = -Math.sin(actor.yaw) * dx - Math.cos(actor.yaw) * dz;
          return facing > -0.35 && lineClear(actor.x, actor.z, target.x, target.z, 0, this.obstacles);
        })
        .sort((a, b) => a.dist - b.dist)[0];

      if (visible) {
        const { target, dist } = visible;
        if (actor.targetId !== target.id) {
          actor.targetId = target.id;
          actor.reaction = 0.4 + Math.random() * 0.5 + actor.blindFor;
        }
        actor.reaction -= dt;
        const desired = angleTo(target.x - actor.x, target.z - actor.z);
        actor.yaw += angleDiff(desired, actor.yaw) * Math.min(1, dt * (actor.blindFor > 0 ? 1.5 : 5));
        if (actor.strafeIn <= 0) {
          actor.strafe = Math.random() > 0.5 ? 1 : -1;
          actor.strafeIn = 0.8 + Math.random() * 1.5;
        }
        const approach = dist > 13 ? 1.8 : dist < 5 ? -0.7 : 0;
        const dx = (-Math.sin(actor.yaw) * approach + Math.cos(actor.yaw) * actor.strafe * 1.05) * dt;
        const dz = (-Math.cos(actor.yaw) * approach - Math.sin(actor.yaw) * actor.strafe * 1.05) * dt;
        const beforeX = actor.x;
        const beforeZ = actor.z;
        this.moveActor(actor, dx, dz);
        actor.moving = Math.hypot(actor.x - beforeX, actor.z - beforeZ) > 0.001;
        if (actor.reaction <= 0 && actor.shootIn <= 0 && actor.reloadFor <= 0 && actor.blindFor <= 0) {
          const weapon = WEAPONS.find((entry) => entry.id === actor.weaponId) ?? WEAPONS[0];
          actor.shootIn = Math.max(0.3, weapon.rate * 3.2) + Math.random() * 0.3;
          this.botFire(actor, target, dist);
        }
      } else if (this.isTdm) {
        actor.targetId = '';
        if (actor.blindFor > 0) {
          actor.yaw += dt * 0.9 * actor.strafe;
        } else {
          if (actor.planIn <= 0) {
            actor.planIn = 2.5 + Math.random() * 2.5;
            const lane = (actor.index - 2) * 9;
            const spots = [
              { x: lane, z: -4 }, { x: -lane, z: 6 }, { x: 0, z: -12 },
              { x: lane * 0.5, z: 12 }, { x: -lane * 0.5, z: -18 }, { x: 0, z: 0 },
            ];
            const goal = spots[Math.floor(Math.random() * spots.length)];
            actor.path = lineClear(actor.x, actor.z, goal.x, goal.z, 0.8, this.obstacles)
              ? [goal]
              : findPath(actor.x, actor.z, goal.x, goal.z, this.obstacles);
          }
          while (actor.path.length && distance(actor, actor.path[0]) < 0.65) actor.path.shift();
          const next = actor.path[0];
          if (next) {
            const dx = next.x - actor.x;
            const dz = next.z - actor.z;
            const len = Math.hypot(dx, dz);
            const desired = angleTo(dx, dz);
            actor.yaw += angleDiff(desired, actor.yaw) * Math.min(1, dt * 4.5);
            const beforeX = actor.x;
            const beforeZ = actor.z;
            this.moveActor(actor, dx / len * dt * 3.65, dz / len * dt * 3.65);
            actor.moving = Math.hypot(actor.x - beforeX, actor.z - beforeZ) > 0.001;
            if (!actor.moving) actor.planIn = 0;
          } else {
            actor.yaw += dt * 0.38 * actor.strafe;
          }
        }
      } else {
        actor.targetId = '';
        const site = SITES[(actor.index + this.round) % 2];
        const targetSite = this.bomb ? SITES.find((entry) => entry.id === this.bomb?.site)! : site;
        const attacking = actor.team === this.attackingTeam;
        if (!this.action && ((attacking && !this.bomb && distance(actor, targetSite) < 2.2) ||
          (!attacking && this.bomb && distance(actor, targetSite) < 2.2))) {
          this.tryAction(actor);
        }
        if (this.actionFor(actor)) continue;
        const goal = this.bomb
          ? { x: targetSite.x + (attacking ? (actor.index - 2) * 1.4 : 0), z: targetSite.z + (attacking ? 2 : 0) }
          : { x: targetSite.x + (actor.index - 2) * 0.7, z: targetSite.z + (attacking ? 0 : 1.8) };
        if (actor.planIn <= 0) {
          actor.planIn = 1.3 + Math.random() * 0.7;
          actor.path = lineClear(actor.x, actor.z, goal.x, goal.z, 0.8, this.obstacles)
            ? [goal]
            : findPath(actor.x, actor.z, goal.x, goal.z, this.obstacles);
        }
        while (actor.path.length && distance(actor, actor.path[0]) < 0.65) actor.path.shift();
        const next = actor.path[0];
        if (next) {
          const dx = next.x - actor.x;
          const dz = next.z - actor.z;
          const len = Math.hypot(dx, dz);
          const desired = angleTo(dx, dz);
          actor.yaw += angleDiff(desired, actor.yaw) * Math.min(1, dt * 4.5);
          const beforeX = actor.x;
          const beforeZ = actor.z;
          this.moveActor(actor, dx / len * dt * 3.65, dz / len * dt * 3.65);
          actor.moving = Math.hypot(actor.x - beforeX, actor.z - beforeZ) > 0.001;
          if (!actor.moving) actor.planIn = 0;
        } else {
          actor.yaw += dt * 0.38 * actor.strafe;
        }
      }
      if (actor.moving) actor.walk += dt * 8;
    }
  }

  private updateRemoteActors(dt: number) {
    if (this.isTdm && !this.player.alive && this.phase === 'playing') {
      this.player.respawnIn -= dt;
      if (this.player.respawnIn <= 0) this.respawnPlayer();
    }
    for (const actor of this.actors) {
      if (actor.id === this.localId) continue;
      const beforeX = actor.x;
      const beforeZ = actor.z;
      actor.x += (actor.targetX - actor.x) * Math.min(1, dt * 12);
      actor.z += (actor.targetZ - actor.z) * Math.min(1, dt * 12);
      actor.moving = Math.hypot(actor.x - beforeX, actor.z - beforeZ) > 0.003;
      if (actor.moving) actor.walk += dt * 8;
    }
  }

  private actionFor(actor: Actor) {
    return this.action?.actorId === actor.id;
  }

  private tryAction(actor: Actor) {
    if (this.isTdm) return;
    if (this.action || !actor.alive || this.phase !== 'playing') return;
    const attacking = actor.team === this.attackingTeam;
    if (attacking && !this.bomb) {
      const site = SITES.find((entry) => distance(actor, entry) < 2.6);
      if (!site) return;
      this.action = { actorId: actor.id, kind: 'plant', site: site.id, time: 0, total: 2.1 };
      this.sound('action');
    } else if (!attacking && this.bomb) {
      const site = SITES.find((entry) => entry.id === this.bomb?.site)!;
      if (distance(actor, site) > 2.6) return;
      this.action = { actorId: actor.id, kind: 'defuse', site: site.id, time: 0, total: 3.3 };
      this.sound('action');
    }
  }

  private updateAction(dt: number) {
    if (!this.action) return;
    const actor = this.actors.find((entry) => entry.id === this.action?.actorId);
    const site = SITES.find((entry) => entry.id === this.action?.site)!;
    if (!actor?.alive || distance(actor, site) > 3.2) {
      this.action = null;
      return;
    }
    this.action.time += dt;
    if (this.action.time < this.action.total) return;
    if (this.action.kind === 'plant') {
      this.bomb = { site: site.id, time: 25 };
      this.bombMesh.position.set(site.x, 0, site.z);
      this.bombMesh.visible = true;
      this.banner = 'CHARGE POS\u00c9E';
      this.bannerSub = `SITE ${site.id} / ${this.attackingTeam === this.player.team ? 'PROT\u00c9GEZ' : 'D\u00c9SAMORCEZ'} LA CHARGE`;
      this.bannerFor = 2.4;
      this.sound('plant');
      this.awardObjective(actor);
      this.action = null;
    } else {
      this.awardObjective(actor);
      this.action = null;
      this.endRound(otherTeam(this.attackingTeam), 'CHARGE D\u00c9SAMORC\u00c9E');
    }
  }

  private awardObjective(actor: Actor) {
    if (actor.bot) return;
    const stats = this.humanStats.get(actor.id);
    if (stats) stats.points += 250;
    if (actor.id === this.localId) {
      this.points += 250;
      this.roundCredits = Math.min(9000, this.roundCredits + 300);
    } else this.options.room?.sendTo(actor.id, { type: 'economy', amount: 300, points: 250 });
  }

  private checkEliminations() {
    if (this.phase !== 'playing') return;
    const attackers = this.actors.filter((actor) => actor.team === this.attackingTeam && actor.alive).length;
    const defenders = this.actors.filter((actor) => actor.team !== this.attackingTeam && actor.alive).length;
    if (!defenders) this.endRound(this.attackingTeam, '\u00c9QUIPE \u00c9LIMIN\u00c9E');
    else if (!attackers && !this.bomb) this.endRound(otherTeam(this.attackingTeam), '\u00c9QUIPE \u00c9LIMIN\u00c9E');
  }

  private endRound(winner: Team, reason: string) {
    if (this.phase !== 'playing') return;
    this.phase = 'intermission';
    this.intermission = 3.2;
    this.firing = false;
    this.action = null;
    this.roundWinner = winner;
    if (winner === 'blue') this.blueScore++;
    else this.redScore++;
    this.actors.filter((actor) => !actor.bot).forEach((actor) => {
      const won = actor.team === winner;
      const stats = this.humanStats.get(actor.id);
      if (won && stats) stats.points += 200;
      if (actor.id === this.localId) {
        if (won) this.points += 200;
        this.roundCredits = Math.min(9000, this.roundCredits + (won ? 1000 : 700));
      } else this.options.room?.sendTo(actor.id, { type: 'economy', amount: won ? 1000 : 700, points: won ? 200 : 0 });
    });
    this.banner = winner === this.player.team ? 'MANCHE REMPORT\u00c9E' : 'MANCHE PERDUE';
    this.bannerSub = reason;
    this.bannerFor = 3.2;
    this.sound(winner === this.player.team ? 'win' : 'loss');
  }

  private updateRespawns(dt: number) {
    for (const actor of this.actors) {
      if (actor.alive) continue;
      actor.respawnIn -= dt;
      if (actor.id === this.localId) {
        if (actor.respawnIn <= 0) this.respawnPlayer();
        continue;
      }
      const threshold = actor.bot ? TDM_RESPAWN_DELAY : 0;
      if (actor.respawnIn > threshold) continue;
      if (actor.bot && Math.random() < 0.35) {
        const pick = (['spectre', 'viper', 'bulldog', 'phantom'] as WeaponId[])[Math.floor(Math.random() * 4)];
        actor.primaryId = pick;
        const primary = WEAPONS.find((weapon) => weapon.id === pick)!;
        actor.primaryAmmo = primary.magazine;
        actor.primaryReserve = primary.magazine * 3;
        actor.activeSlot = 'primary';
        actor.weaponId = pick;
        setOperatorWeapon(actor, pick, SKINS.find((skin) => skin.id === actor.skinId));
      }
      this.placeActor(actor);
      this.sendSnapshot();
    }
  }

  private finishTdm() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.firing = false;
    if (this.blueScore === this.redScore) {
      this.banner = 'MATCH NUL';
      this.bannerSub = `${this.blueScore} - ${this.redScore} / TEMPS ÉCOULÉ`;
    } else {
      const winner = this.blueScore > this.redScore ? 'blue' : 'red';
      this.banner = winner === this.player.team ? 'VICTOIRE' : 'DÉFAITE';
      this.bannerSub = `${this.blueScore} - ${this.redScore} / PREMIER À ${TDM_KILL_TARGET}`;
    }
    this.bannerFor = 4;
    this.sound(this.blueScore === this.redScore ? 'round' : (this.blueScore > this.redScore) === (this.player.team === 'blue') ? 'win' : 'loss');
    const finish = () => this.finishMatch();
    setTimeout(() => { if (!this.destroyed) finish(); }, 2500);
  }

  private resultFor(actor: Actor): MatchResult {
    const mode = this.options.mode;
    const ownScore = actor.team === 'blue' ? this.blueScore : this.redScore;
    const opponentScore = actor.team === 'blue' ? this.redScore : this.blueScore;
    const won = ownScore > opponentScore;
    const stats = this.humanStats.get(actor.id) ?? { kills: 0, points: 0 };
    return { won, blueScore: ownScore, redScore: opponentScore, kills: stats.kills, mode,
      points: stats.points + (won ? 500 : 100),
      credits: 150 + ownScore * 75 + stats.kills * 30 + (won ? 100 : 0) };
  }

  private finishMatch() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.actors.filter((actor) => !actor.bot && actor.id !== this.localId)
      .forEach((actor) => this.options.room?.sendTo(actor.id, { type: 'finish', result: this.resultFor(actor) }));
    this.options.onFinish(this.resultFor(this.player));
  }

  private direction(yaw: number, pitch: number) {
    return new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
  }

  private firePlayer() {
    this.ammo--;
    this.shotIn = this.weapon.rate;
    this.gunKick = 1;
    this.player.fireKick = 1;
    this.flashFor = 0.055;
    this.shake = Math.max(this.shake, 0.045);
    this.sound('shot');
    const origin = new THREE.Vector3(this.player.x, 1.57, this.player.z);
    let direction = this.direction(this.yaw, this.pitch);
    if (this.touchDevice) {
      const assisted = this.actors
        .filter((actor) => actor.team !== this.player.team && actor.alive && lineClear(this.player.x, this.player.z, actor.x, actor.z, 0, this.obstacles))
        .map((actor) => {
          const aim = new THREE.Vector3(actor.x, 1.2, actor.z).sub(origin).normalize();
          return { aim, dot: aim.dot(direction) };
        })
        .sort((a, b) => b.dot - a.dot)[0];
      if (assisted && assisted.dot > 0.985) direction = direction.lerp(assisted.aim, 0.65).normalize();
    }
    this.shootWeapon(this.player, origin, direction, this.weapon, this.isHost);
    if (!this.isHost) {
      this.options.room?.send({
        type: 'shoot',
        dx: direction.x,
        dy: direction.y,
        dz: direction.z,
        round: this.round,
      });
    }
  }

  private shootWeapon(shooter: Actor, origin: THREE.Vector3, direction: THREE.Vector3, weapon: Weapon, apply: boolean) {
    const pellets = weapon.pellets ?? 1;
    for (let i = 0; i < pellets; i++) {
      const spread = weapon.spread ?? 0;
      const ray = i === 0 ? direction : direction.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
      this.traceShot(shooter, origin, ray, weapon.damage, apply);
    }
  }

  private traceShot(shooter: Actor, origin: THREE.Vector3, direction: THREE.Vector3, damage: number, apply: boolean) {
    this.scene.updateMatrixWorld(true);
    this.raycaster.set(origin, direction);
    this.raycaster.far = 50;
    const targets = this.actors.filter((actor) => actor.alive && actor.team !== shooter.team).map((actor) => actor.hitbox);
    const hits = this.raycaster.intersectObjects([...this.colliders, ...targets], false);
    const hit = hits[0];
    const end = hit ? hit.point : origin.clone().addScaledVector(direction, 45);
    const actorId = hit?.object.userData.actorId as string | undefined;
    if (actorId) {
      const target = this.actors.find((actor) => actor.id === actorId);
      if (target && apply) this.damageActor(target, damage, shooter);
      this.spawnParticles(end, true);
    } else if (hit) this.spawnParticles(end, false);
    const start = origin.clone().addScaledVector(direction, 0.8);
    this.tracer(start, end, shooter.team === this.player.team ? 0xc8fff0 : 0xffbd82);
  }

  private botFire(shooter: Actor, target: Actor, range: number) {
    const weapon = WEAPONS.find((entry) => entry.id === shooter.weaponId) ?? WEAPONS[0];
    shooter.fireKick = 1;
    shooter.shotsLeft--;
    if (shooter.shotsLeft <= 0) {
      shooter.reloadTotal = weapon.reload + Math.random() * 0.25;
      shooter.reloadFor = shooter.reloadTotal;
    }
    const origin = new THREE.Vector3(shooter.x, 1.35, shooter.z);
    const destination = new THREE.Vector3(target.x, 1.2, target.z);
    const chance = clamp(0.25 - range * 0.006, 0.12, 0.26);
    const hit = Math.random() < chance;
    if (!hit) {
      destination.x += (Math.random() - 0.5) * 2.3;
      destination.y += (Math.random() - 0.5) * 1.2;
      destination.z += (Math.random() - 0.5) * 2.3;
    }
    this.tracer(origin, destination, shooter.team === this.player.team ? 0x9cebd6 : 0xffaf79);
    this.spawnParticles(origin, false, 3);
    if (hit) {
      this.spawnParticles(destination, true, 4);
      const damage = weapon.kind === 'shotgun' ? (range < 9 ? 21 : 9) : Math.max(9, Math.round(weapon.damage * 0.45));
      this.damageActor(target, damage, shooter);
    }
    if (distance(shooter, this.player) < 14 && Math.random() > 0.4) this.sound('distant');
  }

  private damageActor(target: Actor, amount: number, shooter: Actor) {
    if (!target.alive || this.phase !== 'playing') return;
    if (target.spawnProt > 0) return;
    const previousArmor = target.armor;
    const protection = ARMORS.find((armor) => armor.id === target.armorId) ?? ARMORS[0];
    const absorbed = Math.min(target.armor, amount * protection.absorption);
    target.armor = Math.max(0, target.armor - absorbed);
    target.health = Math.max(0, target.health - (amount - absorbed));
    const armorBroken = previousArmor > 0 && target.armor === 0;
    if (target.id === this.localId) {
      this.damageFor = 0.45;
      this.shake = 0.22;
      this.sound('hurt');
    }
    const killed = target.health <= 0;
    if (killed) {
      target.alive = false;
      target.diedThisRound = true;
      target.group.visible = false;
      if (this.actionFor(target)) this.action = null;
      this.spawnParticles(new THREE.Vector3(target.x, 1.2, target.z), true, 12);
      if (this.isTdm) {
        if (shooter.team === 'blue') this.blueScore++;
        else this.redScore++;
        target.respawnIn = TDM_RESPAWN_DELAY + 4;
      }
    }
    if (shooter.bot) return;
    const stats = this.humanStats.get(shooter.id);
    if (killed && stats) { stats.kills++; stats.points += 100; }
    if (shooter.id === this.localId) {
      this.hitFor = 0.17;
      this.sound(killed ? 'kill' : 'hit');
      if (killed) {
        this.kills++;
        this.points += 100;
        this.roundCredits = Math.min(9000, this.roundCredits + 200);
        this.feed = 'CIBLE NEUTRALIS\u00c9E  +100';
        this.feedFor = 2.3;
      } else if (armorBroken) {
        this.feed = 'ARMURE BRIS\u00c9E';
        this.feedFor = 1.5;
      }
    } else this.options.room?.sendTo(shooter.id, { type: 'feedback', killed, armorBroken });
  }

  private tracer(start: THREE.Vector3, end: THREE.Vector3, color: number) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  private spawnParticles(position: THREE.Vector3, hit: boolean, count = 7) {
    if (this.particles.length > 110) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, hit ? this.hitMaterial : this.sparkMaterial);
      mesh.position.copy(position);
      const life = 0.18 + Math.random() * 0.3;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3.2, Math.random() * 2.4, (Math.random() - 0.5) * 3.2),
        life,
        maxLife: life,
      });
    }
  }

  private updateEffects(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.velocity.y -= dt * 5;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life / particle.maxLife));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.life -= dt;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        (tracer.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.blastEffects.length - 1; i >= 0; i--) {
      const effect = this.blastEffects[i];
      effect.life -= dt;
      const progress = 1 - Math.max(0, effect.life) / effect.maxLife;
      const fade = 1 - progress;
      effect.mesh.scale.setScalar(0.12 + progress * effect.size);
      effect.ring.scale.setScalar(0.18 + progress * effect.size * 1.35);
      effect.ring.position.y += dt * 0.16;
      (effect.mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.48;
      (effect.ring.material as THREE.MeshBasicMaterial).opacity = fade * 0.82;
      if (effect.life <= 0) {
        this.scene.remove(effect.mesh, effect.ring);
        effect.mesh.geometry.dispose();
        effect.ring.geometry.dispose();
        (effect.mesh.material as THREE.Material).dispose();
        (effect.ring.material as THREE.Material).dispose();
        this.blastEffects.splice(i, 1);
      }
    }
  }

  private updateVisuals(dt: number) {
    for (const actor of this.actors) {
      actor.group.position.set(actor.x, 0, actor.z);
      actor.group.rotation.y = actor.yaw;
      actor.group.visible = actor.alive && actor.id !== this.localId;
      if (actor.id !== this.localId && (!this.isHost || !actor.bot)) actor.reloadFor = Math.max(0, actor.reloadFor - dt);
      const stride = actor.moving ? Math.sin(actor.walk) : 0;
      const blend = Math.min(1, dt * 9);
      const reloadPose = actor.reloadFor > 0 ? Math.sin((1 - actor.reloadFor / actor.reloadTotal) * Math.PI) : 0;
      actor.leftLeg.rotation.x += (stride * 0.48 - actor.leftLeg.rotation.x) * blend;
      actor.rightLeg.rotation.x += (-stride * 0.48 - actor.rightLeg.rotation.x) * blend;
      actor.leftShin.rotation.x += (Math.max(0, -stride) * 0.5 - actor.leftShin.rotation.x) * blend;
      actor.rightShin.rotation.x += (Math.max(0, stride) * 0.5 - actor.rightShin.rotation.x) * blend;
      actor.leftArm.rotation.x += (1.16 - reloadPose * 0.52 - stride * 0.07 - actor.leftArm.rotation.x) * blend;
      actor.rightArm.rotation.x += (1.16 - reloadPose * 0.14 + stride * 0.05 - actor.fireKick * 0.09 - actor.rightArm.rotation.x) * blend;
      actor.leftArm.rotation.z += (0.3 + reloadPose * 0.2 - actor.leftArm.rotation.z) * blend;
      actor.rightArm.rotation.z += (-0.3 - reloadPose * 0.05 - actor.rightArm.rotation.z) * blend;
      actor.leftForearm.rotation.x += (-0.15 - reloadPose * 0.6 - actor.leftForearm.rotation.x) * blend;
      actor.rightForearm.rotation.x += (-0.15 + reloadPose * 0.12 - actor.rightForearm.rotation.x) * blend;
      actor.upperBody.position.y = actor.moving ? Math.abs(stride) * 0.018 : Math.sin(this.elapsed * 1.8 + actor.index) * 0.004;
      actor.upperBody.rotation.z = stride * 0.035;
      actor.upperBody.rotation.x = (actor.moving ? 0.045 : 0) + reloadPose * 0.035;
      actor.head.rotation.y += ((actor.targetId ? 0 : Math.sin(this.elapsed * 0.8 + actor.index) * 0.1) - actor.head.rotation.y) * blend;
      actor.rifle.rotation.z = -reloadPose * 0.25;
      actor.rifle.position.z = -0.39 + actor.fireKick * 0.035;
      actor.fireFlash.visible = actor.fireKick > 0.72;
      actor.fireKick = Math.max(0, actor.fireKick - dt * 6);
    }
    const player = this.player;
    const bob = player.moving && player.alive ? Math.sin(player.walk) * 0.025 : 0;
    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(player.x + shakeX, (player.alive ? 1.57 : 0.65) + bob + shakeY, player.z);
    this.camera.rotation.set(this.pitch + this.gunKick * 0.012, this.yaw, 0, 'YXZ');
    this.gun.visible = player.alive;
    const swapProgress = smoothRange(1 - this.swapFor / 0.42, 0, 1);
    const swapDip = (1 - swapProgress) * 0.48;
    const throwProgress = this.grenadeThrowFor > 0 ? 1 - this.grenadeThrowFor / 0.56 : 0;
    const throwPose = Math.sin(throwProgress * Math.PI);
    const throwSnap = Math.sin(Math.min(1, throwProgress * 1.35) * Math.PI);
    const reloadProgress = this.reloadFor > 0 ? clamp(1 - this.reloadFor / this.weapon.reload, 0, 1) : 1;
    const reloadPose = smoothRange(reloadProgress, 0, 0.18) * (1 - smoothRange(reloadProgress, 0.8, 1));
    const magazineOut = smoothRange(reloadProgress, 0.12, 0.34) * (1 - smoothRange(reloadProgress, 0.52, 0.76));
    const handReach = smoothRange(reloadProgress, 0.05, 0.2) * (1 - smoothRange(reloadProgress, 0.76, 0.96));
    const boltPull = smoothRange(reloadProgress, 0.76, 0.84) * (1 - smoothRange(reloadProgress, 0.88, 0.97));
    this.magazine.position.set(this.magazineHome.x - 0.06 * magazineOut, this.magazineHome.y - 0.17 * magazineOut, this.magazineHome.z + 0.04 * magazineOut);
    this.magazine.rotation.z = -0.18 * magazineOut;
    this.offhand.position.set(0.09 * handReach - 0.13 * throwPose, -0.09 * handReach - 0.04 * magazineOut - 0.13 * throwPose, this.handTravel * handReach + 0.24 * throwSnap);
    this.offhand.rotation.z = -0.16 * handReach - 0.42 * throwPose;
    this.bolt.position.z = this.boltHomeZ + boltPull * 0.11;
    this.gun.position.x = (this.touchDevice ? 0.2 : 0.31) - (this.pistolView ? 0.035 : 0) - reloadPose * 0.1 + (player.moving ? Math.cos(player.walk * 0.5) * 0.018 : 0);
    this.gun.position.y = -0.29 + bob * 0.8 + reloadPose * 0.13 - swapDip - throwPose * 0.07;
    this.gun.position.z = this.viewZ + this.gunKick * 0.09 + swapDip * 0.36;
    this.gun.rotation.x = this.gunKick * 0.12 + reloadPose * 0.18 + throwPose * 0.16;
    this.gun.rotation.y = -reloadPose * 0.12 - throwPose * 0.08;
    this.gun.rotation.z = -reloadPose * 0.34 + swapDip * 0.72 + throwPose * 0.12;
    if (this.bomb) {
      const site = SITES.find((entry) => entry.id === this.bomb?.site)!;
      this.bombMesh.position.set(site.x, 0, site.z);
      this.bombMesh.visible = true;
      const light = this.bombMesh.children[1] as THREE.Mesh;
      (light.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(this.elapsed * (this.bomb.time < 10 ? 14 : 6)) > 0 ? 0xff6943 : 0x692d20);
    } else this.bombMesh.visible = false;
  }

  private publishHud() {
    const player = this.player;
    const attacking = this.attackingTeam === player.team;
    let prompt = '';
    if (!this.isTdm && player.alive && this.phase === 'playing' && !this.action) {
      if (attacking && !this.bomb && SITES.some((site) => distance(player, site) < 2.6)) prompt = 'POSER LA CHARGE';
      if (!attacking && this.bomb && distance(player, SITES.find((site) => site.id === this.bomb?.site)!) < 2.6) prompt = 'D\u00c9SAMORCER LA CHARGE';
    }
    const ownAction = this.action?.actorId === this.localId ? this.action : null;
    const markers = this.isTdm ? [] : SITES.map((site) => {
      const projected = new THREE.Vector3(site.x, 2.4, site.z).project(this.camera);
      return {
        id: site.id,
        x: (projected.x * 0.5 + 0.5) * 100,
        y: (-projected.y * 0.5 + 0.5) * 100,
        visible: projected.z < 1 && projected.x > -0.92 && projected.x < 0.92 && projected.y > -0.8 && projected.y < 0.8,
        distance: Math.round(distance(player, site)),
      };
    });
    const sidearm = WEAPONS.find((entry) => entry.id === player.sidearmId) ?? WEAPONS[0];
    const primary = player.primaryId ? WEAPONS.find((entry) => entry.id === player.primaryId) ?? null : null;
    this.options.onHud({
      phase: this.phase,
      mode: this.options.mode,
      health: Math.ceil(player.health),
      armor: Math.ceil(player.armor),
      armorId: this.phase === 'buy' ? this.selectedArmor : player.armorId,
      armorCapacity: (ARMORS.find((armor) => armor.id === (this.phase === 'buy' ? this.selectedArmor : player.armorId)) ?? ARMORS[0]).capacity,
      ammo: this.ammo,
      reserve: this.reserve,
      reloading: this.reloadFor > 0,
      reloadProgress: this.reloadFor > 0 ? clamp(1 - this.reloadFor / this.weapon.reload, 0, 1) : 0,
      round: this.round,
      overtime: this.round >= 14,
      blueScore: player.team === 'blue' ? this.blueScore : this.redScore,
      redScore: player.team === 'blue' ? this.redScore : this.blueScore,
      time: Math.ceil(this.isTdm ? this.tdmTime : this.time),
      buyTime: Math.ceil(this.buyTime),
      roundCredits: this.roundCredits,
      weaponId: this.weapon.id,
      weaponName: this.weapon.name,
      sidearmId: player.sidearmId,
      sidearmName: sidearm.name,
      primaryId: player.primaryId,
      primaryName: primary ? primary.name : '—',
      activeSlot: player.activeSlot,
      fragLeft: player.fragLeft,
      flashLeft: player.flashLeft,
      respawnIn: this.isTdm && !player.alive && this.phase === 'playing' ? Math.max(0, player.respawnIn) : 0,
      flashBlind: clamp(this.flashWhite, 0, 1),
      ready: this.localReady,
      attacking,
      bombTime: this.bomb ? Math.ceil(this.bomb.time) : null,
      bombSite: this.bomb?.site ?? null,
      prompt,
      actionProgress: ownAction ? ownAction.time / ownAction.total : 0,
      actionLabel: ownAction ? (ownAction.kind === 'plant' ? 'POSE DE LA CHARGE' : 'D\u00c9SAMOR\u00c7AGE') : '',
      hit: this.hitFor > 0,
      damaged: this.damageFor > 0,
      kills: this.kills,
      points: this.points,
      banner: this.bannerFor > 0 ? this.banner : '',
      bannerSub: this.bannerFor > 0 ? this.bannerSub : '',
      aliveBlue: this.actors.filter((actor) => actor.team === player.team && actor.alive).length,
      aliveRed: this.actors.filter((actor) => actor.team !== player.team && actor.alive).length,
      dead: !player.alive,
      locked: this.touchDevice || document.pointerLockElement === this.renderer.domElement,
      markers,
      feed: this.feedFor > 0 ? this.feed : '',
    });
  }

  private drawMinimap() {
    const canvas = this.options.minimap;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const scale = size / 70;
    const point = (x: number, z: number) => ({ x: size / 2 + x * scale, y: size / 2 + z * scale });
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(10, 21, 25, .84)';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(145, 185, 177, .08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += size / 5) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    ctx.fillStyle = '#516461';
    this.obstacles.forEach((obstacle) => {
      const p = point(obstacle.x - obstacle.w / 2, obstacle.z - obstacle.d / 2);
      ctx.fillRect(p.x, p.y, obstacle.w * scale, obstacle.d * scale);
    });
    for (const site of SITES) {
      const p = point(site.x, site.z);
      ctx.strokeStyle = this.bomb?.site === site.id ? '#ff9168' : '#81ddcb';
      ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
      ctx.fillStyle = '#e9f4e9';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(site.id, p.x, p.y + 0.5);
    }
    for (const actor of this.actors) {
      if (!actor.alive || actor.id === this.localId) continue;
      if (actor.team !== this.player.team) {
        const dist = distance(actor, this.player);
        const dx = (actor.x - this.player.x) / Math.max(dist, 0.1);
        const dz = (actor.z - this.player.z) / Math.max(dist, 0.1);
        const facing = -Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz;
        if (dist > 20 || facing < 0.3 || !lineClear(this.player.x, this.player.z, actor.x, actor.z, 0, this.obstacles)) continue;
      }
      const p = point(actor.x, actor.z);
      ctx.fillStyle = actor.team === this.player.team ? '#83e7d3' : '#ff9c74';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.7, 0, Math.PI * 2); ctx.fill();
    }
    const p = point(this.player.x, this.player.z);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-this.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.2, 4); ctx.lineTo(0, 2.2); ctx.lineTo(-4.2, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  private ensureAudio() {
    if (!this.options.sound) return;
    try {
      if (!this.audio) this.audio = new AudioContext();
      if (this.audio.state === 'suspended') void this.audio.resume();
    } catch {
      this.audio = null;
    }
  }

  private sound(kind: 'shot' | 'distant' | 'hit' | 'kill' | 'hurt' | 'reload' | 'mag-out' | 'mag-in' | 'bolt' | 'round' | 'action' | 'plant' | 'win' | 'loss' | 'swap' | 'throw' | 'boom' | 'flashbang') {
    if (!this.options.sound || !this.audio || this.audio.state !== 'running') return;
    const context = this.audio;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const config: Record<typeof kind, [number, number, number, OscillatorType]> = {
      shot: [125, 0.09, 0.09, 'sawtooth'],
      distant: [100, 0.055, 0.025, 'square'],
      hit: [680, 0.07, 0.045, 'sine'],
      kill: [850, 0.17, 0.06, 'triangle'],
      hurt: [100, 0.19, 0.09, 'sawtooth'],
      swap: [520, 0.07, 0.035, 'square'],
      throw: [300, 0.12, 0.03, 'sine'],
      boom: [70, 0.5, 0.12, 'sawtooth'],
      flashbang: [1200, 0.3, 0.05, 'sine'],
      reload: [420, 0.11, 0.035, 'square'],
      'mag-out': [220, 0.07, 0.04, 'square'],
      'mag-in': [340, 0.1, 0.05, 'triangle'],
      bolt: [680, 0.065, 0.035, 'square'],
      round: [440, 0.18, 0.05, 'triangle'],
      action: [520, 0.1, 0.035, 'sine'],
      plant: [750, 0.25, 0.06, 'triangle'],
      win: [660, 0.35, 0.06, 'triangle'],
      loss: [180, 0.35, 0.05, 'sawtooth'],
    };
    const [frequency, duration, volume, wave] = config[kind];
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * (kind === 'kill' || kind === 'win' ? 1.5 : 0.55)), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private sendSnapshot() {
    const snapshot: Snapshot = {
      round: this.round,
      phase: this.phase,
      blueScore: this.blueScore,
      redScore: this.redScore,
      time: this.time,
      buyTime: this.buyTime,
      bomb: this.bomb,
      action: this.action,
      banner: this.bannerFor > 0 ? this.banner : '',
      bannerSub: this.bannerFor > 0 ? this.bannerSub : '',
      roundWinner: this.roundWinner,
      actors: this.actors.map((actor) => ({
        id: actor.id, x: actor.x, z: actor.z, yaw: actor.yaw, health: actor.health, armor: actor.armor, armorId: actor.armorId, alive: actor.alive,
        reloadFor: actor.id === this.localId ? this.reloadFor : actor.reloadFor,
        reloadTotal: actor.id === this.localId ? this.weapon.reload : actor.reloadTotal,
        fireKick: actor.fireKick,
        weaponId: actor.weaponId, skinId: actor.skinId, bot: actor.bot,
        sidearmId: actor.sidearmId, primaryId: actor.primaryId, activeSlot: actor.activeSlot,
      })),
    };
    this.options.room?.send({ type: 'snapshot', snapshot });
  }

  private receiveNetwork = (message: NetworkMessage) => {
    if (message.type === 'host-left') {
      if (!this.isHost) this.options.onDisconnect();
      return;
    }
    if (message.type === 'peer-left' && this.isHost && typeof message.from === 'string') {
      const actor = this.actors.find((entry) => entry.id === message.from);
      if (actor) actor.bot = true;
      this.banner = 'JOUEUR D\u00c9CONNECT\u00c9';
      this.bannerSub = 'UN AGENT IA PREND LE RELAIS';
      this.bannerFor = 3;
      return;
    }
    if (!this.isHost && message.type === 'host-pause') {
      this.hostPaused = Boolean(message.paused);
      this.firing = false;
      this.options.onHostPause(this.hostPaused);
      return;
    }
    if (this.isHost) {
      const actor = this.actors.find((entry) => entry.id === message.from && !entry.bot && entry.id !== this.localId);
      if (!actor) return;
      if (message.type === 'buy-choice' && message.round === this.round &&
        (this.phase === 'buy' || (this.phase === 'playing' && performance.now() < this.buyGraceUntil && actor.health === 100))) {
        const skin = SKINS.find((entry) => entry.id === message.skinId) ?? SKINS[0];
        const armor = ARMORS.find((entry) => entry.id === message.armorId);
        if (armor && actor.armorId !== armor.id) {
          actor.armorId = armor.id;
          actor.armor = armor.capacity;
        }
        const sidearm = WEAPONS.find((entry) => entry.id === message.sidearmId);
        const primary = message.primaryId ? WEAPONS.find((entry) => entry.id === message.primaryId) ?? null : null;
        if (sidearm && isPistolWeapon(sidearm.kind)) {
          actor.sidearmId = sidearm.id;
          actor.sidearmAmmo = sidearm.magazine;
          actor.sidearmReserve = sidearm.magazine * 3;
        }
        if (message.primaryId && !primary) { /* ignore invalid primary */ }
        else {
          actor.primaryId = primary ? primary.id : null;
          if (primary) {
            actor.primaryAmmo = primary.magazine;
            actor.primaryReserve = primary.magazine * 3;
          }
        }
        const slot: WeaponSlot = message.activeSlot === 'primary' && actor.primaryId ? 'primary' : 'sidearm';
        actor.activeSlot = slot;
        const activeId = slot === 'primary' ? actor.primaryId! : actor.sidearmId;
        if (actor.weaponId !== activeId || actor.skinId !== skin.id) {
          actor.weaponId = activeId;
          actor.skinId = skin.id;
          actor.shotsLeft = (WEAPONS.find((entry) => entry.id === activeId) ?? WEAPONS[0]).magazine;
          setOperatorWeapon(actor, actor.weaponId, skin);
        }
        return;
      }
      if (message.type === 'swap' && message.round === this.round && this.phase === 'playing' && actor.alive) {
        const slot: WeaponSlot = message.activeSlot === 'primary' && actor.primaryId ? 'primary' : 'sidearm';
        actor.activeSlot = slot;
        const activeId = slot === 'primary' ? actor.primaryId! : actor.sidearmId;
        actor.weaponId = activeId;
        actor.fireKick = 1;
        setOperatorWeapon(actor, activeId, SKINS.find((skin) => skin.id === actor.skinId));
        return;
      }
      if (message.type === 'grenade' && message.round === this.round && this.phase === 'playing' && actor.alive &&
        (message.kind === 'frag' || message.kind === 'flash') &&
        typeof message.dx === 'number' && typeof message.dy === 'number' && typeof message.dz === 'number' &&
        [message.dx, message.dy, message.dz].every(Number.isFinite)) {
        if ((message.kind === 'frag' ? actor.fragLeft : actor.flashLeft) <= 0) return;
        const direction = new THREE.Vector3(message.dx, message.dy, message.dz).normalize();
        const id = this.spawnGrenade(actor, message.kind, direction);
        const grenade = this.grenades.find((entry) => entry.id === id);
        if (grenade) {
          this.options.room?.send({
            type: 'grenade-thrown', id, kind: message.kind, round: this.round,
            x: actor.x, z: actor.z, dx: direction.x, dy: direction.y, dz: direction.z,
          });
        }
        return;
      }
      if (!actor.alive || this.phase !== 'playing' || this.paused) return;
      if (message.type === 'position' && message.round === this.round &&
        typeof message.x === 'number' && typeof message.z === 'number' && typeof message.yaw === 'number') {
        const x = clamp(message.x, -32, 32);
        const z = clamp(message.z, -31.5, 31.5);
        if (!blocked(x, z, 0.55, this.obstacles)) {
          actor.moving = Math.hypot(actor.x - x, actor.z - z) > 0.02;
          actor.x = x;
          actor.z = z;
          actor.yaw = message.yaw;
          if (actor.moving) actor.walk += 0.8;
        }
      } else if (message.type === 'shoot' && message.round === this.round && typeof message.dx === 'number' && typeof message.dy === 'number' && typeof message.dz === 'number') {
        if (![message.dx, message.dy, message.dz].every(Number.isFinite)) return;
        actor.fireKick = 1;
        const direction = new THREE.Vector3(message.dx, message.dy, message.dz).normalize();
        const weapon = WEAPONS.find((entry) => entry.id === actor.weaponId) ?? WEAPONS[0];
        this.shootWeapon(actor, new THREE.Vector3(actor.x, 1.57, actor.z), direction, weapon, true);
      } else if (message.type === 'reload' && message.round === this.round && typeof message.duration === 'number') {
        actor.reloadTotal = clamp(message.duration, 0.8, 2.5);
        actor.reloadFor = actor.reloadTotal;
      } else if (message.type === 'interact' && message.round === this.round) this.tryAction(actor);
      return;
    }
    if (message.type === 'snapshot' && message.snapshot && typeof message.snapshot === 'object') {
      const snapshot = message.snapshot as Snapshot;
      if (!Array.isArray(snapshot.actors) || typeof snapshot.round !== 'number') return;
      if (snapshot.round !== this.round) this.startRound(snapshot.round);
      this.phase = snapshot.phase;
      this.blueScore = snapshot.blueScore;
      this.redScore = snapshot.redScore;
      this.time = snapshot.time;
      this.buyTime = snapshot.buyTime;
      this.bomb = snapshot.bomb;
      this.action = snapshot.action;
      this.roundWinner = snapshot.roundWinner;
      this.banner = snapshot.phase === 'intermission' && snapshot.roundWinner && snapshot.banner
        ? (snapshot.roundWinner === this.player.team ? 'MANCHE REMPORT\u00c9E' : 'MANCHE PERDUE') : snapshot.banner;
      this.bannerSub = snapshot.banner === 'CHARGE POS\u00c9E' && snapshot.bomb
        ? `SITE ${snapshot.bomb.site} / ${this.attackingTeam === this.player.team ? 'PROT\u00c9GEZ' : 'D\u00c9SAMORCEZ'} LA CHARGE`
        : snapshot.phase === 'playing' && snapshot.banner && snapshot.banner !== 'CHARGE POS\u00c9E'
          ? (this.attackingTeam === this.player.team ? 'ATTAQUEZ LES SITES A OU B' : 'D\u00c9FENDEZ LES SITES A ET B') : snapshot.bannerSub;
      this.bannerFor = snapshot.banner ? 0.2 : 0;
      if (snapshot.phase === 'playing' && this.phase !== 'playing' && this.isTdm) {
        this.grenades.forEach((grenade) => this.scene.remove(grenade.mesh));
        this.grenades = [];
      }
      snapshot.actors.forEach((data) => {
        const actor = this.actors.find((entry) => entry.id === data.id);
        if (!actor) return;
        actor.sidearmId = data.sidearmId;
        actor.primaryId = data.primaryId;
        actor.activeSlot = data.primaryId && data.activeSlot === 'primary' ? 'primary' : 'sidearm';
        const activeId = actor.activeSlot === 'primary' ? actor.primaryId! : actor.sidearmId;
        if (actor.weaponId !== activeId || actor.skinId !== data.skinId) {
          actor.weaponId = activeId;
          actor.skinId = data.skinId;
          actor.shotsLeft = (WEAPONS.find((entry) => entry.id === activeId) ?? WEAPONS[0]).magazine;
          setOperatorWeapon(actor, actor.weaponId, SKINS.find((skin) => skin.id === actor.skinId));
        }
        actor.bot = data.bot;
        if (actor.id === this.localId) {
          if (data.health < actor.health || (snapshot.phase !== 'buy' && data.armor < actor.armor)) {
            this.damageFor = 0.45;
            this.shake = 0.22;
            this.sound('hurt');
          }
        } else {
          actor.targetX = data.x;
          actor.targetZ = data.z;
          actor.yaw = data.yaw;
          actor.reloadFor = typeof data.reloadFor === 'number' ? data.reloadFor : 0;
          actor.reloadTotal = typeof data.reloadTotal === 'number' ? Math.max(0.1, data.reloadTotal) : 1.6;
          actor.fireKick = typeof data.fireKick === 'number' ? data.fireKick : 0;
        }
        if (actor.id !== this.localId || snapshot.phase !== 'buy') {
          const armor = ARMORS.find((entry) => entry.id === data.armorId) ?? ARMORS[0];
          actor.armorId = armor.id;
          actor.armor = typeof data.armor === 'number' ? clamp(data.armor, 0, armor.capacity) : 0;
          if (actor.id === this.localId) this.selectedArmor = armor.id;
        }
        actor.health = data.health;
        actor.alive = data.alive;
      });
    } else if (message.type === 'feedback') {
      this.hitFor = 0.18;
      this.sound(message.killed ? 'kill' : 'hit');
      if (message.killed) {
        this.kills++;
        this.points += 100;
        this.roundCredits = Math.min(9000, this.roundCredits + 200);
        this.feed = 'CIBLE NEUTRALIS\u00c9E  +100';
        this.feedFor = 2.3;
      } else if (message.armorBroken) {
        this.feed = 'ARMURE BRIS\u00c9E';
        this.feedFor = 1.5;
      }
    } else if (message.type === 'grenade-thrown' && (message.kind === 'frag' || message.kind === 'flash') &&
      typeof message.x === 'number' && typeof message.z === 'number' &&
      typeof message.dx === 'number' && typeof message.dy === 'number' && typeof message.dz === 'number') {
      if (typeof message.id === 'string' && this.grenades.some((grenade) => grenade.id === message.id)) return;
      const owner = this.actors.find((actor) => actor.id === message.from);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(message.kind === 'frag' ? 0.09 : 0.075, 8, 6),
        new THREE.MeshStandardMaterial({ color: message.kind === 'frag' ? 0x3d4a35 : 0xcfd8cf, roughness: 0.6 }),
      );
      const pos = new THREE.Vector3(message.x, 1.5, message.z);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.grenades.push({
        id: typeof message.id === 'string' ? message.id : `remote-${this.grenadeSeq++}`,
        kind: message.kind, ownerId: typeof message.from === 'string' ? message.from : '',
        team: owner?.team ?? this.player.team,
        pos, vel: new THREE.Vector3(message.dx, message.dy, message.dz).normalize().multiplyScalar(11).add(new THREE.Vector3(0, 3.5, 0)),
        fuse: message.kind === 'frag' ? 1.6 : 1.1, mesh,
      });
    } else if (message.type === 'grenade-exploded' && (message.kind === 'frag' || message.kind === 'flash') &&
      typeof message.x === 'number' && typeof message.z === 'number') {
      const index = typeof message.id === 'string' ? this.grenades.findIndex((grenade) => grenade.id === message.id) : -1;
      const y = typeof message.y === 'number' ? message.y : 0.5;
      if (index >= 0) {
        const [grenade] = this.grenades.splice(index, 1);
        this.scene.remove(grenade.mesh);
        grenade.mesh.geometry.dispose();
        (grenade.mesh.material as THREE.Material).dispose();
        grenade.pos.set(message.x, y, message.z);
        this.explodeGrenade(grenade, false);
      } else {
        this.explodeGrenade({
          id: '', kind: message.kind, ownerId: '', team: this.player.team,
          pos: new THREE.Vector3(message.x, y, message.z), vel: new THREE.Vector3(), fuse: 0,
          mesh: new THREE.Mesh(),
        }, false);
      }
    } else if (message.type === 'economy' && typeof message.amount === 'number') {
      this.roundCredits = Math.min(9000, this.roundCredits + message.amount);
      if (typeof message.points === 'number') this.points += message.points;
    } else if (message.type === 'finish' && message.result && typeof message.result === 'object') {
      this.phase = 'finished';
      this.options.onFinish(message.result as MatchResult);
    }
  };

  public destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('mousemove', this.mouseMove);
    window.removeEventListener('mouseup', this.mouseUp);
    window.removeEventListener('blur', this.blur);
    this.renderer.domElement.removeEventListener('mousedown', this.mouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.preventContext);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.unsubscribe?.();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if ((material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial) && material.map) material.map.dispose();
        material.dispose();
      });
    });
    this.particleGeometry.dispose();
    this.sparkMaterial.dispose();
    this.hitMaterial.dispose();
    if (this.scene.background instanceof THREE.Texture) this.scene.background.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (this.audio) void this.audio.close();
  }
}