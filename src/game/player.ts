// ─────────────────────────────────────────────────────────────
//  VALENCE — Contrôleur joueur FPS + viewmodel d'arme détaillé
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { WeaponId } from './store';
import { WEAPONS } from './weapons';
import type { Collider } from './agents';
import { buildGun, buildHands, type GunBuild } from './models';

const WALK = 5.3;
const ADS_WALK = 3.2;
const CROUCH_WALK = 2.6;

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  crouched = false;
  eyeH = 1.62;
  hp = 100;
  maxHp = 100;
  speedMul = 1;
  shield = 0;
  keys = new Set<string>();
  bobPhase = 0;
  speedFrac = 0;
  /** intensité du dernier atterrissage (0 = aucun), consommé par la caméra */
  justLanded = 0;
  /** -1 = pas à gauche, +1 = pas à droite (pour l'inclinaison caméra) */
  strafeAxis = 0;
  /** entrées tactiles (null = clavier/souris) */
  touch: { x: number; y: number; crouch: boolean; jump: boolean; walk: boolean } | null = null;

  reset(x: number, z: number, yaw: number) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.hp = this.maxHp;
    this.crouched = false;
    this.justLanded = 0;
    this.strafeAxis = 0;
    this.keys.clear();
  }

  get moving() { return this.speedFrac > 0.15; }
  get walkingSlow() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || !!this.touch?.walk;
  }

  update(dt: number, colliders: Collider[], frozen: boolean, ads: boolean) {
    let ix = 0, iz = 0;
    let analog = 1;
    if (!frozen) {
      if (this.touch) {
        ix = this.touch.x;
        iz = this.touch.y;
        analog = Math.min(1, Math.hypot(ix, iz));   // le joystick dose la vitesse
      } else {
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iz -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iz += 1;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
      }
    }
    this.crouched = !frozen && (this.keys.has('ControlLeft') || this.keys.has('KeyC') || !!this.touch?.crouch);
    const len = Math.hypot(ix, iz) || 1;
    ix /= len; iz /= len;
    ix *= analog; iz *= analog;

    const base = (this.crouched ? CROUCH_WALK : ads ? ADS_WALK : this.walkingSlow ? WALK * 0.52 : WALK) * this.speedMul;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (ix * cos + iz * sin) * base;
    const wz = (iz * cos - ix * sin) * base;

    this.vel.x += (wx - this.vel.x) * Math.min(1, dt * 10);
    this.vel.z += (wz - this.vel.z) * Math.min(1, dt * 10);
    if (ix === 0 && iz === 0 && this.onGround) {
      const f = Math.max(0, 1 - dt * 11);
      this.vel.x *= f; this.vel.z *= f;
    }

    this.vel.y -= 13.5 * dt;
    if (!frozen && (this.keys.has('Space') || this.touch?.jump) && this.onGround) {
      this.vel.y = 4.9;
      this.onGround = false;
    }

    const r = 0.36;
    let nx = this.pos.x + this.vel.x * dt;
    for (const c of colliders) {
      if (c.h - this.pos.y < 0.05) continue;
      if (c.y0 > this.pos.y + 1.2) continue;
      if (nx + r > c.minX && nx - r < c.maxX && this.pos.z + r > c.minZ && this.pos.z - r < c.maxZ) {
        nx = this.vel.x > 0 ? c.minX - r : c.maxX + r;
        this.vel.x = 0;
      }
    }
    let nz = this.pos.z + this.vel.z * dt;
    for (const c of colliders) {
      if (c.h - this.pos.y < 0.05) continue;
      if (c.y0 > this.pos.y + 1.2) continue;
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        nz = this.vel.z > 0 ? c.minZ - r : c.maxZ + r;
        this.vel.z = 0;
      }
    }
    this.pos.x = nx; this.pos.z = nz;
    const fallSpeed = this.vel.y;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      if (!this.onGround && fallSpeed < -2.2) {
        this.justLanded = Math.min(1, (-fallSpeed - 2.2) / 7);   // 0..1 selon la chute
      }
      this.onGround = true;
    }

    const targetH = this.crouched ? 1.18 : 1.62;
    this.eyeH += (targetH - this.eyeH) * Math.min(1, dt * 11);

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    this.speedFrac = Math.min(1, hSpeed / WALK);
    // composante latérale du déplacement, dans le repère du joueur
    const localRight = this.vel.x * cos - this.vel.z * sin;
    this.strafeAxis += (THREE.MathUtils.clamp(localRight / WALK, -1, 1) - this.strafeAxis) * Math.min(1, dt * 7);
    if (this.onGround) this.bobPhase += dt * (4 + hSpeed * 1.7);
  }

  eyePos(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
  }
}

