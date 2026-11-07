// ─────────────────────────────────────────────────────────────
//  VALENCE — Moteur de jeu (rendu, tir, IA, manches, économie)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildWorld, type WorldRefs } from './world';
import { buildNavGrid, findPath, Bot, type BotCtx, type Target } from './agents';
import { Player, ViewModel } from './player';
import { WEAPONS, SHIELD_LIGHT, SHIELD_HEAVY, isPrimary } from './weapons';
import { getMap, BUY_BARRIER, BOUNDS, BOT_NAMES, BOT_COLORS, ALLY_NAMES, ALLY_COLORS, type MapDef } from './maps';
import { store, type Settings, type WeaponId, type FeedItem, type Side } from './store';
import { sfx } from './audio';
import { Spike, PLANT_TIME, DEFUSE_TIME, DEFUSE_HALF, PLANT_RADIUS } from './spike';
import { touchState } from '../ui/TouchControls';
import { Net, type PlayerState } from './net';
import { AGENTS, ABILITIES, SKINS, type AgentId, type Profile } from './agentsData';
import { buildAgent, type AgentBuild } from './models';

export const liveFrame = {
  px: 0, pz: 0, pyaw: 0,
  bots: [] as { x: number; z: number; seen: boolean }[],
  allies: [] as { x: number; z: number; yaw: number }[],
  scanned: false,
};

interface Tracer { mesh: THREE.Line; life: number; maxLife: number }
interface Particle { vel: THREE.Vector3; life: number; spin: number }

