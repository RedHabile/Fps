// ─────────────────────────────────────────────────────────────
//  VALENCE — Agents ennemis : rendu 3D détaillé + IA (A*, combat)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BOUNDS } from './maps';
import { buildAgent, type AgentBuild } from './models';

// ═══════════ Navigation : grille + A* ═══════════
export interface Collider { minX: number; maxX: number; minZ: number; maxZ: number; h: number; y0: number }

const CS = 1;
let GW = 0, GH = 0, blocked: Uint8Array = new Uint8Array(0);
let originX = 0, originZ = 0;

export function buildNavGrid(colliders: Collider[]) {
  originX = BOUNDS.minX; originZ = BOUNDS.minZ;
  GW = Math.ceil((BOUNDS.maxX - BOUNDS.minX) / CS);
  GH = Math.ceil((BOUNDS.maxZ - BOUNDS.minZ) / CS);
  blocked = new Uint8Array(GW * GH);
  const M = 0.34;
  for (let gz = 0; gz < GH; gz++) {
    for (let gx = 0; gx < GW; gx++) {
      const wx = originX + (gx + 0.5) * CS;
      const wz = originZ + (gz + 0.5) * CS;
      for (const c of colliders) {
        if (c.h > 0.62 && wx > c.minX - M && wx < c.maxX + M && wz > c.minZ - M && wz < c.maxZ + M) {
          blocked[gz * GW + gx] = 1;
          break;
        }
      }
    }
  }
}

function cellBlocked(wx: number, wz: number): boolean {
  const gx = Math.floor((wx - originX) / CS), gz = Math.floor((wz - originZ) / CS);
  if (gx < 0 || gz < 0 || gx >= GW || gz >= GH) return true;
  return blocked[gz * GW + gx] === 1;
}

function lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(d / 0.42);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (cellBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

export function findPath(ax: number, az: number, bx: number, bz: number): { x: number; z: number }[] {
  const sx = Math.floor((ax - originX) / CS), sz = Math.floor((az - originZ) / CS);
  let ex = Math.floor((bx - originX) / CS), ez = Math.floor((bz - originZ) / CS);
  if (sx < 0 || sz < 0 || sx >= GW || sz >= GH) return [];
  if (ex < 0 || ez < 0 || ex >= GW || ez >= GH) return [];
  if (blocked[ez * GW + ex]) {
    let found = false;
    outer: for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const nx = ex + dx, nz = ez + dz;
      if (nx >= 0 && nz >= 0 && nx < GW && nz < GH && !blocked[nz * GW + nx]) { ex = nx; ez = nz; found = true; break outer; }
    }
    if (!found) return [];
  }
  const start = sz * GW + sx, goal = ez * GW + ex;
  const g = new Float32Array(GW * GH).fill(Infinity);
  const came = new Int32Array(GW * GH).fill(-1);
  const closed = new Uint8Array(GW * GH);
  const open: number[] = [start];
  g[start] = 0;
  const h = (i: number) => {
    const dx = Math.abs((i % GW) - ex), dz = Math.abs((i / GW | 0) - ez);
    return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const fScore = new Float32Array(GW * GH).fill(Infinity);
  fScore[start] = h(start);
  let iter = 0;
  while (open.length && iter++ < 9000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % GW, cz = cur / GW | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
      const ni = nz * GW + nx;
      if (blocked[ni] || closed[ni]) continue;
      if (dx && dz && (blocked[cz * GW + nx] || blocked[nz * GW + cx])) continue;
      const ng = g[cur] + (dx && dz ? Math.SQRT2 : 1);
      if (ng < g[ni]) {
        g[ni] = ng; came[ni] = cur; fScore[ni] = ng + h(ni);
        open.push(ni);
      }
    }
  }
  if (came[goal] === -1 && goal !== start) return [];
  const cells: number[] = [];
  let c = goal;
  while (c !== -1) { cells.push(c); c = came[c]; }
  cells.reverse();
  const pts = cells.map((i) => ({ x: originX + (i % GW + 0.5) * CS, z: originZ + ((i / GW | 0) + 0.5) * CS }));
  const out: { x: number; z: number }[] = [];
  let i0 = 0;
  out.push(pts[0] ?? { x: ax, z: az });
  while (i0 < pts.length - 1) {
    let j = pts.length - 1;
    for (; j > i0 + 1; j--) if (lineWalkable(pts[i0].x, pts[i0].z, pts[j].x, pts[j].z)) break;
    out.push(pts[j]);
    i0 = j;
  }
  out.push({ x: bx, z: bz });
  return out;
}

