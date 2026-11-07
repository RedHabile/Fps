// ─────────────────────────────────────────────────────────────
//  VALENCE — Le Spike : objectif de la manche
//  Les attaquants le portent, le posent sur un site, puis le
//  défendent 45 s. Les défenseurs doivent le désamorcer.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const SPIKE_TIMER = 45;       // s avant explosion
export const PLANT_TIME = 4;         // s de pose
export const DEFUSE_TIME = 7;        // s de désamorçage complet
export const DEFUSE_HALF = 3.5;      // point de sauvegarde à mi-parcours
export const PLANT_RADIUS = 1.9;     // distance d'interaction
export const SITE_RADIUS_BONUS = 0;  // marge sur le rayon du site

export type SpikeStatus = 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded';

export class Spike {
  group = new THREE.Group();
  status: SpikeStatus = 'carried';
  pos = new THREE.Vector3();
  /** porteur : null = joueur, Bot = IA, undefined = personne */
  carrier: unknown = null;
  timer = SPIKE_TIMER;
  plantT = 0;
  defuseT = 0;
  defuseSaved = false;     // le désamorçage a dépassé la moitié
  site: 'A' | 'B' | null = null;

  private core: THREE.Mesh;
  private ring: THREE.Mesh;
  private light: THREE.PointLight;
  private beacon: THREE.Mesh;
  private mats: THREE.MeshStandardMaterial[] = [];
  private beepAcc = 0;

  constructor() {
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.55, metalness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: 0x2a0d12, emissive: new THREE.Color(0xff3344), emissiveIntensity: 2.2, roughness: 0.4 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc89a3c, roughness: 0.35, metalness: 0.8 });
    this.mats = [dark, red, gold];

    // socle trapézoïdal
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.1, 6), dark);
    base.position.y = 0.05;
    this.group.add(base);
    // corps principal
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.32, 6), dark);
    body.position.y = 0.26;
    this.group.add(body);
    // bandes dorées
    for (const y of [0.16, 0.38]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.02, 6, 14), gold);
      r.rotation.x = Math.PI / 2;
      r.position.y = y;
      this.group.add(r);
    }
    // noyau lumineux
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), red);
    this.core.position.y = 0.45;
    this.group.add(this.core);
    // anneau rotatif
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 20), red);
    this.ring.position.y = 0.45;
    this.group.add(this.ring);
    // antennes
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), dark);
      leg.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15);
      leg.rotation.z = Math.cos(a) * 0.35;
      leg.rotation.x = -Math.sin(a) * 0.35;
      this.group.add(leg);
    }
    this.light = new THREE.PointLight(0xff3344, 2.4, 7, 2);
    this.light.position.y = 0.45;
    this.group.add(this.light);

    // faisceau vertical visible de loin une fois posé
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff3344, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.75, 14, 10, 1, true), beaconMat);
    this.beacon.position.y = 7;
    this.beacon.visible = false;
    this.group.add(this.beacon);

    this.group.visible = false;
  }

  reset() {
    this.status = 'carried';
    this.timer = SPIKE_TIMER;
    this.plantT = 0;
    this.defuseT = 0;
    this.defuseSaved = false;
    this.site = null;
    this.carrier = null;
    this.group.visible = false;
    this.beacon.visible = false;
  }

  dropAt(x: number, z: number) {
    this.status = 'dropped';
    this.carrier = undefined;
    this.pos.set(x, 0, z);
    this.group.position.copy(this.pos);
    this.group.visible = true;
    this.beacon.visible = false;
    this.plantT = 0;
  }

  plantAt(x: number, z: number, site: 'A' | 'B') {
    this.status = 'planted';
    this.carrier = undefined;
    this.site = site;
    this.timer = SPIKE_TIMER;
    this.defuseT = 0;
    this.defuseSaved = false;
    this.pos.set(x, 0, z);
    this.group.position.copy(this.pos);
    this.group.visible = true;
    this.beacon.visible = true;
  }

  /** @returns 'boom' si le compte à rebours arrive à zéro */
  update(dt: number, t: number): 'boom' | null {
    this.ring.rotation.y = t * 1.6;
    this.ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.8) * 0.25;

    if (this.status === 'planted') {
      this.timer -= dt;
      // clignotement de plus en plus rapide
      const urgency = 1 - Math.max(0, this.timer) / SPIKE_TIMER;
      const rate = 1.2 + urgency * 7;
      this.beepAcc += dt * rate;
      const blink = Math.sin(this.beepAcc * Math.PI * 2) > 0 ? 1 : 0.18;
      this.setGlow(2.2 + urgency * 3) ;
      this.light.intensity = (1.6 + urgency * 4) * blink;
      this.core.scale.setScalar(1 + urgency * 0.35 * blink);
      (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.12 + urgency * 0.16;
      if (this.timer <= 0) { this.status = 'exploded'; return 'boom'; }
    } else if (this.status === 'dropped') {
      this.group.position.y = Math.sin(t * 1.8) * 0.04;
      this.light.intensity = 1.6 + Math.sin(t * 3) * 0.5;
    }
    return null;
  }

  private setGlow(v: number) {
    this.mats[1].emissiveIntensity = v;
  }

  /** fraction de temps restant (0..1) */
  get fuse() { return Math.max(0, this.timer) / SPIKE_TIMER; }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    for (const m of this.mats) m.dispose();
  }
}