// ─────────────────────────────────────────────────────────────
//  Viewmodel
// ─────────────────────────────────────────────────────────────
/**
 * Viewmodel rendu dans une passe séparée (technique standard des FPS).
 * Une caméra dédiée à FOV fixe et étroit supprime la distorsion de
 * perspective : l'arme et les bras gardent des proportions réalistes
 * quel que soit le champ de vision choisi par le joueur.
 */
export class ViewModel {
  group = new THREE.Group();          // porteur (position/rotation animées)
  scene = new THREE.Scene();          // scène dédiée au viewmodel
  camera = new THREE.PerspectiveCamera(64, 1, 0.02, 8);
  private rig = new THREE.Group();    // arme + mains
  gunTip = new THREE.Object3D();
  private build: GunBuild | null = null;
  private hands: THREE.Group | null = null;
  private light: THREE.PointLight;

  private recoilZ = 0;
  private recoilRot = 0;
  private recoilYaw = 0;
  private adsT = 0;
  private reloadT = 0;
  private reloadDur = 1;
  private equipT = 0;
  private equipDur = 0.4;
  private boltT = 0;
  private boltDur = 0.8;
  private slideT = 0;
  private magRest = new THREE.Vector3();
  private sway = new THREE.Vector2();
  private swayTarget = new THREE.Vector2();
  private hipPos = new THREE.Vector3(0.238, -0.03, -0.9);
  private adsPos = new THREE.Vector3(0, -0.05, -0.82);
  /** distance de port par catégorie : les armes courtes sont tenues plus près
   *  pour rester bien visibles à l'écran (comme dans un vrai FPS). */
  private static readonly HOLD: Record<string, { z: number; x: number; y: number }> = {
    'Pistolet':      { z: -0.56, x: 0.238, y: -0.192 },
    'Fusil à pompe': { z: -0.62, x: 0.252, y: -0.205 },
    'PM':            { z: -0.62, x: 0.252, y: -0.202 },
    'Fusil':         { z: -0.68, x: 0.266, y: -0.210 },
    'Mitrailleuse':  { z: -0.70, x: 0.272, y: -0.214 },
    'Sniper':        { z: -0.74, x: 0.276, y: -0.210 },
  };
  private showHands = true;
  /** Échelle du viewmodel. Rendu par une caméra dédiée à 55°, donc
   *  l'arme peut rester à distance confortable sans déformation. */
  private static readonly SCALE = 0.56;

  constructor() {
    this.scene.add(this.group);
    this.group.add(this.rig);
    this.rig.scale.setScalar(ViewModel.SCALE);
    this.rig.rotation.set(0.012, 0.085, 0.028);   // bouche rentrée vers le centre de l'écran
    this.rig.add(this.gunTip);
    // éclairage propre au viewmodel (indépendant de la scène)
    this.light = new THREE.PointLight(0xfff0dd, 2.6, 3.2, 2);
    this.light.position.set(0.3, 0.35, 0.35);
    this.scene.add(this.light);
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(0.6, 1, 0.7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x88a8ff, 0.8);
    rim.position.set(-0.8, 0.2, -0.9);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  }