export { cellBlocked };

// ═══════════ Bot ═══════════
export type Team = 'ally' | 'enemy';

/** Cible potentielle (joueur ou bot adverse) */
export interface Target {
  pos: THREE.Vector3;
  alive: boolean;
  isPlayer: boolean;
  bot: Bot | null;
}

export interface BotCtx {
  /** cibles hostiles pour ce bot (équipe adverse) */
  foesOf: (bot: Bot) => Target[];
  /** coéquipiers vivants (pour ne pas tirer à travers eux) */
  matesOf: (bot: Bot) => Target[];
  canSee: (eye: THREE.Vector3, target: THREE.Vector3) => boolean;
  onFire: (bot: Bot, target: Target) => void;
  blood: (p: THREE.Vector3) => void;
  difficulty: number;
  /** difficulté propre aux alliés (indépendante des ennemis) */
  allySkill: number;
}

export type BotState = 'hold' | 'push' | 'combat' | 'dead';

export class Bot {
  name: string;
  color: string;
  team: Team;
  group: THREE.Group;
  raycastMeshes: THREE.Mesh[] = [];
  pos = new THREE.Vector3();
  yaw = 0;
  targetYaw = 0;
  hp = 100;
  alive = true;
  state: BotState = 'hold';
  anchor: { x: number; z: number; yaw: number };
  path: { x: number; z: number }[] = [];
  pathI = 0;
  reaction = 0;
  burst = 0;
  burstCd = 0;
  lastSeen = new THREE.Vector3();
  seenTimer = 999;
  strafeDir = 1;
  strafeT = 0;
  deathT = 0;
  kills = 0;
  legPhase = 0;
  muzzleWorld = new THREE.Vector3();
  repathT = 0;

  private m: AgentBuild;
  private flinch = 0;
  private recoil = 0;
  private aimPitch = 0;

  /** objectif d'assaut (alliés) */
  pushGoal: { x: number; z: number } | null = null;
  /** cible actuellement engagée */
  target: Target | null = null;
  /** chevron de coéquipier affiché au-dessus de la tête */
  marker: THREE.Sprite | null = null;
  /** ce bot transporte le Spike (attaquant désigné) */
  carriesSpike = false;
  /** aveuglé par un éclat : ne voit plus rien pendant ce temps */
  blind = 0;
  /** objectif prioritaire : poser ou désamorcer le Spike */
  objective: { x: number; z: number; kind: 'plant' | 'defuse' } | null = null;
  /** progression de l'interaction en cours */
  interactT = 0;
  private regroupT = 0;
  /** micro-déplacements de combat */
  private peekT = 0;          // cycle sortie/retrait d'angle
  private peeking = false;
  private flankSide = 1;
  private jukeT = 0;          // changement de direction imprévisible
  private crouching = false;
  private stuckT = 0;

  constructor(name: string, color: string, team: Team, anchor: { x: number; z: number; yaw: number }) {
    this.name = name;
    this.color = color;
    this.team = team;
    this.anchor = anchor;
    this.yaw = this.targetYaw = anchor.yaw;
    this.m = buildAgent(color, team === 'ally');
    this.group = this.m.group;
    // hitboxes (userData assigné après construction, jamais cloné)
    this.m.hitHead.userData = { bot: this, part: 'head' };
    this.m.hitBody.userData = { bot: this, part: 'body' };
    this.m.hitLegL.userData = { bot: this, part: 'leg' };
    this.m.hitLegR.userData = { bot: this, part: 'leg' };
    this.raycastMeshes = [this.m.hitHead, this.m.hitBody, this.m.hitLegL, this.m.hitLegR];
  }

  private _tgt: Target = { pos: new THREE.Vector3(), alive: true, isPlayer: false, bot: null };
  /** vue « cible » de ce bot, réutilisée sans allocation */
  asTarget(): Target {
    this._tgt.pos = this.pos;
    this._tgt.alive = this.alive;
    this._tgt.bot = this;
    return this._tgt;
  }