const ROUND_TIME = 100;
const BUY_TIME = 18;
const PCOUNT = 420;

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world!: WorldRefs;
  private map: MapDef;
  private player = new Player();
  private vm!: ViewModel;
  private bots: Bot[] = [];        // ennemis
  private allies: Bot[] = [];      // coéquipiers IA
  private playerTarget: Target = { pos: new THREE.Vector3(), alive: true, isPlayer: true, bot: null };
  private raf = 0;
  private lastT = 0;
  private disposed = false;

  // gameplay
  private phase: 'buy' | 'live' | 'roundEnd' | 'halftime' | 'matchEnd' = 'buy';
  private phaseT = 0;
  private inventory = new Map<WeaponId, { ammo: number; reserve: number }>();
  private pistolSlot: WeaponId = 'classic';
  private primarySlot: WeaponId | null = null;
  private current: WeaponId = 'classic';
  private bloom = 0;
  private recoilP = 0;
  private recoilYawP = 0;
  private lastShotT = -9;
  private mouseHeld = false;
  private semiLatch = false;
  private boltTimer = 0;
  private reloadTimer = 0;
  private credits = 800;
  private roundKills = 0;
  private kills = 0;
  private deaths = 0;
  private round = 1;
  private score: [number, number] = [0, 0];
  private targetWins = 4;
  private side: Side = 'attack';          // camp du joueur
  private roundsPlayed = 0;
  private swapAfter = 4;                   // changement de camp à la mi-match
  private spike = new Spike();
  // ─── multijoueur ───
  net: Net | null = null;
  private remotes = new Map<string, {
    m: AgentBuild; s: PlayerState;
    target: THREE.Vector3; targetYaw: number; legPhase: number;
    hit: THREE.Mesh[];
  }>();
  private netWorldAcc = 0;
  // ─── pouvoirs ───
  private agent: AgentId = 'embre';
  private abCharges = 0; private abCd = 0;
  private ultCharges = 0; private ultCd = 0;
  private dashT = 0; private dashDir = new THREE.Vector3();
  private healT = 0; private shieldT = 0; private scanT = 0;
  private flashT = 0;
  private fx: { mesh: THREE.Object3D; life: number; kind: string; r: number }[] = [];
  private turret: { g: THREE.Group; life: number; cd: number } | null = null;
  profile: Profile | null = null;
  onMatchEnd: ((win: boolean, kills: number, rounds: number) => void) | null = null;
  private remoteColors = ['#4df3d3', '#5ec8ff', '#7affa0', '#c6f24d', '#ffd25d'];
  private spikeCarrier: Bot | null = null; // null + side attack = porté par le joueur
  private holdingUse = false;              // touche d'interaction maintenue
  private playerAlive = true;
  private deathT = 0;
  private feedId = 0;
  private bannerKey = 0;
  private shake = 0;
  private landDip = 0;
  private hurtKick = 0;
  private leanRoll = 0;
  private deathCam = 0;
  private settings: Settings;
  private t = 0;
  private stepPhase = 0;
  private lockCooldown = 0;
  private wantLock = false;

  // fps
  private fpsAcc = 0;
  private fpsFrames = 0;

  // FX
  private tracers: Tracer[] = [];
  private pGeo!: THREE.BufferGeometry;
  private pData: Particle[] = [];
  private pActive = 0;
  private muzzle!: THREE.Sprite;
  private muzzleLight!: THREE.PointLight;
  private decals: THREE.Mesh[] = [];
  private decalI = 0;
  private raycaster = new THREE.Raycaster();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private allWalls: THREE.Object3D[] = [];

  private onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
  private onKeyUp = (e: KeyboardEvent) => this.keyUp(e);
  private onMouseMove = (e: MouseEvent) => this.mouseMove(e);
  private onMouseDown = (e: MouseEvent) => {
    if (!store.getSnapshot().pointerLocked) return;
    if (e.button === 0) this.mouseHeld = true;
    if (e.button === 2) this.adsToggle();
  };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) { this.mouseHeld = false; this.semiLatch = false; } };
  private onWheel = (e: WheelEvent) => {
    if (!store.getSnapshot().pointerLocked) return;
    this.switchSlot(this.current === this.pistolSlot ? 2 : 1);
    e.preventDefault();
  };
  private onLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    store.set({ pointerLocked: locked });
    if (locked) {
      store.set({ paused: false });
      this.wantLock = false;
    } else {
      this.lockCooldown = 1.35;              // Chrome impose un délai avant re-verrouillage
      this.mouseHeld = false;
      // déverrouillage volontaire pour la boutique → pas de pause
      if (!store.getSnapshot().buyOpen && (this.phase === 'live' || this.phase === 'buy')) {
        store.set({ paused: true });
      }
    }
  };
  private onLockError = () => { this.lockCooldown = 1.0; };
  private onResize = () => this.resize();
  private onCtx = (e: Event) => e.preventDefault();

  constructor(private canvas: HTMLCanvasElement, s: Settings) {
    this.settings = s;
    this.map = getMap(s.mapId);
    this.targetWins = s.matchWins;
    this.init();
  }

  // ══════════ INIT ══════════
  private init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.applyQuality();

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.04, 600);
    this.scene.add(this.camera);
    this.resize();

    this.world = buildWorld(this.scene, this.map, this.settings.quality);
    this.renderer.toneMappingExposure = this.map.theme.exposure;
    this.allWalls = this.world.wallMeshes;
    buildNavGrid(this.world.colliders);
    this.vm = new ViewModel();
    this.vm.resize(window.innerWidth / window.innerHeight);   // resize() a eu lieu avant sa création
    this.vm.setHandsVisible(this.settings.viewmodel);
    this.vm.equip('classic');

    for (let i = 0; i < 5; i++) {
      const b = new Bot(BOT_NAMES[i], BOT_COLORS[i], 'enemy', this.map.anchors[i]);
      b.group.visible = false;
      this.scene.add(b.group);
      this.bots.push(b);
    }
    const markTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d')!;
      g.strokeStyle = '#4df3d3'; g.lineWidth = 7; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(12, 40); g.lineTo(32, 18); g.lineTo(52, 40); g.stroke();
      return c;
    })());
    markTex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < ALLY_NAMES.length; i++) {
      const a = new Bot(ALLY_NAMES[i], ALLY_COLORS[i], 'ally', this.map.allyAnchors[i]);
      a.group.visible = false;
      // chevron flottant pour distinguer un coéquipier en un coup d'œil
      const mk = new THREE.Sprite(new THREE.SpriteMaterial({
        map: markTex, color: new THREE.Color(ALLY_COLORS[i]),
        transparent: true, depthTest: false, depthWrite: false, opacity: 0.95,
      }));
      mk.scale.setScalar(0.42);
      mk.position.y = 2.25;
      mk.renderOrder = 999;
      a.group.add(mk);
      a.marker = mk;
      this.scene.add(a.group);
      this.allies.push(a);
    }

    this.scene.add(this.spike.group);

    // particules (impacts, sang, douilles)
    this.pData = Array.from({ length: PCOUNT }, () => ({ vel: new THREE.Vector3(), life: 0, spin: 0 }));
    this.pGeo = new THREE.BufferGeometry();
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PCOUNT * 3), 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PCOUNT * 3), 3));
    const pts = new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      size: 0.075, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    pts.frustumCulled = false;
    this.scene.add(pts);

    const flashTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,244,210,1)'); gr.addColorStop(0.35, 'rgba(255,186,90,0.85)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      // branches en étoile
      g.strokeStyle = 'rgba(255,228,170,0.85)'; g.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30); g.stroke();
      }
      return c;
    })());
    this.muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.muzzle.scale.setScalar(0.35);
    this.scene.add(this.muzzle);
    this.muzzleLight = new THREE.PointLight(0xffc27a, 0, 10, 2);
    this.scene.add(this.muzzleLight);

    const decalGeo = new THREE.CircleGeometry(0.05, 10);
    const decalMat = new THREE.MeshBasicMaterial({ color: 0x120f0b, transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    for (let i = 0; i < 48; i++) {
      const d = new THREE.Mesh(decalGeo, decalMat);
      d.visible = false;
      this.scene.add(d);
      this.decals.push(d);
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    this.canvas.addEventListener('contextmenu', this.onCtx);

    this.beginMatch();
    this.lastT = performance.now();
    this.loop();
  }

  private applyQuality() {
    const q = this.settings.quality;
    const dpr = q === 'high' ? Math.min(2, window.devicePixelRatio) : q === 'medium' ? Math.min(1.35, window.devicePixelRatio) : 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = this.settings.shadows && q !== 'low';
    if (this.world) this.world.sun.castShadow = this.settings.shadows && q !== 'low';
  }

  applySettings(s: Settings) {
    const prevQ = this.settings.quality, prevSh = this.settings.shadows;
    this.settings = s;
    sfx.setVolume(s.volume);
    this.targetWins = s.matchWins;
    this.vm.setHandsVisible(s.viewmodel);
    store.set({ targetWins: s.matchWins, settings: s });
    if (prevQ !== s.quality || prevSh !== s.shadows) this.applyQuality();
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vm?.resize(w / h);
  }

  // ══════════ ENTRÉES ══════════
  private keyDown(e: KeyboardEvent) {
    if (e.code === 'Tab') { e.preventDefault(); store.set({ scoreOpen: true }); return; }
    const snap = store.getSnapshot();
    if (e.code === 'KeyB' && (this.phase === 'buy' || snap.buyOpen)) { e.preventDefault(); this.toggleShop(); return; }
    if (e.code === 'Escape' && snap.buyOpen) { this.toggleShop(); return; }
    if (snap.paused || snap.buyOpen) return;
    this.player.keys.add(e.code);
    if (e.code === 'KeyR') this.tryReload();
    if (e.code === 'KeyE' || e.code === 'KeyF') this.holdingUse = true;
    if (e.code === 'KeyQ') this.useAbility('q');
    if (e.code === 'KeyX') this.useAbility('x');
    if (e.code === 'Digit1') this.switchSlot(1);
    if (e.code === 'Digit2') this.switchSlot(2);
  }
  private keyUp(e: KeyboardEvent) {
    if (e.code === 'Tab') { e.preventDefault(); store.set({ scoreOpen: false }); }
    if (e.code === 'KeyE' || e.code === 'KeyF') this.holdingUse = false;
    this.player.keys.delete(e.code);
  }
  private mouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement || store.getSnapshot().paused) return;
    const snap = store.getSnapshot();
    const adsMul = snap.scoped ? this.settings.adsSens * 0.45 : snap.adsLevel > 0 ? this.settings.adsSens : 1;
    const sens = 0.0022 * this.settings.sensitivity * adsMul;
    const dx = e.movementX, dy = e.movementY * (this.settings.invertY ? -1 : 1);
    this.player.yaw -= dx * sens;
    this.player.pitch -= dy * sens;
    this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
    this.vm.addSway(dx, dy);
  }
  private adsToggle() {
    if (!this.playerAlive || this.phase !== 'live' || store.getSnapshot().paused) return;
    const snap = store.getSnapshot();
    const cfg = WEAPONS[this.current];
    const max = cfg.scopeLevels === 2 ? 2 : 1;
    const next = snap.adsLevel >= max ? 0 : snap.adsLevel + 1;
    store.set({ adsLevel: next as 0 | 1 | 2 });
    if (cfg.scopeLevels > 0) sfx.uiClick();
  }

  private toggleShop() {
    const open = !store.getSnapshot().buyOpen;
    if (open && this.phase !== 'buy') return;
    store.set({ buyOpen: open });
    if (open) {
      document.exitPointerLock?.();
      this.mouseHeld = false;
    } else {
      this.requestLock();
    }
    sfx.uiClick();
  }

  // ══════════ ARMES ══════════
  private inv(id: WeaponId) {
    let e = this.inventory.get(id);
    if (!e) { const c = WEAPONS[id]; e = { ammo: c.mag, reserve: c.reserve }; this.inventory.set(id, e); }
    return e;
  }
  private switchSlot(slot: 1 | 2) {
    const id = slot === 1 ? this.pistolSlot : this.primarySlot;
    if (!id || id === this.current || this.reloadTimer > 0) return;
    this.equipWeapon(id);
  }
  private equipWeapon(id: WeaponId) {
    this.current = id;
    this.vm.equip(id);
    this.reloadTimer = 0;
    this.boltTimer = 0;
    this.bloom = 0;
    this.semiLatch = true;      // évite de tirer juste après l'équipement
    store.set({ adsLevel: 0, scoped: false, reloading: false });
    this.syncWeapon();
    sfx.reload();
  }
  private tryReload() {
    const cfg = WEAPONS[this.current];
    const e = this.inv(this.current);
    if (this.reloadTimer > 0 || e.ammo >= cfg.mag || e.reserve <= 0 || !this.playerAlive) return;
    this.reloadTimer = cfg.reloadTime;
    this.vm.startReload(cfg.reloadTime);
    sfx.reload();
    store.set({ reloading: true, adsLevel: 0 });
  }
  private finishReload() {
    const cfg = WEAPONS[this.current];
    const e = this.inv(this.current);
    const take = Math.min(cfg.mag - e.ammo, e.reserve);
    e.ammo += take; e.reserve -= take;
    store.set({ reloading: false });
    this.syncWeapon();
  }

  buy(id: WeaponId) {
    if (this.phase !== 'buy') return;
    const cfg = WEAPONS[id];
    if (this.inventory.has(id) && (id === this.pistolSlot || id === this.primarySlot)) { sfx.buyNo(); return; }
    if (this.credits < cfg.price) { sfx.buyNo(); return; }
    this.credits -= cfg.price;
    this.inventory.set(id, { ammo: cfg.mag, reserve: cfg.reserve });
    if (isPrimary(id)) this.primarySlot = id; else this.pistolSlot = id;
    this.equipWeapon(id);
    sfx.buyOk();
    this.syncLoadout();
  }
  buyShield(heavy: boolean) {
    if (this.phase !== 'buy') return;
    const s = heavy ? SHIELD_HEAVY : SHIELD_LIGHT;
    if (this.credits < s.price || this.player.shield >= s.amount) { sfx.buyNo(); return; }
    this.credits -= s.price;
    this.player.shield = s.amount;
    sfx.buyOk();
    store.set({ credits: this.credits, shield: this.player.shield });
  }
  /** équipement complet recommandé selon le budget */
  buyLoadout() {
    if (this.phase !== 'buy') return;
    const wish: WeaponId[] = this.credits >= 4700 ? ['operator'] : this.credits >= 3900 ? ['vandal'] : this.credits >= 2900 ? ['vandal'] : this.credits >= 2250 ? ['guardian'] : this.credits >= 1600 ? ['spectre'] : this.credits >= 950 ? ['marshal'] : this.credits >= 900 ? ['carnage'] : [];
    for (const w of wish) if (this.credits >= WEAPONS[w].price) { this.buy(w); break; }
    if (this.credits >= SHIELD_HEAVY.price && this.player.shield < 50) this.buyShield(true);
    else if (this.credits >= SHIELD_LIGHT.price && this.player.shield < 25) this.buyShield(false);
    else if (this.credits >= 500 && this.pistolSlot === 'classic') this.buy('ghost');
  }

  private syncLoadout() {
    const owned: WeaponId[] = [this.pistolSlot];
    if (this.primarySlot) owned.push(this.primarySlot);
    store.set({ credits: this.credits, owned });
    this.syncWeapon();
  }
  private syncWeapon() {
    const e = this.inv(this.current);
    store.set({
      weapon: this.current, ammo: e.ammo, reserve: e.reserve,
      lowAmmo: e.ammo <= Math.ceil(WEAPONS[this.current].mag * 0.25),
    });
  }

  // ══════════ AGENTS & POUVOIRS ══════════
  setProfile(p: Profile) {
    this.profile = p;
    this.agent = p.agent;
    const a = AGENTS[this.agent];
    this.player.maxHp = a.hp;
    this.player.speedMul = a.speed;
    this.vm.setSkin(SKINS.find((s) => s.id === p.skin) ?? SKINS[0]);
    this.resetAbilities();
  }

  private resetAbilities() {
    const a = AGENTS[this.agent];
    this.abCharges = ABILITIES[a.primary].charges;
    this.ultCharges = ABILITIES[a.ultimate].charges;
    this.abCd = 0; this.ultCd = 0;
    this.dashT = 0; this.healT = 0; this.shieldT = 0; this.scanT = 0; this.flashT = 0;
    if (this.turret) { this.scene.remove(this.turret.g); this.turret = null; }
    this.syncAbilityHud();
  }

  private syncAbilityHud() {
    const a = AGENTS[this.agent];
    const p = ABILITIES[a.primary], u = ABILITIES[a.ultimate];
    store.set({
      agentId: this.agent,
      abilityName: p.name, abilityCharges: this.abCharges,
      abilityCd: this.abCd <= 0 ? 1 : 1 - this.abCd / p.cooldown,
      ultName: u.name, ultCharges: this.ultCharges,
      ultCd: this.ultCd <= 0 ? 1 : 1 - this.ultCd / u.cooldown,
      flashed: Math.max(0, this.flashT / 2.4),
    });
  }

  /** déclenche le pouvoir principal (Q) ou l'ultime (X) */
  useAbility(slot: 'q' | 'x') {
    if (this.phase !== 'live' || !this.playerAlive) return;
    const a = AGENTS[this.agent];
    const id = slot === 'q' ? a.primary : a.ultimate;
    const cfg = ABILITIES[id];
    const charges = slot === 'q' ? this.abCharges : this.ultCharges;
    const cd = slot === 'q' ? this.abCd : this.ultCd;
    if (charges <= 0 || cd > 0) { sfx.buyNo(); return; }
    if (slot === 'q') { this.abCharges--; this.abCd = cfg.cooldown; }
    else { this.ultCharges--; this.ultCd = cfg.cooldown; }
    this.castAbility(id);
    this.syncAbilityHud();
  }

  private castAbility(id: string) {
    const eye = this.player.eyePos(new THREE.Vector3());
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const flat = dir.clone().setY(0).normalize();
    const col = new THREE.Color(AGENTS[this.agent].color);

    switch (id) {
      case 'dash': {
        this.dashT = ABILITIES.dash.duration;
        this.dashDir.copy(flat);
        this.shake = Math.min(1, this.shake + 0.4);
        sfx.uiClick(); sfx.footstep();
        store.set({ abilityActive: 'FULGURANCE' });
        break;
      }
      case 'smoke': {
        // nuage posé à 8 m devant, bloque la vision des bots
        const p = this.player.pos.clone().addScaledVector(flat, 8);
        const geo = new THREE.SphereGeometry(3.4, 14, 10);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x1b2430, transparent: true, opacity: 0, roughness: 1,
          emissive: col.clone().multiplyScalar(0.12),
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(p.x, 1.7, p.z);
        this.scene.add(m);
        this.fx.push({ mesh: m, life: ABILITIES.smoke.duration, kind: 'smoke', r: 3.4 });
        sfx.reload();
        store.set({ abilityActive: 'VOILE' });
        break;
      }
      case 'flash': {
        // détonation : aveugle les ennemis qui regardent vers elle
        const p = this.player.pos.clone().addScaledVector(flat, 10);
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }));
        m.position.set(p.x, 1.6, p.z);
        this.scene.add(m);
        this.fx.push({ mesh: m, life: 0.5, kind: 'flash', r: 0.7 });
        const l = new THREE.PointLight(0xffffff, 120, 40, 1.6);
        l.position.copy(m.position);
        this.scene.add(l);
        this.fx.push({ mesh: l, life: 0.5, kind: 'flashlight', r: 0 });
        // aveuglement des bots dans le champ
        for (const b of [...this.bots, ...this.allies]) {
          if (!b.alive || b.team === (this.playerAttacks ? 'ally' : 'enemy')) continue;
          if (b.pos.distanceTo(p) < 18) { b.blind = ABILITIES.flash.duration; b.state = 'hold'; }
        }
        sfx.kill();
        store.set({ abilityActive: 'ÉCLAT' });
        break;
      }
      case 'heal': {
        this.healT = ABILITIES.heal.duration;
        sfx.buyOk();
        store.set({ abilityActive: 'REGAIN' });
        break;
      }
      case 'shield': {
        this.shieldT = ABILITIES.shield.duration;
        this.player.shield = Math.max(this.player.shield, 50);
        sfx.buyOk();
        store.set({ abilityActive: 'ÉGIDE', shield: this.player.shield });
        break;
      }
      case 'scan': {
        this.scanT = ABILITIES.scan.duration;
        sfx.uiClick();
        store.set({ abilityActive: 'SONDE' });
        break;
      }
      case 'wall': {
        // mur d'énergie perpendiculaire au regard
        const p = this.player.pos.clone().addScaledVector(flat, 6);
        const right = new THREE.Vector3(-flat.z, 0, flat.x);
        const m = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 0.3),
          new THREE.MeshStandardMaterial({
            color: 0x0d1620, transparent: true, opacity: 0.86, roughness: 0.3,
            emissive: col, emissiveIntensity: 1.4,
          }));
        m.position.set(p.x, 1.7, p.z);
        m.lookAt(p.x + right.x, 1.7, p.z + right.z);
        this.scene.add(m);
        this.allWalls.push(m);     // bloque réellement balles et vision
        this.fx.push({ mesh: m, life: ABILITIES.wall.duration, kind: 'wall', r: 4.5 });
        sfx.roundStart();
        store.set({ abilityActive: 'RAVELIN' });
        break;
      }
      case 'turret': {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 8),
          new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.5, metalness: 0.6 }));
        base.position.y = 0.11; g.add(base);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.42),
          new THREE.MeshStandardMaterial({ color: 0x1d242c, roughness: 0.4, metalness: 0.7 }));
        head.position.y = 0.36; g.add(head);
        const eyeM = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: col, emissiveIntensity: 3 }));
        eyeM.position.set(0, 0.36, -0.22); g.add(eyeM);
        g.position.copy(this.player.pos).addScaledVector(flat, 1.6);
        this.scene.add(g);
        this.turret = { g, life: ABILITIES.turret.duration, cd: 0 };
        sfx.buyOk();
        store.set({ abilityActive: 'SENTINELLE' });
        break;
      }
    }
    void eye;
    setTimeout(() => store.set({ abilityActive: null }), 1600);
  }

  /** met à jour pouvoirs, effets et tourelle */
  private updateAbilities(dt: number) {
    const a = AGENTS[this.agent];
    if (this.abCd > 0) {
      this.abCd -= dt;
      if (this.abCd <= 0 && this.abCharges < ABILITIES[a.primary].charges) this.abCharges = Math.min(ABILITIES[a.primary].charges, this.abCharges + 0);
    }
    if (this.ultCd > 0) this.ultCd -= dt;

    // ─ dash ─
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.player.pos.addScaledVector(this.dashDir, 26 * dt);
      this.spawnParticles(this.player.pos.clone().setY(0.6), 3, 0x4df3d3, 1.2, 0.3);
    }
    // ─ soin progressif ─
    if (this.healT > 0) {
      this.healT -= dt;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 14 * dt);
      store.set({ hp: Math.round(this.player.hp) });
    }
    if (this.shieldT > 0) this.shieldT -= dt;
    if (this.scanT > 0) this.scanT -= dt;
    if (this.flashT > 0) { this.flashT -= dt; store.set({ flashed: Math.max(0, this.flashT / 2.4) }); }

    // ─ effets persistants ─
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      const m = f.mesh as THREE.Mesh;
      if (f.kind === 'smoke') {
        const mat = m.material as THREE.MeshStandardMaterial;
        const grow = Math.min(1, (ABILITIES.smoke.duration - f.life) * 3);
        m.scale.setScalar(0.3 + grow * 0.7);
        mat.opacity = Math.min(0.95, grow) * Math.min(1, f.life / 1.5);
      } else if (f.kind === 'flash') {
        m.scale.setScalar(1 + (0.5 - f.life) * 26);
        (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.life / 0.5);
      } else if (f.kind === 'flashlight') {
        (f.mesh as THREE.PointLight).intensity = Math.max(0, f.life / 0.5) * 120;
      } else if (f.kind === 'wall') {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.2 + Math.sin(this.t * 6) * 0.4;
        mat.opacity = Math.min(0.86, f.life / 1.5);
      }
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        const wi = this.allWalls.indexOf(f.mesh);
        if (wi >= 0) this.allWalls.splice(wi, 1);
        this.fx.splice(i, 1);
      }
    }

    // ─ tourelle ─
    if (this.turret) {
      const t = this.turret;
      t.life -= dt; t.cd -= dt;
      const foes = this.playerAttacks ? this.bots : this.bots;
      let best: Bot | null = null, bd = 22;
      for (const b of foes) {
        if (!b.alive) continue;
        const d = b.pos.distanceTo(t.g.position);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) {
        t.g.rotation.y = Math.atan2(-(best.pos.x - t.g.position.x), -(best.pos.z - t.g.position.z));
        if (t.cd <= 0) {
          t.cd = 0.4;
          const from = t.g.position.clone().setY(0.4);
          const to = best.pos.clone().setY(1.2);
          this.spawnTracer(from, to, 0x4df3d3);
          sfx.shot('bot');
          if (Math.random() < 0.55) {
            const dead = best.takeDamage(12, this.botCtx(), t.g.position);
            if (dead) { this.pushFeed('SENTINELLE', best.name, false, true); this.syncBotsHud(); }
          }
        }
      }
      if (t.life <= 0) { this.scene.remove(t.g); this.turret = null; }
    }

    // la sonde révèle les ennemis
    if (this.scanT > 0) liveFrame.scanned = true;
    else liveFrame.scanned = false;

    this.syncAbilityHud();
  }

  // ══════════ MULTIJOUEUR ══════════
  attachNet(net: Net) {
    this.net = net;
    // en ligne : moins de bots, la place est prise par les joueurs réels
    this.syncNetRoster();
  }

  detachNet() {
    for (const [, r] of this.remotes) this.scene.remove(r.m.group);
    this.remotes.clear();
    this.net = null;
  }


  private syncNetRoster() {
    if (!this.net) return;
    const ids = new Set(this.net.roster.filter((r) => r.id !== this.net!.myId).map((r) => r.id));
    for (const [id, r] of this.remotes) {
      if (!ids.has(id)) { this.scene.remove(r.m.group); this.remotes.delete(id); }
    }
  }

  /** crée ou met à jour un joueur distant */
  netPlayerState(st: PlayerState) {
    if (!this.net || st.id === this.net.myId) return;
    let r = this.remotes.get(st.id);
    if (!r) {
      const idx = this.remotes.size % this.remoteColors.length;
      const friendly = st.team === this.side;
      const m = buildAgent(friendly ? this.remoteColors[idx] : '#ff5d5d', friendly);
      this.scene.add(m.group);
      const hit = [m.hitHead, m.hitBody, m.hitLegL, m.hitLegR];
      hit.forEach((h, i) => { h.userData = { remote: st.id, part: i === 0 ? 'head' : i === 1 ? 'body' : 'leg' }; });
      r = { m, s: st, target: new THREE.Vector3(st.x, st.y, st.z), targetYaw: st.yaw, legPhase: 0, hit };
      this.remotes.set(st.id, r);
    }
    r.s = st;
    r.target.set(st.x, st.y, st.z);
    r.targetYaw = st.yaw;
    r.m.group.visible = st.alive;
  }

  netPlayerLeave(id: string) {
    const r = this.remotes.get(id);
    if (r) { this.scene.remove(r.m.group); this.remotes.delete(id); }
  }

  /** tir d'un joueur distant : trace visible */
  netShot(m: { x: number; y: number; z: number; tx: number; ty: number; tz: number }) {
    this.spawnTracer(new THREE.Vector3(m.x, m.y, m.z), new THREE.Vector3(m.tx, m.ty, m.tz), 0x9fe8ff);
    sfx.shot('bot');
  }

  /** dégâts reçus d'un joueur distant */
  netHit(m: { from: string; target: string; dmg: number; head: boolean }) {
    if (!this.net || m.target !== this.net.myId) return;
    const r = this.remotes.get(m.from);
    this.damagePlayer(m.dmg, r ? r.target : this.player.pos.clone().addScaledVector(new THREE.Vector3(0, 0, 1), 5));
  }

  /** instantané du monde reçu de l'hôte */
  netWorld(w: import('./net').WorldSnapshot) {
    if (!this.net || this.net.isHost) return;
    store.set({
      round: w.round, timer: w.timer, score: w.score as [number, number],
      spike: w.spike as never, spikeTimer: w.spikeTimer,
      spikeOnMap: w.spikePos, side: w.side,
    });
    if (w.spikePos && w.spike === 'planted' && this.spike.status !== 'planted') {
      this.spike.plantAt(w.spikePos.x, w.spikePos.z, 'A');
    }
    for (const b of w.bots) {
      const bot = this.bots[b.i];
      if (!bot) continue;
      bot.pos.set(b.x, 0, b.z);
      bot.yaw = b.yaw;
      bot.alive = b.alive;
      bot.group.visible = b.alive;
      bot.group.position.copy(bot.pos);
      bot.group.rotation.y = b.yaw;
    }
  }

  private myNetState(): PlayerState {
    return {
      id: this.net?.myId ?? 'L',
      name: this.net?.myName ?? 'AGENT',
      x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z,
      yaw: this.player.yaw, pitch: this.player.pitch,
      hp: Math.round(this.player.hp), alive: this.playerAlive,
      firing: this.mouseHeld, weapon: this.current,
      team: this.side, kills: this.kills, deaths: this.deaths,
    };
  }

  /** interpolation et animation des joueurs distants */
  private updateRemotes(dt: number) {
    for (const [, r] of this.remotes) {
      const m = r.m;
      const prev = m.group.position.clone();
      m.group.position.lerp(r.target, Math.min(1, dt * 12));
      let dy = r.targetYaw - m.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      m.group.rotation.y += dy * Math.min(1, dt * 11);
      // animation de marche d'après la vitesse réelle
      const sp = prev.distanceTo(m.group.position) / Math.max(0.001, dt);
      r.legPhase += dt * Math.min(12, sp * 2.6);
      const walking = sp > 0.4;
      const sw = Math.sin(r.legPhase) * (walking ? 0.6 : 0.03);
      m.legL.rotation.x = sw;
      m.legR.rotation.x = -sw;
      m.torso.position.y = 1.0 + (walking ? Math.abs(Math.sin(r.legPhase)) * 0.045 : 0);
      m.headPivot.rotation.x = THREE.MathUtils.clamp(-r.s.pitch * 0.5, -0.5, 0.5);
    }
  }

  // ══════════ CAMPS & SPIKE ══════════
  /** true si l'équipe du joueur attaque cette manche */
  private get playerAttacks() { return this.side === 'attack'; }
  private get mySpawns() { return this.playerAttacks ? this.map.attackSpawns : this.map.defenseSpawns; }
  private get foeSpawns() { return this.playerAttacks ? this.map.defenseSpawns : this.map.attackSpawns; }
  /** ancres de tenue des défenseurs / de progression des attaquants */
  private anchorsFor(attacking: boolean, i: number) {
    return attacking ? this.map.allyAnchors[i % this.map.allyAnchors.length] : this.map.anchors[i % this.map.anchors.length];
  }

  private siteNear(x: number, z: number): 'A' | 'B' | null {
    const a = this.map.siteA, b = this.map.siteB;
    if (Math.hypot(x - a.x, z - a.z) < a.r) return 'A';
    if (Math.hypot(x - b.x, z - b.z) < b.r) return 'B';
    return null;
  }

  /** Met à jour pose / désamorçage / IA du Spike. @returns issue éventuelle */
  private updateSpike(dt: number): 'attackWin' | 'defenseWin' | null {
    const sp = this.spike;
    const boom = sp.update(dt, this.t);
    if (boom) { this.shake = 1; sfx.matchWin(); return 'attackWin'; }

    const px = this.player.pos.x, pz = this.player.pos.z;
    let canPlant = false, canDefuse = false, canPickup = false;
    let nearSite: 'A' | 'B' | null = null;

    // ─── JOUEUR ───
    if (this.playerAlive) {
      if (this.playerAttacks) {
        const carrying = sp.status === 'carried' && this.spikeCarrier === null;
        if (carrying) {
          nearSite = this.siteNear(px, pz);
          canPlant = !!nearSite;
          if (canPlant && this.holdingUse) {
            sp.plantT += dt;
            if (sp.plantT >= PLANT_TIME) {
              sp.plantAt(px, pz, nearSite!);
              this.banner('SPIKE POSÉ', `Site ${nearSite} — défendez-le ${Math.round(sp.timer)} s`, 'win');
              this.pushFeed('VOUS', `SPIKE ${nearSite}`, false, true);
              sfx.buyOk();
              this.retaskAI();
            }
          } else if (!this.holdingUse) sp.plantT = Math.max(0, sp.plantT - dt * 2.5);
        } else if (sp.status === 'dropped' && Math.hypot(px - sp.pos.x, pz - sp.pos.z) < PLANT_RADIUS) {
          canPickup = true;
          if (this.holdingUse) {
            sp.status = 'carried';
            sp.carrier = null;
            sp.group.visible = false;
            this.spikeCarrier = null;
            sfx.uiClick();
          }
        }
      } else if (sp.status === 'planted') {
        // défenseur : désamorçage
        if (Math.hypot(px - sp.pos.x, pz - sp.pos.z) < PLANT_RADIUS) {
          canDefuse = true;
          if (this.holdingUse) {
            sp.defuseT += dt;
            if (sp.defuseT >= DEFUSE_HALF) sp.defuseSaved = true;
            if (sp.defuseT >= DEFUSE_TIME) {
              sp.status = 'defused';
              sp.group.visible = false;
              this.pushFeed('VOUS', 'SPIKE DÉSAMORCÉ', false, true);
              sfx.roundWin();
              return 'defenseWin';
            }
          } else {
            sp.defuseT = sp.defuseSaved ? Math.max(DEFUSE_HALF, sp.defuseT - dt * 2) : Math.max(0, sp.defuseT - dt * 2);
          }
        } else if (!this.holdingUse) {
          sp.defuseT = sp.defuseSaved ? Math.max(DEFUSE_HALF, sp.defuseT - dt) : Math.max(0, sp.defuseT - dt);
        }
      }
    }

    // ─── IA ───
    const attackers = this.playerAttacks ? this.allies : this.bots;
    const defenders = this.playerAttacks ? this.bots : this.allies;

    if (sp.status === 'carried' && this.spikeCarrier) {
      const c = this.spikeCarrier;
      if (!c.alive) {
        sp.dropAt(c.pos.x, c.pos.z);
        c.carriesSpike = false;
        this.spikeCarrier = null;
        this.pushFeed('SPIKE', 'LÂCHÉ', false, false);
      } else {
        // se dirige vers le site le plus proche puis pose
        const site = Math.hypot(c.pos.x - this.map.siteA.x, c.pos.z - this.map.siteA.z)
          < Math.hypot(c.pos.x - this.map.siteB.x, c.pos.z - this.map.siteB.z) ? this.map.siteA : this.map.siteB;
        c.objective = { x: site.x, z: site.z, kind: 'plant' };
        if (this.siteNear(c.pos.x, c.pos.z) && c.state !== 'combat') {
          c.interactT += dt;
          if (c.interactT >= PLANT_TIME) {
            sp.plantAt(c.pos.x, c.pos.z, this.siteNear(c.pos.x, c.pos.z)!);
            c.carriesSpike = false;
            c.objective = null;
            this.spikeCarrier = null;
            this.banner('SPIKE POSÉ', `Site ${sp.site} — désamorcez-le !`, 'lose');
            this.pushFeed(c.name, `SPIKE ${sp.site}`, false, false);
            this.retaskAI();
          }
        } else c.interactT = Math.max(0, c.interactT - dt);
      }
    } else if (sp.status === 'dropped') {
      // un attaquant IA va le récupérer
      let best: Bot | null = null, bd = 1e9;
      for (const a of attackers) {
        if (!a.alive) continue;
        const d = Math.hypot(a.pos.x - sp.pos.x, a.pos.z - sp.pos.z);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) {
        best.objective = { x: sp.pos.x, z: sp.pos.z, kind: 'plant' };
        if (bd < PLANT_RADIUS) {
          sp.status = 'carried';
          sp.group.visible = false;
          best.carriesSpike = true;
          this.spikeCarrier = best;
        }
      }
    } else if (sp.status === 'planted') {
      // les défenseurs IA convergent pour désamorcer
      let best: Bot | null = null, bd = 1e9;
      for (const d of defenders) {
        if (!d.alive) continue;
        const dd = Math.hypot(d.pos.x - sp.pos.x, d.pos.z - sp.pos.z);
        if (dd < bd) { bd = dd; best = d; }
      }
      for (const d of defenders) if (d.alive) d.objective = { x: sp.pos.x, z: sp.pos.z, kind: 'defuse' };
      if (best && bd < PLANT_RADIUS && best.state !== 'combat') {
        best.interactT += dt;
        if (best.interactT >= DEFUSE_TIME) {
          sp.status = 'defused';
          sp.group.visible = false;
          this.pushFeed(best.name, 'SPIKE DÉSAMORCÉ', false, false);
          return this.playerAttacks ? 'defenseWin' : 'defenseWin';
        }
      } else if (best) best.interactT = Math.max(0, best.interactT - dt * 1.5);
      // les attaquants reviennent défendre le Spike
      for (const a of attackers) if (a.alive && !a.objective) a.pushGoal = { x: sp.pos.x, z: sp.pos.z };
    }

    const aiPlant = this.spikeCarrier ? this.spikeCarrier.interactT / PLANT_TIME : 0;
    const aiDefuse = sp.status === 'planted'
      ? Math.max(...defenders.map((d) => d.interactT), 0) / DEFUSE_TIME : 0;

    store.set({
      spike: sp.status,
      spikeCarriedByPlayer: sp.status === 'carried' && this.spikeCarrier === null && this.playerAttacks,
      spikeTimer: sp.status === 'planted' ? Math.max(0, Math.ceil(sp.timer)) : 0,
      plantProgress: Math.max(sp.plantT / PLANT_TIME, this.playerAttacks ? 0 : aiPlant),
      defuseProgress: Math.max(sp.defuseT / DEFUSE_TIME, this.playerAttacks ? aiDefuse : 0),
      nearSite, canPlant, canDefuse, canPickup,
      spikeOnMap: sp.status === 'planted' || sp.status === 'dropped' ? { x: sp.pos.x, z: sp.pos.z } : null,
    });
    return null;
  }

  /** après la pose : les rôles s'inversent autour du Spike */
  private retaskAI() {
    const attackers = this.playerAttacks ? this.allies : this.bots;
    const defenders = this.playerAttacks ? this.bots : this.allies;
    for (const a of attackers) { a.objective = null; a.pushGoal = { x: this.spike.pos.x, z: this.spike.pos.z }; }
    for (const d of defenders) { d.objective = { x: this.spike.pos.x, z: this.spike.pos.z, kind: 'defuse' }; }
  }

  // ══════════ ROUND / MATCH ══════════
  private beginMatch() {
    this.round = 1;
    this.roundsPlayed = 0;
    this.side = 'attack';
    this.swapAfter = Math.max(2, this.targetWins);   // bascule à la mi-match
    this.spike.reset();
    this.spikeCarrier = null;
    this.score = [0, 0];
    this.kills = 0; this.deaths = 0;
    this.credits = 800;
    this.inventory.clear();
    this.pistolSlot = 'classic';
    this.primarySlot = null;
    this.player.shield = 0;
    this.inv('classic');
    this.beginBuy(true);
  }

  restart() {
    sfx.uiClick();
    store.set({ feed: [], matchResult: null, lastKill: null, buyOpen: false });
    this.beginMatch();
    this.requestLock();
  }

  private banner(title: string, sub: string | undefined, kind: 'win' | 'lose' | 'info') {
    store.set({ banner: { title, sub, kind, key: ++this.bannerKey } });
  }

  private beginBuy(first = false) {
    this.phase = 'buy';
    this.phaseT = BUY_TIME;
    this.playerAlive = true;
    this.roundKills = 0;
    this.deathT = 0;
    this.bloom = 0; this.recoilP = 0; this.recoilYawP = 0;
    this.holdingUse = false;

    const mine = this.mySpawns, foes = this.foeSpawns;
    const yaw = this.playerAttacks ? 0 : Math.PI;     // on regarde vers le centre
    this.player.reset(mine[0].x, mine[0].z, yaw);
    this.player.hp = this.player.maxHp;
    for (const id of [...this.inventory.keys()]) {
      const c = WEAPONS[id];
      this.inventory.set(id, { ammo: c.mag, reserve: c.reserve });
    }
    this.current = this.primarySlot ?? this.pistolSlot;
    this.vm.equip(this.current);

    // alliés : même camp que le joueur · ennemis : camp opposé
    this.allies.forEach((a, i) => {
      const sp = mine[i + 1] ?? mine[0];
      a.anchor = this.anchorsFor(this.playerAttacks, i);
      a.spawnAt(sp.x, sp.z);
      a.group.visible = true;
    });
    this.bots.forEach((b, i) => {
      const sp = foes[i] ?? foes[0];
      b.anchor = this.anchorsFor(!this.playerAttacks, i);
      b.spawnAt(sp.x, sp.z);
      b.group.visible = false;
    });

    // ─── attribution du Spike au camp attaquant ───
    this.spike.reset();
    if (this.playerAttacks) {
      this.spikeCarrier = null;                       // le joueur le porte
    } else {
      const pick = this.bots[(Math.random() * this.bots.length) | 0];
      this.spikeCarrier = pick;
      pick.carriesSpike = true;
    }

    this.world.barrier.visible = true;
    const roleTxt = this.playerAttacks ? 'ATTAQUE — posez le Spike' : 'DÉFENSE — empêchez la pose';
    this.banner(`MANCHE ${this.round}`, first ? `${roleTxt} · [B] boutique` : roleTxt, 'info');
    store.set({
      phase: 'buy', timer: BUY_TIME, hp: Math.round(this.player.maxHp), shield: this.player.shield, credits: this.credits,
      enemiesAlive: 5, enemiesTotal: 5, round: this.round, score: [...this.score], targetWins: this.targetWins,
      alliesAlive: this.allies.length + 1, alliesTotal: this.allies.length + 1,
      buyOpen: false, reloading: false, adsLevel: 0, scoped: false, matchResult: null, mapId: this.map.id,
      side: this.side, spike: 'carried', spikeCarriedByPlayer: this.playerAttacks,
      spikeTimer: 0, plantProgress: 0, defuseProgress: 0, nearSite: null,
      canPlant: false, canDefuse: false, canPickup: false, spikeOnMap: null, spectating: false,
      bots: this.bots.map((b) => ({ name: b.name, alive: false, kills: b.kills, color: b.color })),
      allies: this.allies.map((a) => ({ name: a.name, alive: true, kills: a.kills, color: a.color })),
    });
    this.resetAbilities();
    this.syncLoadout();
    this.lastShotT = -9;
    this.vm.stopReload();
    this.reloadTimer = 0;
    this.semiLatch = true;
  }

  /** mi-temps : les deux équipes échangent attaque et défense */
  private beginHalftime() {
    this.phase = 'halftime';
    this.phaseT = 6;
    const next = this.side === 'attack' ? 'DÉFENSE' : 'ATTAQUE';
    this.banner('CHANGEMENT DE CAMP', `Vous passez en ${next} — économie réinitialisée`, 'info');
    store.set({ phase: 'halftime', timer: 6 });
    sfx.roundStart();
    document.exitPointerLock?.();
  }

  private beginLive() {
    this.phase = 'live';
    this.phaseT = ROUND_TIME;
    this.world.barrier.visible = false;
    store.set({ buyOpen: false });

    const mine = this.mySpawns, foes = this.foeSpawns;
    const launch = (b: Bot, sp: { x: number; z: number }, attacking: boolean, i: number) => {
      b.group.visible = true;
      b.spawnAt(sp.x, sp.z);
      b.anchor = this.anchorsFor(attacking, i);
      b.targetYaw = attacking ? Math.PI : b.anchor.yaw;
      b.pushGoal = attacking ? this.map.allyPush[i % this.map.allyPush.length] : null;
      b.path = findPath(sp.x, sp.z, b.anchor.x, b.anchor.z);
      b.pathI = 0;
      b.state = 'push';
    };
    const humanMates = this.net?.connected ? Math.max(0, this.net.roster.length - 1) : 0;
    this.allies.forEach((a, i) => {
      // les joueurs en ligne remplacent les coéquipiers IA
      if (i < humanMates) { a.alive = false; a.group.visible = false; return; }
      launch(a, mine[i + 1] ?? mine[0], this.playerAttacks, i);
    });
    this.bots.forEach((b, i) => launch(b, foes[i] ?? foes[0], !this.playerAttacks, i));

    if (this.playerAttacks) {
      this.banner('ATTAQUE', `Posez le Spike sur le site A ou B`, 'info');
    } else {
      this.banner('DÉFENSE', `Tenez les sites — ne les laissez pas poser`, 'info');
    }
    store.set({ phase: 'live', timer: ROUND_TIME, spike: 'carried' });
    this.syncBotsHud();
    sfx.roundStart();
    sfx.startAmbient();
    if (!store.getSnapshot().pointerLocked) this.requestLock();
  }

  private pushFeed(killer: string, victim: string, headshot: boolean, mine: boolean) {
    const feed = [...store.getSnapshot().feed, { id: ++this.feedId, killer, victim, headshot, mine, ts: Date.now() } as FeedItem];
    store.set({ feed: feed.slice(-5) });
  }

  private endRound(playerWin: boolean, timedOut = false, reason?: string) {
    if (this.phase !== 'live') return;
    this.phase = 'roundEnd';
    this.phaseT = 4.8;
    this.score[playerWin ? 0 : 1]++;
    const winCredits = playerWin ? 3000 : 1900;
    this.credits = Math.min(9000, this.credits + winCredits);
    const sub = reason ?? (timedOut ? 'Temps écoulé' : '');
    if (playerWin) { this.banner('MANCHE GAGNÉE', `${sub ? sub + ' · ' : ''}+${winCredits} cr`, 'win'); sfx.roundWin(); }
    else { this.banner(timedOut ? 'TEMPS ÉCOULÉ' : 'MANCHE PERDUE', `${sub ? sub + ' · ' : ''}+${winCredits} cr`, 'lose'); sfx.roundLose(); }
    this.roundsPlayed++;
    for (const b of [...this.bots, ...this.allies]) { b.objective = null; b.carriesSpike = false; b.interactT = 0; }
    store.set({ score: [...this.score], credits: this.credits, phase: 'roundEnd', adsLevel: 0, scoped: false });
    this.reloadTimer = 0;
    this.vm.stopReload();

    if (this.score[0] >= this.targetWins || this.score[1] >= this.targetWins) {
      this.phase = 'matchEnd';
      const win = this.score[0] > this.score[1];
      this.banner(win ? 'VICTOIRE' : 'DÉFAITE',
        win ? 'Le protocole VALENCE est sécurisé.' : 'Le site est tombé aux mains de l\'ennemi.', win ? 'win' : 'lose');
      if (win) sfx.matchWin(); else sfx.matchLose();
      store.set({ phase: 'matchEnd', matchResult: win ? 'win' : 'lose' });
      this.onMatchEnd?.(win, this.kills, this.roundsPlayed);
      document.exitPointerLock?.();
    }
  }

  // ══════════ TIR DU JOUEUR ══════════
  private totalSpreadDeg(): number {
    const cfg = WEAPONS[this.current];
    const snap = store.getSnapshot();
    let s = cfg.spreadBase + this.bloom;
    if (this.player.moving) s += cfg.spreadMove * this.player.speedFrac;
    if (this.player.crouched) s *= 0.72;
    if (!this.player.onGround) s += 2.6;
    if (this.player.walkingSlow) s *= 0.62;
    if (snap.adsLevel > 0) s *= cfg.scopeLevels > 0 ? 0.03 : 0.5;
    return Math.max(0.01, s);
  }

  private playerFire() {
    const cfg = WEAPONS[this.current];
    const e = this.inv(this.current);
    if (this.t - this.lastShotT < 60 / cfg.rpm) return;
    if (this.reloadTimer > 0 || this.boltTimer > 0 || !this.playerAlive) return;
    if (e.ammo <= 0) {
      if (!this.semiLatch) { sfx.dryFire(); this.tryReload(); }
      this.semiLatch = true;
      return;
    }
    this.lastShotT = this.t;
    e.ammo--;
    this.syncWeapon();
    sfx.shot(cfg.soundKind);

    const spreadRad = THREE.MathUtils.degToRad(this.totalSpreadDeg());
    const origin = this.player.eyePos(new THREE.Vector3());
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);

    const hitTargets: THREE.Object3D[] = [];
    for (const b of this.bots) if (b.alive) hitTargets.push(...b.raycastMeshes);
    // joueurs distants du camp adverse
    for (const [, r] of this.remotes) if (r.s.alive && r.s.team !== this.side) hitTargets.push(...r.hit);
    hitTargets.push(...this.allWalls);

    const damageByBot = new Map<Bot, { dmg: number; head: boolean; point: THREE.Vector3 }>();
    let lastEnd = origin.clone().addScaledVector(baseDir, 120);

    for (let p = 0; p < cfg.pellets; p++) {
      const dir = baseDir.clone();
      const sp = cfg.pellets > 1 ? spreadRad * 1.15 : spreadRad;
      if (sp > 0.0002) {
        // dispersion circulaire
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * sp;
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(dir, up).normalize();
        const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
        dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(realUp, Math.sin(a) * r).normalize();
      }
      this.raycaster.set(origin, dir);
      this.raycaster.far = 160;
      const hits = this.raycaster.intersectObjects(hitTargets, false);
      let end = origin.clone().addScaledVector(dir, 120);

      if (hits.length) {
        const h = hits[0];
        end = h.point.clone();
        const ud = h.object.userData as { bot?: Bot; part?: string; remote?: string };
        if (ud.remote) {
          // joueur en ligne : on annonce les dégâts, la victime les applique
          const idx = ud.part === 'head' ? 0 : ud.part === 'leg' ? 2 : 1;
          const dmg = cfg.dmg[idx];
          this.net?.sendHit(ud.remote, dmg, ud.part === 'head');
          sfx.hit(ud.part === 'head');
          this.spawnParticles(h.point, 7, 0xc22a30, 1.7, 0.5);
          store.set({ hitmarker: Date.now(), hitKill: false });
        } else if (ud.bot && ud.bot.alive) {
          const dist = origin.distanceTo(h.point);
          const fallK = cfg.falloffEnd > cfg.falloffStart
            ? THREE.MathUtils.clamp((dist - cfg.falloffStart) / (cfg.falloffEnd - cfg.falloffStart), 0, 1) : 0;
          const idx = ud.part === 'head' ? 0 : ud.part === 'leg' ? 2 : 1;
          const dmg = Math.round(THREE.MathUtils.lerp(cfg.dmg[idx], cfg.dmgFar[idx], fallK));
          const prev = damageByBot.get(ud.bot);
          damageByBot.set(ud.bot, {
            dmg: (prev?.dmg ?? 0) + dmg,
            head: (prev?.head ?? false) || ud.part === 'head',
            point: h.point.clone(),
          });
          this.spawnParticles(h.point, cfg.pellets > 1 ? 2 : 7, 0xc22a30, 1.7, 0.5);
        } else {
          this.spawnParticles(h.point, cfg.pellets > 1 ? 2 : 6, 0xe8c890, 1.3, 0.55);
          if (h.face && (cfg.pellets === 1 || p % 4 === 0)) {
            const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
            const d = this.decals[this.decalI++ % this.decals.length];
            d.visible = true;
            d.position.copy(h.point).addScaledVector(n, 0.014);
            d.lookAt(h.point.clone().add(n));
            d.scale.setScalar(0.7 + Math.random() * 0.6);
            if (Math.random() < 0.3) sfx.crack();
          }
        }
      }
      lastEnd = end;
      if (cfg.pellets === 1 || p % 3 === 0) {
        const muzzlePos = this.vm.muzzleWorld(new THREE.Vector3());
        this.spawnTracer(muzzlePos, end, cfg.tracer);
      }
    }

    // application des dégâts
    for (const [bot, info] of damageByBot) {
      sfx.hit(info.head);
      const dead = bot.takeDamage(info.dmg, this.botCtx());
      store.set({ hitmarker: Date.now(), hitKill: dead });
      if (dead) {
        this.kills++; this.roundKills++;
        this.credits = Math.min(9000, this.credits + 200);
        sfx.kill();
        store.set({ lastKill: { name: bot.name, ts: Date.now(), head: info.head } });
        this.pushFeed('VOUS', bot.name, info.head, true);
        this.syncBotsHud();
        if (this.roundKills >= 5) this.banner('ACE !', 'Toute l\'équipe ennemie éliminée', 'win');
      }
    }
    void lastEnd;

    // flash + lumière + douille
    const muzzlePos = this.vm.muzzleWorld(new THREE.Vector3());
    this.muzzle.position.copy(muzzlePos);
    this.muzzle.material.opacity = 1;
    this.muzzle.scale.setScalar((cfg.pellets > 1 ? 0.42 : 0.3) + Math.random() * 0.16);
    this.muzzle.material.rotation = Math.random() * 6.28;
    this.muzzleLight.position.copy(muzzlePos);
    this.muzzleLight.intensity = cfg.soundKind === 'sniper' ? 46 : 28;

    const ej = this.vm.ejectWorld(new THREE.Vector3());
    this.spawnShell(ej);
    if (this.net?.connected) {
      this.net.sendShot(muzzlePos.x, muzzlePos.y, muzzlePos.z, lastEnd.x, lastEnd.y, lastEnd.z);
    }

    // recul
    const heavy = cfg.soundKind === 'sniper' || cfg.soundKind === 'shotgun';
    this.vm.fireKick(heavy ? 3 : cfg.auto ? 1 : 1.3);
    this.recoilP += cfg.recoilKick;
    this.recoilYawP += (Math.random() - 0.5) * cfg.recoilKick * 0.8;
    this.bloom = Math.min(cfg.bloomMax, this.bloom + cfg.bloomPerShot);
    this.shake = Math.min(1, this.shake + (heavy ? 0.6 : 0.16));
    if (cfg.boltAction) {
      this.boltTimer = cfg.id === 'operator' ? 1.15 : 0.85;
      this.vm.boltCycle(this.boltTimer);
    }
    if (cfg.soundKind === 'shotgun') { this.boltTimer = 0.55; this.vm.boltCycle(0.55); sfx.pump(); }
  }

  // ══════════ IA : CONTEXTE & TIR ══════════
  private targetsCache: { ally: Target[]; enemy: Target[] } = { ally: [], enemy: [] };

  /** reconstruit les listes de cibles par camp (1 fois par frame) */
  private refreshTargets() {
    this.playerTarget.pos = this.player.pos;
    this.playerTarget.alive = this.playerAlive;
    // camp « ally » = joueur + alliés ; camp « enemy » = bots ennemis
    this.targetsCache.ally = [this.playerTarget, ...this.allies.map((a) => a.asTarget())];
    this.targetsCache.enemy = this.bots.map((b) => b.asTarget());
  }

  private botCtx(): BotCtx {
    return {
      foesOf: (bot) => (bot.team === 'ally' ? this.targetsCache.enemy : this.targetsCache.ally),
      matesOf: (bot) => {
        const list = bot.team === 'ally' ? this.targetsCache.ally : this.targetsCache.enemy;
        return list.filter((t) => t.bot !== bot);
      },
      canSee: (eye, target) => {
        const dir = this.tmpV.copy(target).sub(eye);
        const dist = dir.length();
        dir.normalize();
        this.raycaster.set(eye, dir);
        this.raycaster.far = dist;
        return this.raycaster.intersectObjects(this.allWalls, false).length === 0;
      },
      onFire: (bot, target) => this.botFire(bot, target),
      blood: (p) => this.spawnParticles(p, 12, 0xc22a30, 2.1, 0.6),
      difficulty: this.difficulty(),
      allySkill: this.allySkill(),
    };
  }

  private difficulty() {
    return THREE.MathUtils.clamp(this.settings.difficulty + (this.round - 1) * 0.25, 1, 5.5);
  }
  /** les alliés restent un cran en dessous : le joueur doit porter l'équipe */
  private allySkill() {
    return THREE.MathUtils.clamp(this.settings.difficulty * 0.92 + 0.55, 1.2, 4.8);
  }

  /** un bot ouvre le feu sur sa cible (joueur ou bot adverse) */
  private botFire(bot: Bot, target: Target) {
    if (this.phase !== 'live' || !target.alive) return;
    sfx.shot('bot');
    const diff = bot.team === 'ally' ? this.allySkill() : this.difficulty();
    const eye = this.tmpV.set(bot.pos.x, bot.pos.y + 1.56, bot.pos.z);
    const chest = this.tmpV2.set(target.pos.x, target.pos.y + 1.2, target.pos.z);
    const dist = eye.distanceTo(chest);

    let acc = 0.2 + diff * 0.075;
    acc *= THREE.MathUtils.clamp(1.25 - dist / 50, 0.35, 1);
    if (target.isPlayer) {
      if (this.player.moving) acc *= 0.6;
      if (this.player.crouched) acc *= 1.12;
    } else if (target.bot && target.bot.state !== 'hold') acc *= 0.72;

    const hit = Math.random() < acc;
    const end = chest.clone();
    if (!hit) {
      end.x += (Math.random() - 0.5) * 3;
      end.y += (Math.random() - 0.3) * 2;
      end.z += (Math.random() - 0.5) * 3;
      if (target.isPlayer && Math.random() < 0.4) sfx.crack();
      const dirMiss = end.clone().sub(eye).normalize();
      this.raycaster.set(eye, dirMiss);
      this.raycaster.far = 80;
      const wh = this.raycaster.intersectObjects(this.allWalls, false);
      if (wh.length) this.spawnParticles(wh[0].point, 4, 0xe8c890, 1, 0.5);
    }
    this.spawnTracer(bot.muzzleWorld.clone(), end, bot.team === 'ally' ? 0x6ef0d8 : 0xff6a5a);

    if (!hit) return;
    const dmg = Math.round((9 + diff * 2.1) * THREE.MathUtils.clamp(1.15 - dist / 60, 0.55, 1));
    if (target.isPlayer) {
      this.damagePlayer(dmg, bot.pos, bot);
    } else if (target.bot) {
      const victim = target.bot;
      this.spawnParticles(chest.clone(), 6, 0xc22a30, 1.6, 0.5);
      const dead = victim.takeDamage(dmg, this.botCtx(), bot.pos);
      if (dead) {
        bot.kills++;
        this.pushFeed(bot.name, victim.name, false, false);
        if (victim.team === 'enemy') sfx.hit(false);
        this.syncBotsHud();
      }
    }
  }

  private damagePlayer(dmg: number, from: THREE.Vector3, bot?: Bot) {
    if (!this.playerAlive) return;
    const absorb = Math.min(this.player.shield, Math.ceil(dmg * 0.66));
    this.player.shield -= absorb;
    this.player.hp = Math.max(0, this.player.hp - (dmg - absorb));
    this.shake = Math.min(1, this.shake + 0.5);
    this.hurtKick = Math.min(1, this.hurtKick + 0.8);
    const ang = Math.atan2(-(from.x - this.player.pos.x), -(from.z - this.player.pos.z));
    let rel = ang - this.player.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    store.set({ dmgFlash: Date.now(), dmgDir: rel, hp: Math.round(this.player.hp), shield: Math.max(0, this.player.shield) });
    if (this.player.hp <= 0) {
      this.playerAlive = false;
      this.deaths++;
      const killer = bot ? bot.name : this.nearestAliveBotName();
      if (bot) bot.kills++;
      this.pushFeed(killer, 'VOUS', false, true);
      this.syncBotsHud();
      store.set({ deaths: this.deaths, adsLevel: 0, scoped: false });
    }
  }

  private nearestAliveBotName(): string {
    let best = 'ENNEMI', bd = 1e9;
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = b.pos.distanceToSquared(this.player.pos);
      if (d < bd) { bd = d; best = b.name; }
    }
    return best;
  }

  private syncBotsHud() {
    store.set({
      enemiesAlive: this.bots.filter((b) => b.alive).length,
      alliesAlive: this.allies.filter((a) => a.alive).length + (this.playerAlive ? 1 : 0),
      alliesTotal: this.allies.length + 1,
      kills: this.kills,
      credits: this.credits,
      bots: this.bots.map((b) => ({ name: b.name, alive: b.alive, kills: b.kills, color: b.color })),
      allies: this.allies.map((a) => ({ name: a.name, alive: a.alive, kills: a.kills, color: a.color })),
    });
  }

  // ══════════ FX ══════════
  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, life: 0.085, maxLife: 0.085 });
  }

  private spawnParticles(at: THREE.Vector3, n: number, color: number, speed: number, life = 0.6) {
    const pos = this.pGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.pGeo.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const idx = this.pActive++ % PCOUNT;
      pos.setXYZ(idx, at.x, at.y, at.z);
      col.setXYZ(idx, c.r, c.g, c.b);
      const p = this.pData[idx];
      p.life = life + Math.random() * 0.35;
      p.spin = 0;
      p.vel.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.95, (Math.random() - 0.5) * speed);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  private spawnShell(at: THREE.Vector3) {
    const pos = this.pGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.pGeo.getAttribute('color') as THREE.BufferAttribute;
    const idx = this.pActive++ % PCOUNT;
    pos.setXYZ(idx, at.x, at.y, at.z);
    col.setXYZ(idx, 0.85, 0.68, 0.28);
    const p = this.pData[idx];
    p.life = 1.5;
    p.spin = 1;
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(right);
    right.cross(new THREE.Vector3(0, 1, 0)).normalize();
    p.vel.copy(right).multiplyScalar(1.7 + Math.random() * 0.7);
    p.vel.y = 1.3 + Math.random() * 0.6;
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  private updateFx(dt: number) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / t.maxLife) * 0.85;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    const pos = this.pGeo.getAttribute('position') as THREE.BufferAttribute;
    let any = false;
    for (let i = 0; i < PCOUNT; i++) {
      const p = this.pData[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vel.y -= 7 * dt;
      let y = pos.getY(i) + p.vel.y * dt;
      if (y < 0.02) {
        y = 0.02;
        if (p.spin && p.vel.y < -0.6) { sfx.shell(); p.vel.y *= -0.32; p.vel.x *= 0.5; p.vel.z *= 0.5; }
        else p.vel.set(0, 0, 0);
      }
      pos.setXYZ(i, pos.getX(i) + p.vel.x * dt, y, pos.getZ(i) + p.vel.z * dt);
      if (p.life <= 0) pos.setXYZ(i, 0, -100, 0);
      any = true;
    }
    if (any) pos.needsUpdate = true;
    this.muzzle.material.opacity = Math.max(0, this.muzzle.material.opacity - dt * 16);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 320);
  }

  // ══════════ BOUCLE ══════════
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const realDt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    // compteur de FPS
    this.fpsAcc += realDt; this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      if (this.settings.showFps) store.set({ fps: Math.round(this.fpsFrames / this.fpsAcc) });
      this.fpsAcc = 0; this.fpsFrames = 0;
    }
    if (this.lockCooldown > 0) {
      this.lockCooldown -= realDt;
      if (this.lockCooldown <= 0 && this.wantLock) this.requestLock();
    }

    const snap = store.getSnapshot();
    let dt = realDt;
    if (snap.paused || snap.screen !== 'game') dt = 0;
    this.t += dt;

    const live = this.phase === 'live';
    const buy = this.phase === 'buy';
    const frozen = !this.playerAlive || snap.paused || this.phase === 'matchEnd' || this.phase === 'halftime' || snap.buyOpen;

    if (dt > 0 && (buy || live || this.phase === 'roundEnd' || this.phase === 'halftime')) {
      this.phaseT -= dt;
      if (buy || live) store.set({ timer: Math.max(0, Math.ceil(this.phaseT)) });
      if (buy && this.phaseT <= 0) this.beginLive();
      else if (live && this.phaseT <= 0) {
        if (this.spike.status !== 'planted') this.endRound(!this.playerAttacks, true);
      }
      else if (this.phase === 'roundEnd' && this.phaseT <= 0) {
        this.round++;
        if (this.roundsPlayed === this.swapAfter) this.beginHalftime(); else this.beginBuy();
      }
      else if (this.phase === 'halftime' && this.phaseT <= 0) {
        this.side = this.side === 'attack' ? 'defense' : 'attack';
        this.credits = 800;                 // économie remise à zéro à la bascule
        this.inventory.clear();
        this.pistolSlot = 'classic';
        this.primarySlot = null;
        this.player.shield = 0;
        this.inv('classic');
        this.beginBuy();
      }
    }

    const cfg = WEAPONS[this.current];
    const ads = snap.adsLevel > 0;

    // ——— entrées tactiles ———
    if (touchState.active && !snap.paused && !snap.buyOpen) {
      const [lx, ly] = touchState.consumeLook();
      if (lx || ly) {
        const adsMul = snap.scoped ? this.settings.adsSens * 0.45 : ads ? this.settings.adsSens : 1;
        const k = 0.0021 * this.settings.sensitivity * adsMul;
        this.player.yaw -= lx * k;
        this.player.pitch -= ly * k * (this.settings.invertY ? -1 : 1);
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch));
        this.vm.addSway(lx, ly);
      }
      this.player.touch = {
        x: touchState.moveX, y: touchState.moveY,
        crouch: touchState.crouch, jump: touchState.jump, walk: touchState.walk,
      };
      this.mouseHeld = touchState.firing;
      if (!touchState.firing) this.semiLatch = false;
    } else if (!touchState.active) {
      this.player.touch = null;
    }

    if (dt > 0) {
      const extra = buy
        ? [...this.world.colliders, { minX: BUY_BARRIER.x0, maxX: BUY_BARRIER.x1, minZ: BUY_BARRIER.z0, maxZ: BUY_BARRIER.z1, h: BUY_BARRIER.h, y0: 0 }]
        : this.world.colliders;
      this.player.update(dt, extra, frozen, ads && live);
      this.player.pos.x = THREE.MathUtils.clamp(this.player.pos.x, BOUNDS.minX, BOUNDS.maxX);
      this.player.pos.z = THREE.MathUtils.clamp(this.player.pos.z, BOUNDS.minZ, BOUNDS.maxZ);

      if (this.player.moving && this.player.onGround && !this.player.walkingSlow) {
        this.stepPhase += dt * (4 + this.player.speedFrac * 5);
        if (this.stepPhase > Math.PI) { this.stepPhase = 0; sfx.footstep(); }
      }

      if (this.mouseHeld && live && this.playerAlive && !snap.buyOpen && snap.pointerLocked) {
        if (cfg.auto || !this.semiLatch) {
          this.playerFire();
          if (!cfg.auto) this.semiLatch = true;
        }
      }

      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) this.finishReload();
      }
      if (this.boltTimer > 0) this.boltTimer -= dt;
      this.bloom = Math.max(0, this.bloom - dt * 2.4);
      this.recoilP = Math.max(0, this.recoilP - dt * (this.recoilP * 7 + 0.012));
      this.recoilYawP *= Math.max(0, 1 - dt * 5);

      this.refreshTargets();
      const ctx = this.botCtx();
      liveFrame.px = this.player.pos.x;
      liveFrame.pz = this.player.pos.z;
      liveFrame.pyaw = this.player.yaw;
      const simulate = !this.net?.connected || this.net.isHost;
      if (simulate) {
        for (const b of this.bots) b.update(dt, ctx, live);
        for (const a of this.allies) a.update(dt, ctx, live);
      }

      // repérage : un ennemi n'apparaît sur la minimap que s'il est vu
      // par le joueur OU par un allié vivant (partage d'informations)
      const eyeP = this.player.eyePos(new THREE.Vector3());
      liveFrame.bots = this.bots.filter((b) => b.alive).map((b) => {
        const chest = this.tmpV2.set(b.pos.x, 1.2, b.pos.z);
        let seen = live && this.playerAlive && eyeP.distanceTo(chest) < 48 && ctx.canSee(eyeP, chest);
        if (!seen && live) {
          for (const a of this.allies) {
            if (!a.alive) continue;
            const ae = this.tmpV.set(a.pos.x, a.pos.y + 1.56, a.pos.z);
            if (ae.distanceTo(chest) < 46 && ctx.canSee(ae, chest)) { seen = true; break; }
          }
        }
        return { x: b.pos.x, z: b.pos.z, seen: seen || liveFrame.scanned };
      });
      liveFrame.allies = this.allies.filter((a) => a.alive).map((a) => ({ x: a.pos.x, z: a.pos.z, yaw: a.yaw }));

      // ── Spike puis conditions de fin ──
      if (live && (!this.net?.connected || this.net.isHost)) {
        const outcome = this.updateSpike(dt);
        if (outcome) {
          this.endRound(outcome === (this.playerAttacks ? 'attackWin' : 'defenseWin'), false,
            outcome === 'attackWin' ? 'Le Spike a explosé' : 'Spike désamorcé');
        }
      }
      if (live && this.phase === 'live' && (!this.net?.connected || this.net.isHost)) {
        const enemiesLeft = this.bots.some((b) => b.alive);
        const alliesLeft = this.playerAlive || this.allies.some((a) => a.alive);
        const planted = this.spike.status === 'planted';
        // une fois le Spike posé, tuer tout le monde ne suffit plus aux attaquants :
        // le compte à rebours doit aller au bout (ou être désamorcé)
        if (!enemiesLeft && !(planted && !this.playerAttacks)) this.endRound(true, false, 'Équipe adverse éliminée');
        else if (!alliesLeft && !(planted && this.playerAttacks)) this.endRound(false, false, 'Votre équipe est tombée');
        else if (!this.playerAlive) {
          // le joueur est mort mais l'équipe se bat encore : on observe
          if (this.deathT === 0) {
            const left = this.allies.filter((a) => a.alive).length;
            this.banner('ÉLIMINÉ', `${left} coéquipier${left > 1 ? 's' : ''} encore en vie — observation`, 'lose');
            store.set({ spectating: true });
          }
          this.deathT += dt;
        }
      }

      // ─── multijoueur ───
      if (this.net?.connected) {
        this.updateRemotes(dt);
        this.net.sendState(dt, this.myNetState());
        if (this.net.isHost) {
          this.netWorldAcc += dt;
          if (this.netWorldAcc > 1 / 8) {
            this.netWorldAcc = 0;
            this.net.sendWorld({
              phase: this.phase, round: this.round, timer: Math.max(0, Math.ceil(this.phaseT)),
              score: [...this.score], spike: this.spike.status,
              spikeTimer: this.spike.status === 'planted' ? Math.max(0, Math.ceil(this.spike.timer)) : 0,
              spikePos: this.spike.status === 'planted' || this.spike.status === 'dropped'
                ? { x: this.spike.pos.x, z: this.spike.pos.z } : null,
              mapId: this.map.id, side: this.side,
              bots: this.bots.map((b, i) => ({ i, x: +b.pos.x.toFixed(2), z: +b.pos.z.toFixed(2), yaw: +b.yaw.toFixed(2), alive: b.alive })),
            });
          }
        }
      }

      if (live) this.updateAbilities(dt);
      this.world.update(dt, this.t);
      this.updateFx(dt);
    }

    // ═══════════ CAMÉRA ═══════════
    const baseFov = this.settings.fov;
    // léger élargissement du champ en sprint : sensation de vitesse
    const sprintFov = this.playerAlive && !ads ? this.player.speedFrac * 3.2 : 0;
    const targetFov = snap.adsLevel === 2 ? cfg.adsFov2
      : snap.adsLevel === 1 ? cfg.adsFov
        : baseFov + sprintFov;
    // transition ADS rapide, retour hanche plus doux
    const fovLerp = Math.abs(targetFov - this.camera.fov) > 0.3 ? (ads ? 16 : 10) : 10;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, realDt * fovLerp);
    this.camera.updateProjectionMatrix();

    const eye = this.player.eyePos(this.tmpV);

    // ─ atterrissage : encaissement des genoux ─
    if (this.player.justLanded > 0) {
      this.landDip = Math.min(0.17, this.landDip + this.player.justLanded * 0.05);
      this.shake = Math.min(1, this.shake + this.player.justLanded * 0.06);
      this.player.justLanded = 0;
      sfx.footstep();
    }
    this.landDip += (0 - this.landDip) * Math.min(1, realDt * 7);

    // ─ secousses et coups encaissés ─
    this.shake = Math.max(0, this.shake - realDt * 3.4);
    this.hurtKick = Math.max(0, this.hurtKick - realDt * 3.2);
    const sh = this.shake * this.shake;
    const amp = sh * 0.05;
    // bruit lissé plutôt qu'aléatoire pur : tremblement crédible
    const n1 = Math.sin(this.t * 47) * Math.sin(this.t * 23.3);
    const n2 = Math.sin(this.t * 41.7) * Math.sin(this.t * 19.1);
    const n3 = Math.sin(this.t * 53.1) * Math.sin(this.t * 29.7);

    // ─ respiration et oscillation de marche ─
    const bp = this.player.bobPhase;
    const moveAmt = this.player.speedFrac * (ads ? 0.35 : 1) * (this.player.crouched ? 0.5 : 1);
    const breathe = this.playerAlive ? Math.sin(this.t * 1.25) * 0.004 * (ads ? 0.3 : 1) : 0;
    const bobY = Math.abs(Math.sin(bp)) * 0.028 * moveAmt;
    const bobX = Math.sin(bp * 0.5) * 0.022 * moveAmt;
    // ─ inclinaison latérale selon le pas de côté ─
    const strafe = this.player.strafeAxis;
    this.leanRoll += (-strafe * 0.028 * (ads ? 0.4 : 1) - this.leanRoll) * Math.min(1, realDt * 6);

    this.camera.position.set(
      eye.x + amp * n1 + bobX,
      eye.y + amp * n2 + bobY - this.landDip + breathe,
      eye.z + amp * n3,
    );
    this.camera.rotation.set(
      this.player.pitch + this.recoilP + amp * n2 * 0.8 - this.hurtKick * 0.045 - this.landDip * 0.5,
      this.player.yaw + this.recoilYawP + amp * n1 * 0.5,
      this.leanRoll + Math.sin(bp) * 0.006 * moveAmt,
      'YXZ',
    );

    if (!this.playerAlive) {
      // ─ caméra de mort : on s'effondre puis on observe l'équipe ─
      this.deathCam += realDt;
      const fall = Math.min(1, this.deathCam * 1.6);
      const ease = 1 - Math.pow(1 - fall, 3);
      this.camera.position.y = eye.y - ease * (this.player.eyeH - 0.42);
      this.camera.rotation.z = ease * 0.62;
      this.camera.rotation.x = this.player.pitch * (1 - ease) - ease * 0.22;
      // on suit lentement un coéquipier encore en vie
      const mate = this.allies.find((a) => a.alive);
      if (mate && this.deathCam > 1.4) {
        const want = Math.atan2(-(mate.pos.x - this.player.pos.x), -(mate.pos.z - this.player.pos.z));
        let d = want - this.camera.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.camera.rotation.y += d * Math.min(1, realDt * 0.9);
      }
    } else {
      this.deathCam = 0;
    }

    // ——— viewmodel ———
    const scopedNow = cfg.scopeLevels > 0 && snap.adsLevel > 0 && Math.abs(this.camera.fov - targetFov) < 14;
    if (snap.scoped !== scopedNow) store.set({ scoped: scopedNow });
    this.vm.group.visible = this.settings.viewmodel && !scopedNow && this.playerAlive;
    this.vm.update(realDt, this.player.moving, this.player.speedFrac, ads, this.t, this.player.bobPhase, this.player.crouched);

    // ——— viseur dynamique ———
    const spreadRad = THREE.MathUtils.degToRad(this.totalSpreadDeg());
    const px = Math.tan(spreadRad) * (window.innerHeight / 2) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    if (Math.abs(px - snap.spread) > 0.4) store.set({ spread: px, moving: this.player.moving });

    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    // passe dédiée : l'arme ne traverse jamais les murs et ne subit pas
    // la distorsion du grand champ de vision
    if (this.vm.group.visible) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.vm.scene, this.vm.camera);
      this.renderer.autoClear = true;
    }
  };

  // ══════════ CYCLE DE VIE ══════════
  /** Commandes déclenchées par l'interface tactile */
  touchCommand(c: 'reload' | 'swap' | 'shop' | 'pause' | 'jump' | 'useDown' | 'useUp' | 'abilityQ' | 'abilityX') {
    if (c === 'reload') this.tryReload();
    else if (c === 'swap') this.switchSlot(this.current === this.pistolSlot ? 2 : 1);
    else if (c === 'shop') this.toggleShop();
    else if (c === 'pause') store.set({ paused: true });
    else if (c === 'useDown') this.holdingUse = true;
    else if (c === 'useUp') this.holdingUse = false;
    else if (c === 'abilityQ') this.useAbility('q');
    else if (c === 'abilityX') this.useAbility('x');
  }

  requestLock() {
    if (this.disposed) return;
    if (touchState.active) { store.set({ pointerLocked: true, paused: false }); return; }  // tactile : pas de verrou souris
    if (store.getSnapshot().buyOpen) return;
    if (this.lockCooldown > 0) { this.wantLock = true; return; }
    this.wantLock = false;
    try {
      const r = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => { this.lockCooldown = 1.0; this.wantLock = true; });
    } catch { this.lockCooldown = 1.0; this.wantLock = true; }
    store.set({ paused: false });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('pointerlockerror', this.onLockError);
    this.canvas.removeEventListener('contextmenu', this.onCtx);
    this.spike.dispose();
    this.world?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose?.();
    });
    this.renderer.dispose();
  }

  // ——— hooks de test (?debug) ———
  debugSkipToLive() { if (this.phase === 'buy') { store.set({ buyOpen: false }); this.beginLive(); } }
  debugTeleport(x: number, z: number, yaw = 0) { this.player.pos.set(x, 0, z); this.player.yaw = yaw; this.player.pitch = 0; }
  debugGive(id: WeaponId) { this.credits = 9000; this.buy(id); }
  /** force la fin des animations du viewmodel (tests) */
  debugSettle(ads = false) {
    for (let i = 0; i < 80; i++) this.vm.update(0.05, false, 0, ads, this.t, 0, false);
  }

  debugUse(v: boolean) { this.holdingUse = v; }
  /** avance la logique Spike de n pas de 0,1 s (tests) */
  debugTick(n: number) {
    for (let i = 0; i < n; i++) {
      const o = this.updateSpike(0.1);
      if (o) { this.endRound(o === (this.playerAttacks ? 'attackWin' : 'defenseWin'), false, o === 'attackWin' ? 'Le Spike a explosé' : 'Spike désamorcé'); return o; }
    }
    return null;
  }
  debugAdvanceRound() { this.phaseT = 0; }
  debugSpike() {
    return { status: this.spike.status, site: this.spike.site, timer: +this.spike.timer.toFixed(1),
      plantT: +this.spike.plantT.toFixed(2), defuseT: +this.spike.defuseT.toFixed(2),
      carrier: this.spikeCarrier ? this.spikeCarrier.name : (this.playerAttacks ? 'JOUEUR' : 'aucun'),
      side: this.side, roundsPlayed: this.roundsPlayed, swapAfter: this.swapAfter, phase: this.phase };
  }

  debugState() {
    return {
      phase: this.phase, credits: this.credits, playerHp: Math.round(this.player.hp),
      playerPos: [this.player.pos.x.toFixed(1), this.player.pos.z.toFixed(1)],
      playerAlive: this.playerAlive, score: [...this.score], round: this.round,
      weapon: this.current, ammo: this.inv(this.current).ammo, map: this.map.id,
      bots: this.bots.map((b) => ({ n: b.name, alive: b.alive, st: b.state, k: b.kills, hp: b.hp, p: [b.pos.x.toFixed(1), b.pos.z.toFixed(1)] })),
      allies: this.allies.map((a) => ({ n: a.name, alive: a.alive, st: a.state, k: a.kills, hp: a.hp, p: [a.pos.x.toFixed(1), a.pos.z.toFixed(1)] })),
    };
  }
}