  /** garde la caméra du viewmodel alignée sur le format de l'écran */
  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  private skin: { body: string; accent: string; metal: string; emissive?: string } | null = null;

  /** applique une livrée au modèle d'arme */
  setSkin(sk: { body: string; accent: string; metal: string; emissive?: string }) {
    this.skin = sk;
    this.applySkin();
  }

  private applySkin() {
    if (!this.skin || !this.build) return;
    const { body, accent, metal, emissive } = this.skin;
    const cBody = new THREE.Color(body), cAcc = new THREE.Color(accent), cMet = new THREE.Color(metal);
    this.build.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || !mat.color) return;
      // on reteinte selon la famille d'origine du matériau
      if (!mat.userData.base) mat.userData.base = mat.color.getHex();
      const base = mat.userData.base as number;
      if (base === 0x2c313a || base === 0x3b424d) mat.color.copy(cBody);        // polymère
      else if (base === 0xff4655) {
        mat.color.copy(cAcc);
        if (emissive) { mat.emissive = new THREE.Color(emissive).multiplyScalar(0.35); mat.emissiveIntensity = 1.4; }
      } else if (base === 0x23272e || base === 0x15181d) mat.color.copy(cMet);  // métal
    });
  }

  setHandsVisible(v: boolean) {
    this.showHands = v;
    if (this.hands) this.hands.visible = v;
  }

  equip(id: WeaponId) {
    const cfg = WEAPONS[id];
    if (this.build) {
      this.rig.remove(this.build.group);
      this.build.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry?.dispose?.(); });
    }
    if (this.hands) this.rig.remove(this.hands);

    this.build = buildGun(cfg.model);
    this.rig.add(this.build.group);
    this.hands = buildHands(this.build.grip, this.build.fore, cfg.cat !== 'Pistolet');
    this.hands.visible = this.showHands;
    this.rig.add(this.hands);
    this.gunTip.position.set(0, this.build.muzzleY, this.build.muzzleZ);

    // position de port adaptée au gabarit de l'arme
    const hold = ViewModel.HOLD[cfg.cat] ?? ViewModel.HOLD['Fusil'];
    this.hipPos.set(hold.x, hold.y, hold.z);
    // alignement ADS : la ligne de visée se place au centre de l'écran
    this.adsPos.set(0, -this.build.sightY * ViewModel.SCALE, hold.z + 0.08);

    if (this.build.mag) this.magRest.copy(this.build.mag.position);
    this.applySkin();
    this.equipDur = cfg.equipTime;
    this.equipT = cfg.equipTime;
    this.reloadT = 0;
    this.boltT = 0;
    this.recoilZ = this.recoilRot = this.recoilYaw = 0;
    this.group.visible = true;
  }

  fireKick(power: number) {
    this.recoilZ = Math.min(0.14, this.recoilZ + 0.035 * power);
    this.recoilRot = Math.min(0.22, this.recoilRot + 0.05 * power);
    this.recoilYaw += (Math.random() - 0.5) * 0.03 * power;
    this.slideT = 0.07;
  }
  boltCycle(dur: number) { this.boltT = dur; this.boltDur = dur; }
  startReload(dur: number) { this.reloadT = 0.0001; this.reloadDur = dur; }
  stopReload() {
    this.reloadT = 0;
    if (this.build?.mag) {
      this.build.mag.position.copy(this.magRest);
      this.build.mag.rotation.set(0, 0, 0);
    }
  }
  get isReloading() { return this.reloadT > 0; }

  /** inertie de visée : l'arme traîne derrière le mouvement de souris */
  addSway(dx: number, dy: number) {
    this.swayTarget.x = THREE.MathUtils.clamp(this.swayTarget.x - dx * 0.00042, -0.05, 0.05);
    this.swayTarget.y = THREE.MathUtils.clamp(this.swayTarget.y - dy * 0.00042, -0.04, 0.04);
  }

  update(dt: number, moving: boolean, speedFrac: number, ads: boolean, t: number, bobPhase: number, crouched: boolean) {
    this.adsT += ((ads ? 1 : 0) - this.adsT) * Math.min(1, dt * 13);
    if (this.equipT > 0) this.equipT = Math.max(0, this.equipT - dt);
    if (this.reloadT > 0) {
      this.reloadT += dt;
      if (this.reloadT >= this.reloadDur) {
        this.reloadT = 0;
        // remise en place exacte des pièces mobiles
        if (this.build?.mag) {
          this.build.mag.position.copy(this.magRest);
          this.build.mag.rotation.set(0, 0, 0);
        }
      }
    }
    if (this.boltT > 0) this.boltT = Math.max(0, this.boltT - dt);
    if (this.slideT > 0) this.slideT = Math.max(0, this.slideT - dt);

    // sway amorti
    this.swayTarget.multiplyScalar(Math.max(0, 1 - dt * 5));
    this.sway.lerp(this.swayTarget, Math.min(1, dt * 9));

    const adsK = this.adsT;
    const bobAmp = (moving ? 1 : 0.22) * (1 - adsK * 0.88);
    const bobX = Math.sin(bobPhase) * 0.015 * bobAmp * (0.4 + speedFrac);
    const bobY = Math.abs(Math.cos(bobPhase)) * 0.012 * bobAmp * (0.4 + speedFrac);
    const bobRoll = Math.sin(bobPhase) * 0.02 * bobAmp;

    const p = this.hipPos.clone().lerp(this.adsPos, adsK);
    p.x += bobX + this.sway.x * (1 - adsK * 0.7);
    p.y += bobY + Math.sin(t * 1.6) * 0.0045 * (1 - adsK) + this.sway.y * (1 - adsK * 0.7);
    p.x += Math.sin(t * 0.72) * 0.0032 * (1 - adsK);
    p.z += this.recoilZ;
    if (crouched) p.y += 0.012;

    let rotX = this.recoilRot;
    let rotY = this.recoilYaw + this.sway.x * 1.6 * (1 - adsK * 0.6);
    let rotZ = bobRoll * (1 - adsK) - this.sway.x * 2.2 * (1 - adsK * 0.5);

    // ═══ animation de rechargement (propre à chaque type d'arme) ═══
    if (this.reloadT > 0 && this.build) {
      const k = Math.min(1, this.reloadT / this.reloadDur);   // 0 → 1
      const kind = this.build.reloadKind;
      const mag = this.build.mag;

      if (kind === 'mag') {
        // 1. l'arme s'incline  2. le chargeur tombe  3. nouveau chargeur inséré  4. redressement
        const tilt = k < 0.18 ? k / 0.18 : k > 0.82 ? (1 - k) / 0.18 : 1;
        p.y -= tilt * 0.14;
        p.x += tilt * 0.035;
        p.z += tilt * 0.05;
        rotX += tilt * 0.5;
        rotZ += tilt * 0.34;
        rotY += tilt * 0.2;
        if (mag) {
          if (k < 0.42) {
            // éjection : le chargeur chute et tourne
            const e = Math.max(0, (k - 0.14) / 0.28);
            mag.position.y = this.magRest.y - e * e * 0.42;
            mag.position.z = this.magRest.z + e * 0.05;
            mag.rotation.x = e * 0.7;
          } else if (k < 0.62) {
            mag.position.y = this.magRest.y - 0.6;      // hors champ
          } else {
            // insertion : remonte en butée
            const ins = Math.min(1, (k - 0.62) / 0.26);
            const ease = 1 - Math.pow(1 - ins, 3);
            mag.position.y = this.magRest.y - (1 - ease) * 0.5;
            mag.position.z = this.magRest.z + (1 - ease) * 0.03;
            mag.rotation.x = (1 - ease) * 0.3;
            // petite tape sous le chargeur à l'insertion
            if (ins > 0.9) p.y -= 0.012;
          }
        }
        // réarmement de la culasse en fin de cycle
        if (k > 0.9) {
          const c = Math.sin((k - 0.9) / 0.1 * Math.PI);
          for (const mp of this.build.movingParts) mp.position.z = c * 0.05;
        }
      } else if (kind === 'cylinder') {
        // revolver : barillet basculé, douilles éjectées, rotation de fermeture
        const open = k < 0.2 ? k / 0.2 : k > 0.78 ? (1 - k) / 0.22 : 1;
        p.y -= open * 0.1;
        rotZ += open * 0.55;
        rotX += open * 0.3;
        if (mag) {
          mag.position.x = this.magRest.x - open * 0.07;
          mag.rotation.z = open * 0.95;
          mag.rotation.y = k > 0.55 ? (k - 0.55) * 7 : 0;
        }
      } else if (kind === 'shells') {
        // fusil à pompe : cartouches insérées une par une + pompage final
        const n = 4;
        const seg = 0.74 / n;
        p.y -= 0.07;
        rotX += 0.26;
        rotZ += 0.14;
        if (k < 0.74) {
          const pulse = Math.sin((k % seg) / seg * Math.PI);
          p.x += pulse * 0.045;
          p.y -= pulse * 0.03;
          rotY += pulse * 0.12;
        } else {
          const pump = Math.sin((k - 0.74) / 0.26 * Math.PI);
          for (const mp of this.build.movingParts) mp.position.z = pump * 0.1;
          p.z += pump * 0.03;
        }
      } else {
        // mitrailleuse : capot ouvert, bande replacée, capot refermé
        const lid = k < 0.25 ? k / 0.25 : k > 0.8 ? (1 - k) / 0.2 : 1;
        p.y -= lid * 0.16;
        p.x += lid * 0.05;
        rotX += lid * 0.62;
        rotZ += lid * 0.4;
        if (mag) mag.rotation.x = lid * 0.6;
        if (k > 0.45 && k < 0.78) {
          const feed = Math.sin((k - 0.45) / 0.33 * Math.PI);
          p.y -= feed * 0.03;
          rotY += feed * 0.14;
        }
      }
    } else if (this.equipT > 0) {
      const k = this.equipT / Math.max(0.0001, this.equipDur);
      const e = k * k;                       // sortie douce
      p.y -= e * 0.17;
      p.z += e * 0.05;
      p.x += e * 0.03;
      rotX += e * 0.42;
      rotZ += e * 0.14;
    }

    // cycle de verrou (snipers)
    if (this.boltT > 0 && this.build) {
      const k = Math.sin((1 - this.boltT / this.boltDur) * Math.PI);
      rotX += k * 0.1;
      rotY += k * 0.07;
      for (const mp of this.build.movingParts) {
        mp.position.z = k * 0.1;
        mp.rotation.z = k * 0.9;
      }
    } else if (this.build) {
      // culasse qui recule à chaque tir
      const s = this.slideT > 0 ? Math.sin((this.slideT / 0.07) * Math.PI) : 0;
      for (const mp of this.build.movingParts) {
        mp.position.z = s * 0.055;
        mp.rotation.z = 0;
      }
    }

    this.recoilZ = Math.max(0, this.recoilZ - dt * 0.75);
    this.recoilRot = Math.max(0, this.recoilRot - dt * 1.3);
    this.recoilYaw *= Math.max(0, 1 - dt * 7);

    this.group.position.copy(p);
    this.group.rotation.set(rotX, rotY, rotZ);
    // le dévers s'annule en visée pour aligner la mire sur le centre de l'écran
    const k = 1 - adsK;
    this.rig.rotation.set(0.012 * k, 0.085 * k, 0.028 * k);
    this.light.intensity = 1.1 * (1 - adsK * 0.5);
    if (this.hands) this.hands.visible = this.showHands && adsK < 0.995;
  }

  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.gunTip.getWorldPosition(out);
  }
  ejectWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.build ? this.build.ejectPort.getWorldPosition(out) : this.gunTip.getWorldPosition(out);
  }
}