  spawnAt(x: number, z: number) {
    this.pos.set(x, 0, z);
    this.hp = 100;
    this.alive = true;
    this.state = 'hold';
    this.path = [];
    this.pathI = 0;
    this.seenTimer = 999;
    this.burst = 0;
    this.deathT = 0;
    this.interactT = 0;
    this.flinch = 0;
    this.recoil = 0;
    this.aimPitch = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.anchor.yaw, 0);
    this.group.visible = true;
    this.group.scale.setScalar(1);
    if (this.marker) this.marker.visible = true;
  }

  /** @param from position de l'agresseur (pour la riposte) */
  takeDamage(dmg: number, ctx: BotCtx, from?: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flinch = 0.2;
    if (from) { this.lastSeen.copy(from); this.seenTimer = 0; }
    if (this.state === 'hold') {
      this.state = 'combat';
      this.reaction = 0.4 - ctx.difficulty * 0.05;
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.deathT = 0;
      ctx.blood(this.pos.clone().setY(1.1));
      return true;
    }
    return false;
  }

  private eye(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos.x, this.pos.y + 1.56, this.pos.z);
  }

  update(dt: number, ctx: BotCtx, live: boolean) {
    const m = this.m;
    if (!this.alive) {
      this.deathT += dt;
      const f = Math.min(1, this.deathT * 2.6);
      // chute vers l'avant avec affaissement des jambes
      this.group.rotation.x = -f * Math.PI * 0.46;
      this.group.position.y = this.pos.y - f * 0.12;
      m.legL.rotation.x = f * 0.9;
      m.legR.rotation.x = f * 0.7;
      m.armL.rotation.x = -1.3 + f * 1.1;
      m.armR.rotation.x = -1.15 + f * 1.0;
      m.headPivot.rotation.x = f * 0.5;
      (m.visor.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.max(0, 2.4 - f * 2.4);
      if (this.marker) this.marker.visible = false;
      if (this.deathT > 4) {
        const fade = Math.min(1, (this.deathT - 4) / 1.2);
        this.group.scale.setScalar(1 - fade);
        if (fade >= 1) this.group.visible = false;
      }
      return;
    }
    if (!live) {
      this.group.position.copy(this.pos);
      this.group.rotation.set(0, this.yaw, 0);
      return;
    }
    // ─── sélection de la cible : l'hostile visible le plus proche ───
    const diff = this.team === 'ally' ? ctx.allySkill : ctx.difficulty;
    const eye = this.eye(new THREE.Vector3());
    const chest = new THREE.Vector3();
    let best: Target | null = null;
    let bestD = Infinity;
    let sees = false;
    for (const f of ctx.foesOf(this)) {
      if (!f.alive) continue;
      chest.set(f.pos.x, f.pos.y + 1.25, f.pos.z);
      const d = eye.distanceTo(chest);
      if (d > 52 || d >= bestD) continue;
      if (this.blind > 0 || !ctx.canSee(eye, chest)) continue;
      best = f; bestD = d; sees = true;
    }
    this.target = best;
    const distToFoe = bestD;

    if (sees && best) { this.lastSeen.copy(best.pos); this.seenTimer = 0; }
    else this.seenTimer += dt;

    // ─── machine à états ───
    if (this.state === 'hold' && sees) {
      this.state = 'combat';
      this.reaction = 0.75 - diff * 0.1 + Math.random() * 0.22;
    }
    if (this.state === 'combat' && this.seenTimer > 2.4) {
      this.state = 'push';
      this.path = findPath(this.pos.x, this.pos.z, this.lastSeen.x, this.lastSeen.z);
      this.pathI = 0;
    }
    if (this.state === 'push') {
      if (sees) { this.state = 'combat'; this.reaction = 0.28; }
      if (this.pathI >= this.path.length) {
        this.state = 'hold';
        this.anchor = { x: this.pos.x, z: this.pos.z, yaw: this.targetYaw };
        this.targetYaw = Math.random() * Math.PI * 2;
        this.regroupT = this.team === 'ally' ? 1.2 + Math.random() * 1.5 : 0;
      }
    }
    // ─── objectif Spike : priorité absolue hors combat ───
    if (this.objective && this.state !== 'combat') {
      const od = Math.hypot(this.objective.x - this.pos.x, this.objective.z - this.pos.z);
      if (od > 1.6) {
        this.regroupT -= dt;
        if (this.state !== 'push' || this.pathI >= this.path.length || this.regroupT <= 0) {
          this.path = findPath(this.pos.x, this.pos.z, this.objective.x, this.objective.z);
          this.pathI = 0;
          this.regroupT = 1.6;
          if (this.path.length) this.state = 'push';
        }
      } else {
        this.state = 'hold';
        this.anchor = { x: this.pos.x, z: this.pos.z, yaw: this.yaw };
      }
    }
    // les attaquants progressent vers leur objectif de poussée
    else if (this.pushGoal && this.state === 'hold') {
      this.regroupT -= dt;
      if (this.regroupT <= 0 && this.pushGoal) {
        const d = Math.hypot(this.pushGoal.x - this.pos.x, this.pushGoal.z - this.pos.z);
        if (d > 3) {
          this.path = findPath(this.pos.x, this.pos.z, this.pushGoal.x, this.pushGoal.z);
          this.pathI = 0;
          if (this.path.length) this.state = 'push';
        }
        this.regroupT = 2.5;
      }
    }
    if (this.state === 'hold') {
      this.targetYaw = this.anchor.yaw + Math.sin(performance.now() * 0.00035 + this.pos.x) * 0.45;
    }

    let moveSpeed = 0, mx = 0, mz = 0;

    if (this.state === 'push') {
      const wp = this.path[this.pathI];
      if (wp) {
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.5) this.pathI++;
        else {
          moveSpeed = 3.4;
          mx = dx / d; mz = dz / d;
          this.targetYaw = Math.atan2(-dx, -dz);
        }
      } else this.pathI = 999;
    }

    if (this.state === 'combat' && best) {
      const dx = best.pos.x - this.pos.x, dz = best.pos.z - this.pos.z;
      this.targetYaw = Math.atan2(-dx, -dz);
      const px = -dz / (distToFoe || 1), pz = dx / (distToFoe || 1);   // perpendiculaire
      const fx = dx / (distToFoe || 1), fz = dz / (distToFoe || 1);    // vers la cible

      // ── esquives imprévisibles : changement de cap irrégulier ──
      this.strafeT -= dt;
      this.jukeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 0.32 + Math.random() * 0.75;
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      if (this.jukeT <= 0 && Math.random() < 0.35) {
        this.jukeT = 0.5 + Math.random() * 0.8;
        this.strafeDir *= -1;                      // feinte sèche
      }

      // ── gestion de la distance : on cherche la portée idéale ──
      const ideal = 14 + (this.hp < 45 ? 8 : 0);
      const gap = distToFoe - ideal;
      const approach = THREE.MathUtils.clamp(gap / 14, -0.85, 0.85);

      // ── blessé : on décroche vers un couvert ──
      if (this.hp < 38 && distToFoe < 20) {
        this.crouching = false;
        moveSpeed = 3.6;
        mx = -fx * 0.9 + px * this.strafeDir * 0.5;
        mz = -fz * 0.9 + pz * this.strafeDir * 0.5;
      } else {
        // ── jeu d'angle : on sort, on tire, on se replie ──
        this.peekT -= dt;
        if (this.peekT <= 0) {
          this.peeking = !this.peeking;
          this.peekT = this.peeking ? 0.6 + Math.random() * 0.7 : 0.45 + Math.random() * 0.6;
        }
        const lateral = this.peeking ? 1 : -0.55;
        moveSpeed = this.peeking ? 2.5 : 2.0;
        mx = px * this.strafeDir * lateral + fx * approach;
        mz = pz * this.strafeDir * lateral + fz * approach;
        // s'accroupir à distance pour gagner en précision
        this.crouching = distToFoe > 22 && !this.peeking && Math.random() < 0.02;
        if (this.crouching) moveSpeed *= 0.4;
      }

      // ── contournement : si la cible tient un angle, on flanque ──
      if (this.seenTimer > 1.2 && distToFoe > 12) {
        mx += px * this.flankSide * 0.6;
        mz += pz * this.flankSide * 0.6;
      }

      this.reaction -= dt;
      this.burstCd -= dt;
      if (this.reaction <= 0 && this.burstCd <= 0) {
        // ne pas tirer si un coéquipier coupe la ligne de feu
        let blockedByMate = false;
        for (const mt of ctx.matesOf(this)) {
          if (!mt.alive) continue;
          const mdx = mt.pos.x - this.pos.x, mdz = mt.pos.z - this.pos.z;
          const md = Math.hypot(mdx, mdz);
          if (md < 0.4 || md > distToFoe) continue;
          const cross = Math.abs(mdx * (dz / distToFoe) - mdz * (dx / distToFoe));
          if (cross < 0.9) { blockedByMate = true; break; }
        }
        if (!blockedByMate) {
          if (this.burst <= 0) this.burst = 2 + (Math.random() * 3 | 0) + (diff > 3 ? 1 : 0);
          ctx.onFire(this, best);
          this.recoil = 0.1;
          moveSpeed *= 0.55;       // on ralentit pour stabiliser son tir
          this.burst--;
          this.burstCd = this.burst > 0 ? 0.115 : Math.max(0.2, 0.62 + Math.random() * 0.55 - diff * 0.07);
        } else {
          // se décaler pour dégager l'angle
          this.burstCd = 0.25;
          mx += px * this.strafeDir * 0.8;
          mz += pz * this.strafeDir * 0.8;
        }
      }
    }

    // ─── déplacement + évitement des coéquipiers ───
    for (const mt of ctx.matesOf(this)) {
      if (!mt.alive) continue;
      const sx = this.pos.x - mt.pos.x, sz = this.pos.z - mt.pos.z;
      const d2 = sx * sx + sz * sz;
      if (d2 > 0.02 && d2 < 1.7) {
        const d = Math.sqrt(d2);
        mx += (sx / d) * 1.1;
        mz += (sz / d) * 1.1;
        if (moveSpeed < 1) moveSpeed = 1.6;
      }
    }

    if (moveSpeed > 0) {
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml; mz /= ml;
      const nx = this.pos.x + mx * moveSpeed * dt;
      const nz = this.pos.z + mz * moveSpeed * dt;
      const okX = !cellBlocked(nx, this.pos.z);
      const okZ = !cellBlocked(this.pos.x, nz);
      if (okX) this.pos.x = nx;
      if (okZ) this.pos.z = nz;
      // bloqué des deux côtés : on longe le mur au lieu de pousser dedans
      if (!okX && !okZ) {
        this.stuckT += dt;
        const slide = this.stuckT > 0.35 ? -1 : 1;
        const sx = this.pos.x + (-mz * slide) * moveSpeed * dt;
        const sz = this.pos.z + (mx * slide) * moveSpeed * dt;
        if (!cellBlocked(sx, this.pos.z)) this.pos.x = sx;
        if (!cellBlocked(this.pos.x, sz)) this.pos.z = sz;
        if (this.stuckT > 1.2) {
          // vraiment coincé : on recalcule un chemin
          this.stuckT = 0;
          this.flankSide *= -1;
          if (this.objective) { this.path = findPath(this.pos.x, this.pos.z, this.objective.x, this.objective.z); this.pathI = 0; this.state = 'push'; }
        }
      } else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      this.legPhase += dt * moveSpeed * 2.7;
    } else {
      this.legPhase += dt * 1.1;
    }

    // ─── orientation lissée ───
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * (this.state === 'combat' ? 9 : 4));

    const wantPitch = this.state === 'combat' && best
      ? Math.atan2(best.pos.y + 1.2 - (this.pos.y + 1.5), Math.max(1, distToFoe))
      : 0;
    this.aimPitch += (wantPitch - this.aimPitch) * Math.min(1, dt * 6);

    // ─── animation ───
    if (this.blind > 0) this.blind -= dt;
    if (this.flinch > 0) this.flinch -= dt;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 0.9);
    const walking = moveSpeed > 0.2;
    const sw = Math.sin(this.legPhase) * (walking ? 0.62 : 0.03);
    const swo = Math.sin(this.legPhase + Math.PI) * (walking ? 0.62 : 0.03);
    m.legL.rotation.x = sw;
    m.legR.rotation.x = swo;
    m.armL.rotation.x = -1.3 + (walking ? swo * 0.12 : 0) - this.recoil * 0.5;
    m.armR.rotation.x = -1.15 + (walking ? sw * 0.1 : 0) - this.recoil * 0.6;
    const crouchY = this.crouching ? -0.3 : 0;
    m.torso.position.y = 1.0 + crouchY + (walking ? Math.abs(Math.sin(this.legPhase)) * 0.045 : Math.sin(this.legPhase * 0.6) * 0.012);
    m.legL.scale.y = m.legR.scale.y = this.crouching ? 0.72 : 1;
    m.torso.rotation.z = walking ? Math.sin(this.legPhase) * 0.045 : 0;
    m.torso.rotation.x = this.flinch > 0 ? this.flinch * 0.8 : this.aimPitch * 0.35;
    m.headPivot.rotation.x = this.aimPitch * 0.55;

    if (this.marker) {
      this.marker.visible = true;
      this.marker.position.y = 2.25 + Math.sin(performance.now() * 0.003) * 0.06;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, this.yaw, 0);
    m.muzzle.getWorldPosition(this.muzzleWorld);
  }
}
