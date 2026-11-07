// ─────────────────────────────────────────────────────────────
//  VALENCE — Modèles 3D détaillés (armes en vue FPS + agents)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import type { ModelKey } from './weapons';

// ——— Matériaux partagés ———
const M = {
  gunmetal: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.42, metalness: 0.72 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.3, metalness: 0.85 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.86, metalness: 0.05 }),
  polymerLight: new THREE.MeshStandardMaterial({ color: 0x3b424d, roughness: 0.8, metalness: 0.08 }),
  accentRed: new THREE.MeshStandardMaterial({ color: 0xff4655, roughness: 0.4, metalness: 0.35, emissive: 0x3a0a10, emissiveIntensity: 1 }),
  accentGold: new THREE.MeshStandardMaterial({ color: 0xd8a24a, roughness: 0.32, metalness: 0.85 }),
  glowTeal: new THREE.MeshStandardMaterial({ color: 0x0e1418, emissive: 0x2de3c2, emissiveIntensity: 2.1, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.08, metalness: 0.4, emissive: 0x123b4a, emissiveIntensity: 1.3 }),
  grip: new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.96, metalness: 0.02 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.78, metalness: 0.03 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x4e5663, roughness: 0.86, metalness: 0.07 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x343b45, roughness: 0.94, metalness: 0.03 }),
};

// ——— Géométries réutilisables ———
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cylLow: new THREE.CylinderGeometry(0.5, 0.5, 1, 9),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  sphere: new THREE.SphereGeometry(0.5, 14, 11),
  torus: new THREE.TorusGeometry(0.5, 0.12, 8, 18),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 5, 12),
};

type Vec = [number, number, number];

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: Vec, scale: Vec, rot?: Vec) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}
const bx = (p: THREE.Object3D, mat: THREE.Material, pos: Vec, s: Vec, rot?: Vec) => add(p, G.box, mat, pos, s, rot);
/** cylindre orienté selon l'axe Z (canon) */
const tube = (p: THREE.Object3D, mat: THREE.Material, pos: Vec, r: number, len: number) =>
  add(p, G.cyl, mat, pos, [r * 2, len, r * 2], [Math.PI / 2, 0, 0]);
/** cylindre vertical */
const post = (p: THREE.Object3D, mat: THREE.Material, pos: Vec, r: number, h: number) =>
  add(p, G.cyl, mat, pos, [r * 2, h, r * 2]);

// ═════════════════════════════════════════════════════════════
//  ARMES — vue subjective
//  Convention : l'arme pointe vers -Z, la bouche est en avant.
// ═════════════════════════════════════════════════════════════
export interface GunBuild {
  group: THREE.Group;
  muzzleZ: number;          // position Z de la bouche
  muzzleY: number;
  sightY: number;           // hauteur de la ligne de visée (pour l'ADS)
  grip: Vec;                // ancrage de la main de tir
  fore: Vec;                // ancrage de la main avant
  ejectPort: THREE.Object3D;
  movingParts: THREE.Object3D[];  // culasse / pompe (animation)
  mag: THREE.Object3D | null;     // chargeur détachable (rechargement)
  reloadKind: 'mag' | 'shells' | 'belt' | 'cylinder';
}

/** garde de pèse-détente + détente */
function triggerGroup(g: THREE.Group, z: number, y = -0.035) {
  add(g, G.torus, M.gunmetal, [0, y - 0.03, z], [0.1, 0.1, 0.05], [Math.PI / 2, 0, 0]);
  bx(g, M.darkSteel, [0, y - 0.012, z], [0.012, 0.038, 0.014], [0.2, 0, 0]);
}

/** Mire métallique : guidon protégé par des oreilles + hausse à encoche en U */
function ironSights(g: THREE.Group, frontZ: number, rearZ: number, y: number) {
  // ─ guidon avant : embase, lame, oreilles de protection, point lumineux
  bx(g, M.darkSteel, [0, y + 0.008, frontZ], [0.034, 0.016, 0.026]);          // embase
  bx(g, M.darkSteel, [0, y + 0.03, frontZ], [0.007, 0.034, 0.009]);           // lame
  add(g, G.sphere, M.glowTeal, [0, y + 0.045, frontZ], [0.011, 0.011, 0.011]); // point tritium
  for (const sx of [-1, 1]) {
    bx(g, M.darkSteel, [sx * 0.019, y + 0.032, frontZ], [0.008, 0.042, 0.022], [0, 0, -sx * 0.1]);
  }
  bx(g, M.darkSteel, [0, y + 0.052, frontZ], [0.046, 0.007, 0.02]);            // pont supérieur

  // ─ hausse arrière : bloc avec encoche en U + 2 points lumineux
  bx(g, M.darkSteel, [0, y + 0.012, rearZ], [0.054, 0.018, 0.022]);
  for (const sx of [-1, 1]) {
    bx(g, M.darkSteel, [sx * 0.019, y + 0.032, rearZ], [0.016, 0.03, 0.02]);
    add(g, G.sphere, M.glowTeal, [sx * 0.019, y + 0.04, rearZ - 0.008], [0.009, 0.009, 0.009]);
  }
  bx(g, M.gunmetal, [0, y + 0.022, rearZ], [0.014, 0.012, 0.021]);             // fond de l'encoche
}

/** Hausse à œilleton (type diopter) : anneau circulaire traversé par l'œil */
function apertureSight(g: THREE.Group, z: number, y: number) {
  add(g, G.torus, M.darkSteel, [0, y + 0.034, z], [0.052, 0.052, 0.3], [0, 0, 0]);
  bx(g, M.darkSteel, [0, y + 0.008, z], [0.03, 0.038, 0.022]);
  add(g, G.cyl, M.gunmetal, [0, y + 0.034, z], [0.042, 0.016, 0.042], [Math.PI / 2, 0, 0]);
}

/** Viseur point rouge : boîtier ouvert, lentille teintée, réticule émissif */
function redDot(g: THREE.Group, z: number, y: number, tint = 0xff3344) {
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: new THREE.Color(tint), emissiveIntensity: 3.2, roughness: 0.3 });
  // embase + corps en U
  bx(g, M.gunmetal, [0, y + 0.008, z], [0.042, 0.02, 0.07]);
  bx(g, M.gunmetal, [0, y + 0.03, z - 0.032], [0.044, 0.05, 0.012]);  // montant avant
  bx(g, M.gunmetal, [0, y + 0.03, z + 0.032], [0.044, 0.05, 0.012]);  // montant arrière
  bx(g, M.gunmetal, [0, y + 0.057, z], [0.046, 0.011, 0.076]);        // capot
  // lentille inclinée + réticule
  add(g, G.box, M.glass, [0, y + 0.032, z - 0.016], [0.038, 0.042, 0.005], [0.16, 0, 0]);
  add(g, G.sphere, dotMat, [0, y + 0.032, z - 0.012], [0.008, 0.008, 0.004]);
  // molette de luminosité
  post(g, M.darkSteel, [0.026, y + 0.03, z + 0.01], 0.012, 0.016).rotation.z = Math.PI / 2;
}

/** Viseur holographique : grande fenêtre rectangulaire, réticule cercle-point */
function holoSight(g: THREE.Group, z: number, y: number) {
  const reticle = new THREE.MeshStandardMaterial({ color: 0x080c10, emissive: new THREE.Color(0xff2a3a), emissiveIntensity: 2.8, roughness: 0.35 });
  bx(g, M.polymer, [0, y + 0.012, z + 0.03], [0.05, 0.03, 0.09]);        // corps / logement pile
  bx(g, M.gunmetal, [0, y + 0.04, z + 0.056], [0.052, 0.042, 0.03]);     // bloc arrière
  for (const sx of [-1, 1]) bx(g, M.gunmetal, [sx * 0.024, y + 0.046, z - 0.006], [0.008, 0.054, 0.056]);
  bx(g, M.gunmetal, [0, y + 0.072, z - 0.006], [0.056, 0.009, 0.058]);   // capot
  add(g, G.box, M.glass, [0, y + 0.046, z - 0.02], [0.042, 0.048, 0.004], [0.1, 0, 0]);
  // réticule : anneau + point
  add(g, G.torus, reticle, [0, y + 0.046, z - 0.016], [0.03, 0.03, 0.12]);
  add(g, G.sphere, reticle, [0, y + 0.046, z - 0.016], [0.007, 0.007, 0.004]);
  post(g, M.darkSteel, [0.028, y + 0.03, z + 0.052], 0.011, 0.014).rotation.z = Math.PI / 2;
}

/** Viseur reflex compact (fenêtre ronde) : pistolets et PM */
function reflexSight(g: THREE.Group, z: number, y: number, tint = 0xff3344) {
  const dot = new THREE.MeshStandardMaterial({ color: 0x090c10, emissive: new THREE.Color(tint), emissiveIntensity: 3.4, roughness: 0.3 });
  bx(g, M.gunmetal, [0, y + 0.006, z], [0.034, 0.014, 0.05]);                 // embase
  add(g, G.torus, M.gunmetal, [0, y + 0.032, z], [0.062, 0.062, 0.22], [0.14, 0, 0]);
  add(g, G.cyl, M.glass, [0, y + 0.032, z], [0.052, 0.005, 0.052], [Math.PI / 2 + 0.14, 0, 0]);
  add(g, G.sphere, dot, [0, y + 0.032, z - 0.004], [0.007, 0.007, 0.004]);
  bx(g, M.gunmetal, [0, y + 0.02, z + 0.026], [0.03, 0.03, 0.012]);           // montant arrière
}

/** Lunette courte à fort grossissement, montée en hauteur (fusils) */
function acogSight(g: THREE.Group, z: number, y: number) {
  tube(g, M.darkSteel, [0, y + 0.038, z], 0.03, 0.17);
  tube(g, M.gunmetal, [0, y + 0.038, z - 0.1], 0.036, 0.03);
  tube(g, M.gunmetal, [0, y + 0.038, z + 0.1], 0.032, 0.03);
  add(g, G.cyl, M.glass, [0, y + 0.038, z + 0.118], [0.058, 0.01, 0.058], [Math.PI / 2, 0, 0]);
  add(g, G.cyl, M.glass, [0, y + 0.038, z - 0.118], [0.066, 0.01, 0.066], [Math.PI / 2, 0, 0]);
  post(g, M.gunmetal, [0, y + 0.072, z], 0.013, 0.022);                       // tourelle
  bx(g, M.gunmetal, [0, y + 0.012, z - 0.04], [0.03, 0.042, 0.022]);          // colliers
  bx(g, M.gunmetal, [0, y + 0.012, z + 0.04], [0.03, 0.042, 0.022]);
  bx(g, M.accentRed, [0.021, y + 0.038, z], [0.004, 0.018, 0.1]);             // liseré
}

/** Laser + lampe sous le canon */
function laserModule(g: THREE.Group, z: number, y: number) {
  bx(g, M.gunmetal, [0, y, z], [0.03, 0.026, 0.07]);
  add(g, G.cyl, M.glowTeal, [0.009, y, z - 0.038], [0.013, 0.012, 0.013], [Math.PI / 2, 0, 0]);
  add(g, G.cyl, M.glass, [-0.009, y, z - 0.038], [0.016, 0.012, 0.016], [Math.PI / 2, 0, 0]);
}

/** Mire pliable de secours (backup) inclinée à 45° */
function offsetSight(g: THREE.Group, z: number, y: number) {
  bx(g, M.darkSteel, [0.03, y + 0.026, z], [0.012, 0.03, 0.016], [0, 0, -0.7]);
  bx(g, M.darkSteel, [0.03, y + 0.026, z + 0.1], [0.018, 0.026, 0.014], [0, 0, -0.7]);
}

/** rail Picatinny cranté */
function rail(g: THREE.Group, z0: number, z1: number, y: number, mat = M.gunmetal) {
  const len = z1 - z0;
  bx(g, mat, [0, y, (z0 + z1) / 2], [0.028, 0.012, len]);
  const n = Math.max(3, Math.floor(len / 0.035));
  for (let i = 0; i < n; i++) {
    bx(g, M.darkSteel, [0, y + 0.009, z0 + (i + 0.5) * (len / n)], [0.032, 0.008, 0.012]);
  }
}

/** lunette de visée complète */
function scope(g: THREE.Group, z: number, y: number, len: number, r: number) {
  tube(g, M.darkSteel, [0, y, z], r, len);
  tube(g, M.gunmetal, [0, y, z - len / 2 - 0.02], r * 1.22, 0.05);
  tube(g, M.gunmetal, [0, y, z + len / 2 + 0.02], r * 1.3, 0.05);
  add(g, G.cyl, M.glass, [0, y, z + len / 2 + 0.045], [r * 2.4, 0.012, r * 2.4], [Math.PI / 2, 0, 0]);
  add(g, G.cyl, M.glass, [0, y, z - len / 2 - 0.045], [r * 2.2, 0.012, r * 2.2], [Math.PI / 2, 0, 0]);
  // tourelles de réglage
  post(g, M.gunmetal, [0, y + r * 1.5, z + 0.02], 0.016, 0.03);
  post(g, M.gunmetal, [r * 1.4, y, z + 0.02], 0.014, 0.028).rotation.z = Math.PI / 2;
  // colliers de montage
  bx(g, M.gunmetal, [0, y - r * 1.1, z - len * 0.28], [0.03, 0.04, 0.022]);
  bx(g, M.gunmetal, [0, y - r * 1.1, z + len * 0.28], [0.03, 0.04, 0.022]);
}

/** chargeur incurvé (empilement de segments) */
/** Chargeur incurvé, renvoyé dans son propre groupe pour pouvoir l'animer. */
function curvedMag(g: THREE.Group, x: number, y: number, z: number, segs: number, w: number, dep: number, step: number, mat: THREE.Material) {
  const mag = new THREE.Group();
  mag.position.set(x, y, z);
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    bx(mag, i === segs - 1 ? M.darkSteel : mat,
      [0, -i * step, t * t * 0.055],
      [w, step * 1.06, dep - t * 0.012],
      [t * 0.22, 0, 0]);
  }
  // languette de préhension
  bx(mag, M.accentRed, [0, -(segs - 1) * step, 0.012], [w * 1.04, step * 0.3, dep * 0.5]);
  g.add(mag);
  return mag;
}

export function buildGun(key: ModelKey): GunBuild {
  const g = new THREE.Group();
  const moving: THREE.Object3D[] = [];
  let muzzleZ = -0.4, muzzleY = 0.02, sightY = 0.06;
  let magPart: THREE.Object3D | null = null;
  let reloadKind: 'mag' | 'shells' | 'belt' | 'cylinder' = 'mag';
  let grip: Vec = [0, -0.085, 0.05];
  let fore: Vec = [0, -0.03, -0.2];
  const port = new THREE.Object3D();

  switch (key) {
    // ───────────── PISTOLETS ─────────────
    case 'pistol_basic': {
      reloadKind = 'mag';
      const slide = new THREE.Group();
      bx(slide, M.gunmetal, [0, 0.035, -0.07], [0.048, 0.055, 0.3]);
      bx(slide, M.darkSteel, [0, 0.058, -0.07], [0.03, 0.014, 0.28]);
      for (let i = 0; i < 5; i++) bx(slide, M.darkSteel, [0.025, 0.032, 0.035 - i * 0.016], [0.004, 0.04, 0.006]);
      for (let i = 0; i < 5; i++) bx(slide, M.darkSteel, [-0.025, 0.032, 0.035 - i * 0.016], [0.004, 0.04, 0.006]);
      g.add(slide); moving.push(slide);
      bx(g, M.polymer, [0, -0.005, -0.03], [0.044, 0.045, 0.22]);
      tube(g, M.darkSteel, [0, 0.035, -0.235], 0.011, 0.06);
      bx(g, M.grip, [0, -0.085, 0.045], [0.042, 0.13, 0.062], [0.3, 0, 0]);
      magPart = curvedMag(g, 0, -0.06, 0.047, 2, 0.032, 0.05, 0.055, M.darkSteel);
      triggerGroup(g, -0.005);
      ironSights(g, -0.19, 0.055, 0.055);
      reflexSight(g, -0.02, 0.062, 0xffd25d);
      bx(g, M.accentRed, [0, 0.005, 0.085], [0.036, 0.03, 0.03]);
      port.position.set(0.028, 0.05, -0.02);
      muzzleZ = -0.27; muzzleY = 0.035; sightY = 0.083;
      break;
    }
    case 'pistol_auto': {
      const slide = new THREE.Group();
      bx(slide, M.gunmetal, [0, 0.038, -0.09], [0.05, 0.058, 0.34]);
      bx(slide, M.accentRed, [0.026, 0.038, -0.09], [0.004, 0.02, 0.3]);
      bx(slide, M.accentRed, [-0.026, 0.038, -0.09], [0.004, 0.02, 0.3]);
      for (let i = 0; i < 6; i++) bx(slide, M.darkSteel, [0, 0.066, 0.04 - i * 0.02], [0.034, 0.008, 0.008]);
      g.add(slide); moving.push(slide);
      bx(g, M.polymer, [0, -0.008, -0.05], [0.046, 0.048, 0.26]);
      tube(g, M.darkSteel, [0, 0.038, -0.275], 0.012, 0.07);
      bx(g, M.grip, [0, -0.095, 0.04], [0.044, 0.15, 0.064], [0.26, 0, 0]);
      magPart = curvedMag(g, 0, -0.07, 0.042, 3, 0.036, 0.05, 0.05, M.darkSteel);
      triggerGroup(g, -0.01);
      ironSights(g, -0.225, 0.06, 0.058);
      reflexSight(g, -0.03, 0.066, 0xff3344);
      bx(g, M.glowTeal, [0, 0.0, -0.17], [0.03, 0.012, 0.05]);
      port.position.set(0.03, 0.052, -0.03);
      muzzleZ = -0.32; muzzleY = 0.038; sightY = 0.088;
      break;
    }
    case 'pistol_sup': {
      const slide = new THREE.Group();
      bx(slide, M.gunmetal, [0, 0.036, -0.08], [0.046, 0.054, 0.32]);
      bx(slide, M.darkSteel, [0, 0.06, -0.08], [0.028, 0.012, 0.3]);
      g.add(slide); moving.push(slide);
      bx(g, M.polymer, [0, -0.006, -0.04], [0.044, 0.046, 0.24]);
      // silencieux segmenté
      tube(g, M.darkSteel, [0, 0.036, -0.33], 0.023, 0.21);
      for (let i = 0; i < 4; i++) tube(g, M.gunmetal, [0, 0.036, -0.26 - i * 0.05], 0.025, 0.008);
      bx(g, M.grip, [0, -0.088, 0.042], [0.042, 0.135, 0.062], [0.3, 0, 0]);
      magPart = curvedMag(g, 0, -0.062, 0.044, 2, 0.032, 0.05, 0.055, M.darkSteel);
      triggerGroup(g, -0.008);
      ironSights(g, -0.2, 0.058, 0.056);
      reflexSight(g, -0.02, 0.064, 0x2de3c2);
      laserModule(g, -0.14, -0.022);
      port.position.set(0.028, 0.05, -0.025);
      muzzleZ = -0.44; muzzleY = 0.036; sightY = 0.085;
      break;
    }
    case 'revolver': {
      reloadKind = 'cylinder';
      bx(g, M.gunmetal, [0, 0.03, -0.1], [0.04, 0.05, 0.3]);
      // barillet cannelé
      const cylGrp = new THREE.Group();
      cylGrp.position.set(0, 0.025, 0.015);
      add(cylGrp, G.cyl, M.darkSteel, [0, 0, 0], [0.088, 0.085, 0.088], [Math.PI / 2, 0, 0]);
      g.add(cylGrp);
      magPart = cylGrp;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(cylGrp, G.cyl, M.gunmetal, [Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0], [0.018, 0.088, 0.018], [Math.PI / 2, 0, 0]);
      }
      tube(g, M.darkSteel, [0, 0.03, -0.26], 0.014, 0.1);
      bx(g, M.gunmetal, [0, 0.055, -0.19], [0.03, 0.02, 0.22]);  // bande supérieure
      bx(g, M.wood, [0, -0.09, 0.075], [0.04, 0.14, 0.07], [0.34, 0, 0]);
      bx(g, M.accentGold, [0, -0.05, 0.055], [0.042, 0.03, 0.05], [0.34, 0, 0]);
      triggerGroup(g, 0.0);
      bx(g, M.darkSteel, [0, 0.062, 0.1], [0.022, 0.03, 0.03], [-0.4, 0, 0]); // chien
      ironSights(g, -0.22, 0.07, 0.062);
      reflexSight(g, -0.04, 0.072, 0xffd25d);
      muzzleZ = -0.31; muzzleY = 0.03; sightY = 0.09;
      port.position.set(0.04, 0.03, 0.015);
      break;
    }

    // ───────────── FUSIL À POMPE ─────────────
    case 'shotgun': {
      reloadKind = 'shells';
      bx(g, M.gunmetal, [0, 0.0, -0.02], [0.058, 0.08, 0.38]);
      bx(g, M.polymer, [0, 0.042, -0.02], [0.05, 0.03, 0.36]);
      tube(g, M.darkSteel, [0, 0.012, -0.36], 0.024, 0.32);       // canon
      tube(g, M.gunmetal, [0, -0.038, -0.3], 0.019, 0.42);        // tube magasin
      // pompe coulissante
      const pump = new THREE.Group();
      bx(pump, M.polymerLight, [0, -0.035, -0.26], [0.066, 0.055, 0.14]);
      for (let i = 0; i < 6; i++) bx(pump, M.grip, [0, -0.035, -0.32 + i * 0.022], [0.07, 0.05, 0.008]);
      g.add(pump); moving.push(pump);
      bx(g, M.grip, [0, -0.1, 0.1], [0.05, 0.15, 0.07], [0.28, 0, 0]);
      bx(g, M.polymer, [0, -0.015, 0.25], [0.052, 0.1, 0.22], [0.1, 0, 0]);   // crosse
      bx(g, M.accentRed, [0, 0.058, 0.08], [0.03, 0.012, 0.1]);
      triggerGroup(g, 0.055, -0.045);
      ironSights(g, -0.5, 0.12, 0.05);
      apertureSight(g, 0.13, 0.048);
      reflexSight(g, -0.06, 0.07, 0xff8a5d);
      port.position.set(0.035, 0.0, 0.04);
      muzzleZ = -0.52; muzzleY = 0.012; sightY = 0.08;
      break;
    }

    // ───────────── PM ─────────────
    case 'smg': {
      bx(g, M.polymer, [0, 0.0, -0.05], [0.055, 0.085, 0.42]);
      bx(g, M.gunmetal, [0, 0.045, -0.05], [0.046, 0.03, 0.4]);
      const bolt = new THREE.Group();
      bx(bolt, M.darkSteel, [0.03, 0.045, 0.05], [0.014, 0.022, 0.08]);
      g.add(bolt); moving.push(bolt);
      tube(g, M.darkSteel, [0, 0.012, -0.32], 0.014, 0.22);
      tube(g, M.gunmetal, [0, 0.012, -0.43], 0.021, 0.07);        // frein de bouche
      bx(g, M.polymerLight, [0, -0.02, -0.26], [0.05, 0.05, 0.16]);  // garde-main
      for (let i = 0; i < 4; i++) bx(g, M.darkSteel, [0, 0.0, -0.31 + i * 0.03], [0.054, 0.006, 0.012]);
      magPart = curvedMag(g, 0, -0.085, -0.04, 4, 0.038, 0.09, 0.048, M.polymer);
      bx(g, M.grip, [0, -0.105, 0.075], [0.044, 0.14, 0.06], [0.22, 0, 0]);
      bx(g, M.gunmetal, [0, 0.01, 0.21], [0.03, 0.055, 0.16]);     // crosse repliable
      bx(g, M.polymer, [0, 0.01, 0.3], [0.05, 0.075, 0.03]);
      triggerGroup(g, 0.01);
      rail(g, -0.2, 0.08, 0.063);
      ironSights(g, -0.22, 0.09, 0.07);
      redDot(g, 0.0, 0.069, 0x45e0ff);
      laserModule(g, -0.3, -0.052);
      bx(g, M.glowTeal, [0.028, -0.02, -0.26], [0.006, 0.02, 0.1]);
      port.position.set(0.032, 0.04, 0.0);
      muzzleZ = -0.47; muzzleY = 0.012; sightY = 0.101;
      break;
    }

    // ───────────── FUSILS ─────────────
    case 'rifle_semi': {
      bx(g, M.gunmetal, [0, 0.0, -0.02], [0.05, 0.085, 0.46]);
      bx(g, M.wood, [0, -0.015, -0.3], [0.056, 0.07, 0.26]);       // garde-main bois
      for (let i = 0; i < 5; i++) bx(g, M.darkSteel, [0.03, -0.015, -0.4 + i * 0.045], [0.004, 0.05, 0.018]);
      tube(g, M.darkSteel, [0, 0.015, -0.56], 0.013, 0.28);
      tube(g, M.gunmetal, [0, 0.015, -0.69], 0.019, 0.05);
      magPart = curvedMag(g, 0, -0.08, 0.0, 4, 0.04, 0.085, 0.05, M.darkSteel);
      bx(g, M.wood, [0, -0.105, 0.13], [0.046, 0.14, 0.07], [0.26, 0, 0]);
      bx(g, M.wood, [0, -0.01, 0.3], [0.05, 0.1, 0.24], [0.06, 0, 0]);
      bx(g, M.accentGold, [0, 0.048, 0.1], [0.036, 0.012, 0.14]);
      triggerGroup(g, 0.06);
      acogSight(g, 0.0, 0.082);
      ironSights(g, -0.64, 0.17, 0.055);
      offsetSight(g, -0.3, 0.06);
      port.position.set(0.032, 0.03, 0.02);
      muzzleZ = -0.73; muzzleY = 0.015; sightY = 0.11;
      break;
    }
    case 'rifle_auto': {
      bx(g, M.gunmetal, [0, 0.0, -0.04], [0.052, 0.09, 0.5]);
      bx(g, M.polymer, [0, 0.05, -0.04], [0.044, 0.028, 0.48]);
      bx(g, M.polymerLight, [0, -0.02, -0.34], [0.052, 0.062, 0.3]);  // garde-main
      for (let i = 0; i < 6; i++) bx(g, M.darkSteel, [0, -0.052, -0.46 + i * 0.045], [0.044, 0.008, 0.02]);
      tube(g, M.darkSteel, [0, 0.01, -0.62], 0.014, 0.3);
      tube(g, M.gunmetal, [0, 0.01, -0.77], 0.022, 0.06);            // cache-flamme
      for (let i = 0; i < 3; i++) bx(g, M.darkSteel, [0, 0.032, -0.76 + i * 0.02], [0.012, 0.016, 0.008]);
      magPart = curvedMag(g, 0, -0.085, -0.02, 5, 0.042, 0.095, 0.05, M.polymer);
      bx(g, M.grip, [0, -0.115, 0.1], [0.046, 0.15, 0.062], [0.2, 0, 0]);
      bx(g, M.polymer, [0, 0.0, 0.26], [0.034, 0.07, 0.2]);          // tube de crosse
      bx(g, M.polymerLight, [0, -0.005, 0.37], [0.05, 0.1, 0.05]);
      bx(g, M.accentRed, [0.028, 0.0, -0.1], [0.006, 0.05, 0.3]);
      bx(g, M.accentRed, [-0.028, 0.0, -0.1], [0.006, 0.05, 0.3]);
      const bolt = new THREE.Group();
      bx(bolt, M.darkSteel, [0.03, 0.045, 0.14], [0.016, 0.02, 0.07]);
      g.add(bolt); moving.push(bolt);
      triggerGroup(g, 0.045);
      rail(g, -0.3, 0.16, 0.07);
      ironSights(g, -0.34, 0.2, 0.076);
      holoSight(g, 0.01, 0.076);
      offsetSight(g, -0.2, 0.05);
      port.position.set(0.034, 0.04, 0.06);
      muzzleZ = -0.81; muzzleY = 0.01; sightY = 0.122;
      break;
    }
    case 'rifle_sup': {
      bx(g, M.polymer, [0, 0.0, -0.04], [0.05, 0.088, 0.5]);
      bx(g, M.gunmetal, [0, 0.05, -0.04], [0.042, 0.026, 0.48]);
      bx(g, M.polymerLight, [0, -0.018, -0.33], [0.05, 0.06, 0.3]);
      tube(g, M.darkSteel, [0, 0.01, -0.58], 0.014, 0.24);
      // gros silencieux intégré
      tube(g, M.gunmetal, [0, 0.01, -0.76], 0.028, 0.22);
      for (let i = 0; i < 5; i++) tube(g, M.darkSteel, [0, 0.01, -0.68 - i * 0.045], 0.03, 0.008);
      bx(g, M.glowTeal, [0.03, 0.01, -0.76], [0.004, 0.012, 0.16]);
      bx(g, M.glowTeal, [-0.03, 0.01, -0.76], [0.004, 0.012, 0.16]);
      magPart = curvedMag(g, 0, -0.085, -0.02, 5, 0.04, 0.1, 0.05, M.polymer);
      bx(g, M.grip, [0, -0.112, 0.1], [0.046, 0.148, 0.062], [0.2, 0, 0]);
      bx(g, M.polymer, [0, 0.0, 0.28], [0.046, 0.085, 0.24], [0.03, 0, 0]);
      const bolt = new THREE.Group();
      bx(bolt, M.darkSteel, [0.03, 0.045, 0.14], [0.015, 0.02, 0.07]);
      g.add(bolt); moving.push(bolt);
      triggerGroup(g, 0.045);
      rail(g, -0.3, 0.16, 0.068);
      ironSights(g, -0.32, 0.19, 0.074);
      redDot(g, 0.0, 0.074, 0x2de3c2);
      laserModule(g, -0.36, -0.052);
      port.position.set(0.034, 0.04, 0.06);
      muzzleZ = -0.88; muzzleY = 0.01; sightY = 0.112;
      break;
    }

    // ───────────── MITRAILLEUSE ─────────────
    case 'lmg': {
      reloadKind = 'belt';
      bx(g, M.gunmetal, [0, 0.0, -0.02], [0.07, 0.11, 0.56]);
      bx(g, M.darkSteel, [0, 0.06, -0.02], [0.05, 0.03, 0.54]);
      tube(g, M.darkSteel, [0, 0.01, -0.62], 0.018, 0.34);
      for (let i = 0; i < 7; i++) tube(g, M.gunmetal, [0, 0.01, -0.5 - i * 0.045], 0.023, 0.012);  // canon cannelé
      tube(g, M.gunmetal, [0, 0.01, -0.81], 0.028, 0.07);
      // boîte à munitions + bande
      bx(g, M.polymer, [0.035, -0.1, 0.02], [0.09, 0.12, 0.2]);
      bx(g, M.darkSteel, [0.035, -0.1, 0.02], [0.095, 0.03, 0.205]);
      for (let i = 0; i < 6; i++) bx(g, M.accentGold, [0.01 + i * 0.004, -0.045 + i * 0.006, -0.02 - i * 0.012], [0.008, 0.02, 0.008], [0.2, 0.3, 0]);
      bx(g, M.grip, [0, -0.13, 0.14], [0.05, 0.16, 0.065], [0.16, 0, 0]);
      bx(g, M.polymer, [0, -0.005, 0.32], [0.056, 0.11, 0.22], [0.04, 0, 0]);
      bx(g, M.polymerLight, [0, -0.05, -0.3], [0.05, 0.055, 0.2]);   // poignée avant
      bx(g, M.grip, [0, -0.13, -0.26], [0.04, 0.12, 0.05], [-0.22, 0, 0]);
      // bipied replié
      bx(g, M.darkSteel, [0.02, -0.09, -0.46], [0.012, 0.11, 0.012], [0.3, 0, 0.3]);
      bx(g, M.darkSteel, [-0.02, -0.09, -0.46], [0.012, 0.11, 0.012], [0.3, 0, -0.3]);
      bx(g, M.accentRed, [0, 0.08, 0.0], [0.03, 0.012, 0.18]);
      triggerGroup(g, 0.08, -0.05);
      rail(g, -0.26, 0.18, 0.082);
      ironSights(g, -0.44, 0.22, 0.088);
      holoSight(g, 0.02, 0.088);
      offsetSight(g, -0.22, 0.07);
      port.position.set(0.04, 0.03, 0.05);
      muzzleZ = -0.86; muzzleY = 0.01; sightY = 0.134;
      break;
    }

    // ───────────── SNIPERS ─────────────
    case 'sniper_light': {
      bx(g, M.polymer, [0, 0.0, 0.0], [0.046, 0.08, 0.5]);
      bx(g, M.gunmetal, [0, 0.03, -0.08], [0.04, 0.05, 0.36]);
      tube(g, M.darkSteel, [0, 0.015, -0.5], 0.012, 0.34);
      tube(g, M.gunmetal, [0, 0.015, -0.69], 0.018, 0.05);
      // levier de culasse
      const bolt = new THREE.Group();
      bx(bolt, M.gunmetal, [0.034, 0.035, 0.08], [0.016, 0.016, 0.1]);
      add(bolt, G.sphere, M.darkSteel, [0.052, 0.025, 0.12], [0.03, 0.03, 0.03]);
      g.add(bolt); moving.push(bolt);
      magPart = curvedMag(g, 0, -0.045, -0.02, 2, 0.034, 0.1, 0.055, M.darkSteel);
      bx(g, M.grip, [0, -0.105, 0.14], [0.044, 0.14, 0.062], [0.22, 0, 0]);
      bx(g, M.polymer, [0, -0.005, 0.32], [0.046, 0.095, 0.22], [0.04, 0, 0]);
      bx(g, M.polymerLight, [0, 0.055, 0.34], [0.04, 0.035, 0.1]);  // appui-joue
      scope(g, -0.04, 0.105, 0.34, 0.03);
      offsetSight(g, -0.3, 0.05);
      triggerGroup(g, 0.08);
      port.position.set(0.034, 0.035, 0.07);
      muzzleZ = -0.73; muzzleY = 0.015; sightY = 0.105;
      break;
    }
    case 'sniper_heavy': {
      bx(g, M.gunmetal, [0, 0.0, 0.02], [0.056, 0.095, 0.58]);
      bx(g, M.darkSteel, [0, 0.045, -0.06], [0.046, 0.05, 0.42]);
      tube(g, M.darkSteel, [0, 0.015, -0.6], 0.016, 0.42);
      for (let i = 0; i < 5; i++) tube(g, M.gunmetal, [0, 0.015, -0.48 - i * 0.055], 0.021, 0.014);
      // frein de bouche
      tube(g, M.gunmetal, [0, 0.015, -0.86], 0.03, 0.1);
      bx(g, M.darkSteel, [0, 0.055, -0.86], [0.012, 0.03, 0.08]);
      bx(g, M.darkSteel, [0.042, 0.015, -0.86], [0.02, 0.012, 0.08]);
      bx(g, M.darkSteel, [-0.042, 0.015, -0.86], [0.02, 0.012, 0.08]);
      const bolt = new THREE.Group();
      bx(bolt, M.gunmetal, [0.038, 0.05, 0.1], [0.018, 0.018, 0.12]);
      add(bolt, G.sphere, M.accentRed, [0.062, 0.038, 0.15], [0.034, 0.034, 0.034]);
      g.add(bolt); moving.push(bolt);
      magPart = curvedMag(g, 0, -0.05, 0.0, 2, 0.042, 0.12, 0.06, M.polymer);
      bx(g, M.grip, [0, -0.12, 0.16], [0.048, 0.15, 0.065], [0.2, 0, 0]);
      bx(g, M.polymer, [0, -0.01, 0.36], [0.052, 0.1, 0.24], [0.03, 0, 0]);
      bx(g, M.polymerLight, [0, 0.06, 0.38], [0.044, 0.04, 0.12]);
      bx(g, M.accentRed, [0, 0.078, 0.1], [0.03, 0.012, 0.2]);
      scope(g, -0.05, 0.125, 0.42, 0.036);
      offsetSight(g, -0.34, 0.06);
      laserModule(g, -0.34, -0.052);
      triggerGroup(g, 0.09);
      // bipied
      bx(g, M.darkSteel, [0.024, -0.1, -0.5], [0.014, 0.13, 0.014], [0.35, 0, 0.26]);
      bx(g, M.darkSteel, [-0.024, -0.1, -0.5], [0.014, 0.13, 0.014], [0.35, 0, -0.26]);
      port.position.set(0.04, 0.045, 0.08);
      muzzleZ = -0.93; muzzleY = 0.015; sightY = 0.125;
      break;
    }
  }

  // ancrages des mains (poignée de tir / main avant) par modèle
  const ANCHORS: Record<ModelKey, { grip: Vec; fore: Vec }> = {
    pistol_basic: { grip: [0, -0.085, 0.045], fore: [0, -0.075, 0.075] },
    pistol_auto: { grip: [0, -0.095, 0.04], fore: [0, -0.085, 0.07] },
    pistol_sup: { grip: [0, -0.088, 0.042], fore: [0, -0.078, 0.072] },
    revolver: { grip: [0, -0.09, 0.075], fore: [0, -0.08, 0.105] },
    shotgun: { grip: [0, -0.1, 0.1], fore: [0, -0.04, -0.26] },
    smg: { grip: [0, -0.105, 0.075], fore: [0, -0.025, -0.27] },
    rifle_semi: { grip: [0, -0.105, 0.13], fore: [0, -0.02, -0.3] },
    rifle_auto: { grip: [0, -0.115, 0.1], fore: [0, -0.025, -0.34] },
    rifle_sup: { grip: [0, -0.112, 0.1], fore: [0, -0.022, -0.33] },
    lmg: { grip: [0, -0.13, 0.14], fore: [0, -0.115, -0.27] },
    sniper_light: { grip: [0, -0.105, 0.14], fore: [0, -0.045, -0.2] },
    sniper_heavy: { grip: [0, -0.12, 0.16], fore: [0, -0.08, -0.16] },
  };
  grip = ANCHORS[key].grip;
  fore = ANCHORS[key].fore;

  // Détails de fabrication propres à chaque famille : rails, nervures,
  // garde-main texturé et renforts qui donnent une silhouette moins générique.
  const longGun = !['pistol_basic', 'pistol_auto', 'pistol_sup', 'revolver'].includes(key);
  if (longGun) {
    rail(g, -0.48, 0.12, 0.075, M.darkSteel);
    for (const side of [-1, 1]) {
      bx(g, M.polymerLight, [side * 0.027, -0.005, -0.24], [0.012, 0.045, 0.22]);
      for (let i = 0; i < 5; i++) {
        bx(g, M.darkSteel, [side * 0.034, -0.005, -0.31 + i * 0.035], [0.006, 0.012, 0.018]);
      }
    }
    bx(g, M.accentRed, [0, -0.047, 0.12], [0.025, 0.008, 0.11]);
  } else {
    bx(g, M.darkSteel, [0, 0.067, 0.005], [0.026, 0.009, 0.12]);
    for (let i = 0; i < 3; i++) bx(g, M.darkSteel, [0.026, 0.035, -0.02 - i * 0.035], [0.004, 0.008, 0.018]);
  }

  g.add(port);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; (o as THREE.Mesh).renderOrder = 2; } });
  return { group: g, muzzleZ, muzzleY, sightY, grip, fore, ejectPort: port, movingParts: moving, mag: magPart, reloadKind };
}

/** Mains gantées tenant l'arme (vue subjective).
 *  Volontairement compactes : la paume épouse la poignée, les doigts se
 *  referment dessus et le poignet est coupé net juste derrière.
 *  Aucun avant-bras long : à hauteur d'œil, les bras sortent du cadre. */
export function buildHands(grip: Vec, fore: Vec, twoHanded: boolean): THREE.Group {
  const g = new THREE.Group();

  /**
   * @param side   +1 main droite, -1 main gauche
   * @param anchor point de préhension sur l'arme (espace arme)
   * @param axis   'vertical' = poignée pistolet, 'horizontal' = garde-main
   */
  const makeHand = (side: 1 | -1, anchor: Vec, axis: 'vertical' | 'horizontal', tilt: number) => {
    const h = new THREE.Group();
    const [ax, ay, az] = anchor;
    h.position.set(ax + side * 0.008, ay + 0.012, az);
    h.rotation.set(axis === 'vertical' ? 0.22 : 0.05, side * 0.08, tilt);
    h.scale.setScalar(1.0);      // mains lisibles sans masquer l'arme

    // paume collée à la poignée
    add(h, G.box, M.glove, [0, 0.006, 0], [0.046, 0.062, 0.05]);
    add(h, G.box, M.polymer, [side * 0.004, 0.03, 0.002], [0.05, 0.016, 0.052]);  // dos du gant

    // 4 doigts refermés : phalange horizontale + bout rabattu
    for (let i = 0; i < 4; i++) {
      const fy = 0.018 - i * 0.015;
      const curl = 1.15 - i * 0.06;
      add(h, G.box, M.glove, [side * 0.023, fy, -0.02], [0.021, 0.0105, 0.05], [0.1, 0, 0]);
      add(h, G.box, M.glove, [side * 0.023, fy - 0.011, -0.04], [0.019, 0.023, 0.012], [0, 0, 0]);
      void curl;
    }
    // pouce rabattu de l'autre côté
    add(h, G.box, M.glove, [-side * 0.021, 0.01, -0.018], [0.018, 0.032, 0.02], [0.42, 0, side * 0.5]);

    // Manchette renforcée et avant-bras textile : la manche remonte depuis
    // le bas du cadre, au lieu de laisser apparaître uniquement des mains flottantes.
    add(h, G.cyl, M.darkSteel, [0, -0.004, 0.028], [0.052, 0.052, 0.034], [1.05, 0, 0]);
    add(h, G.box, M.accentRed, [0, 0.02, 0.028], [0.044, 0.007, 0.034]);
    const sleeve = add(h, G.capsule, M.sleeve, [0, -0.155, 0.105], [0.092, 0.34, 0.092], [1.12, 0, 0]);
    sleeve.renderOrder = 0;
    add(h, G.box, M.polymer, [side * 0.028, -0.13, 0.075], [0.012, 0.15, 0.014], [0.08, 0, 0]);
    add(h, G.box, M.glove, [0, -0.045, 0.052], [0.054, 0.018, 0.012]);
    return h;
  };

  g.add(makeHand(1, grip, 'vertical', 0));                      // main de tir
  if (twoHanded) {
    g.add(makeHand(-1, fore, 'horizontal', -0.18));             // main avant sur le garde-main
  } else {
    // pistolet : la main de soutien enveloppe la main de tir
    const sup = makeHand(-1, [grip[0] - 0.038, grip[1] - 0.032, grip[2] + 0.022], 'vertical', 0.24);
    sup.scale.multiplyScalar(0.86);
    g.add(sup);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).renderOrder = 1; (o as THREE.Mesh).castShadow = false; } });
  return g;
}

// ═════════════════════════════════════════════════════════════
//  AGENTS — modèle humanoïde détaillé
// ═════════════════════════════════════════════════════════════
export interface AgentBuild {
  group: THREE.Group;
  hitHead: THREE.Mesh;
  hitBody: THREE.Mesh;
  hitLegL: THREE.Mesh;
  hitLegR: THREE.Mesh;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  torso: THREE.Object3D;
  headPivot: THREE.Object3D;
  muzzle: THREE.Object3D;
  visor: THREE.Mesh;
}

export function buildAgent(accent: string, friendly = false): AgentBuild {
  const root = new THREE.Group();
  const col = new THREE.Color(accent);

  // ─── matériaux ───
  const suit = new THREE.MeshStandardMaterial({ color: friendly ? 0x2c3440 : 0x262a32, roughness: 0.84, metalness: 0.1 });
  const armor = new THREE.MeshStandardMaterial({ color: friendly ? 0x1d242e : 0x191c22, roughness: 0.5, metalness: 0.45 });
  const plate = new THREE.MeshStandardMaterial({ color: friendly ? 0x37434f : 0x2e3139, roughness: 0.42, metalness: 0.55 });
  const cloth = new THREE.MeshStandardMaterial({ color: friendly ? 0x3c4654 : 0x33383f, roughness: 0.96 });
  const trim = new THREE.MeshStandardMaterial({
    color: col, roughness: 0.42, metalness: 0.35,
    emissive: col.clone().multiplyScalar(0.3), emissiveIntensity: 1.2,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x06080b, roughness: 0.08, metalness: 0.7,
    emissive: friendly ? col.clone() : new THREE.Color(0xff2a3a), emissiveIntensity: friendly ? 3 : 2.6,
  });
  const boot = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.93 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a626c, roughness: 0.35, metalness: 0.85 });

  // ═══ TORSE ═══
  const torso = new THREE.Group();
  torso.position.y = 1.0;
  root.add(torso);

  // hitbox buste
  const hitBody = new THREE.Mesh(G.capsule, suit);
  hitBody.scale.set(0.5, 0.4, 0.4);
  hitBody.position.y = 0.06;
  hitBody.castShadow = true;
  torso.add(hitBody);

  // cage thoracique + abdomen segmenté (silhouette athlétique)
  const chest = new THREE.Mesh(G.capsule, suit);
  chest.scale.set(0.54, 0.3, 0.42);
  chest.position.set(0, 0.2, -0.01);
  chest.castShadow = true;
  torso.add(chest);
  const abs = new THREE.Mesh(G.box, suit);
  abs.scale.set(0.42, 0.26, 0.3);
  abs.position.y = -0.1;
  torso.add(abs);

  // plastron balistique : plaque centrale + plaques latérales biseautées
  const bib = new THREE.Mesh(G.box, armor);
  bib.scale.set(0.46, 0.4, 0.33);
  bib.position.set(0, 0.17, -0.02);
  bib.castShadow = true;
  torso.add(bib);
  bx(torso, plate, [0, 0.27, -0.17], [0.34, 0.2, 0.05]);          // plaque haute
  bx(torso, plate, [0, 0.04, -0.17], [0.38, 0.19, 0.05]);         // plaque basse
  bx(torso, trim, [0, 0.16, -0.185], [0.08, 0.3, 0.025]);         // bande d'équipe verticale
  for (const sx of [-1, 1]) {
    bx(torso, plate, [sx * 0.23, 0.14, -0.1], [0.07, 0.3, 0.2], [0, sx * 0.3, 0]);
    bx(torso, trim, [sx * 0.255, 0.26, -0.11], [0.035, 0.05, 0.11], [0, sx * 0.3, 0]);
  }
  // sangles en X dans le dos
  for (const sx of [-1, 1]) {
    bx(torso, cloth, [sx * 0.1, 0.16, 0.13], [0.06, 0.4, 0.05], [0, 0, sx * 0.22]);
  }
  // ceinturon + cuissards
  bx(torso, cloth, [0, -0.25, 0], [0.47, 0.1, 0.35]);
  bx(torso, metal, [0, -0.25, -0.18], [0.09, 0.08, 0.04]);        // boucle
  for (const sx of [-1, 1]) {
    bx(torso, armor, [sx * 0.19, -0.27, -0.1], [0.1, 0.13, 0.09]);  // poche
    bx(torso, trim, [sx * 0.19, -0.21, -0.1], [0.1, 0.02, 0.09]);
  }
  // chargeurs sur le torse
  for (let i = 0; i < 3; i++) {
    bx(torso, armor, [-0.1 + i * 0.1, -0.03, -0.2], [0.075, 0.15, 0.05]);
  }
  // sac à dos compact + bonbonne
  bx(torso, armor, [0, 0.1, 0.19], [0.34, 0.4, 0.15]);
  bx(torso, cloth, [0, 0.21, 0.27], [0.24, 0.15, 0.06]);
  add(torso, G.cyl, metal, [0.1, 0.06, 0.25], [0.1, 0.26, 0.1]);
  add(torso, G.sphere, trim, [-0.1, -0.02, 0.26], [0.09, 0.09, 0.09]);

  // épaulières arrondies articulées
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(G.sphere, armor);
    pad.scale.set(0.18, 0.15, 0.18);
    pad.position.set(sx * 0.27, 0.25, 0);
    pad.castShadow = true;
    torso.add(pad);
    bx(torso, plate, [sx * 0.3, 0.2, 0], [0.05, 0.14, 0.17]);
    bx(torso, trim, [sx * 0.31, 0.27, 0], [0.035, 0.07, 0.13]);
  }

  // ═══ TÊTE ═══
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.44;
  torso.add(headPivot);
  add(headPivot, G.cylLow, cloth, [0, -0.05, 0], [0.17, 0.12, 0.17]);   // cou
  bx(headPivot, armor, [0, -0.03, -0.06], [0.22, 0.1, 0.14]);           // col montant

  const hitHead = new THREE.Mesh(G.sphere, suit);
  hitHead.scale.set(0.38, 0.42, 0.4);
  hitHead.position.y = 0.11;
  hitHead.castShadow = true;
  headPivot.add(hitHead);

  // casque : calotte + visière relevée + protections d'oreilles + rail
  const helm = new THREE.Mesh(G.sphere, armor);
  helm.scale.set(0.44, 0.42, 0.46);
  helm.position.y = 0.15;
  helm.castShadow = true;
  headPivot.add(helm);
  bx(headPivot, plate, [0, 0.28, 0.0], [0.34, 0.12, 0.42]);             // dessus renforcé
  bx(headPivot, trim, [0, 0.33, 0.02], [0.05, 0.05, 0.36]);             // crête lumineuse
  for (const sx of [-1, 1]) {
    bx(headPivot, armor, [sx * 0.2, 0.1, 0.0], [0.07, 0.19, 0.22]);     // oreillette
    add(headPivot, G.cyl, metal, [sx * 0.23, 0.1, 0.0], [0.07, 0.06, 0.07], [0, 0, Math.PI / 2]);
    bx(headPivot, plate, [sx * 0.17, 0.24, -0.08], [0.06, 0.1, 0.16], [0, 0, -sx * 0.25]);
  }
  // visière panoramique
  const visor = new THREE.Mesh(G.box, visorMat);
  visor.scale.set(0.34, 0.11, 0.1);
  visor.position.set(0, 0.11, -0.19);
  headPivot.add(visor);
  bx(headPivot, plate, [0, 0.19, -0.2], [0.36, 0.07, 0.1]);             // casquette de visière
  // masque respiratoire avec filtres
  bx(headPivot, armor, [0, -0.01, -0.17], [0.27, 0.15, 0.14]);
  for (const sx of [-1, 1]) add(headPivot, G.cyl, metal, [sx * 0.1, -0.03, -0.21], [0.08, 0.07, 0.08], [Math.PI / 2, 0, 0]);
  bx(headPivot, rubber, [0, -0.08, -0.14], [0.2, 0.05, 0.12]);
  // micro-tige
  bx(headPivot, metal, [0.14, 0.02, -0.14], [0.11, 0.015, 0.015], [0, 0.5, 0]);
  // antenne souple
  post(headPivot, metal, [0.15, 0.33, 0.12], 0.011, 0.24);
  add(headPivot, G.sphere, trim, [0.15, 0.45, 0.12], [0.03, 0.03, 0.03]);

  // ═══ BRAS ═══
  const mkArm = (side: 1 | -1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 0.21, 0);
    torso.add(shoulder);
    const upper = new THREE.Mesh(G.capsule, suit);
    upper.scale.set(0.145, 0.16, 0.145);
    upper.position.y = -0.14;
    upper.castShadow = true;
    shoulder.add(upper);
    bx(shoulder, armor, [0, -0.1, -0.03], [0.16, 0.14, 0.15]);    // brassard
    bx(shoulder, trim, [side * 0.08, -0.12, 0], [0.02, 0.09, 0.1]);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(G.capsule, suit);
    fore.scale.set(0.125, 0.145, 0.125);
    fore.position.y = -0.13;
    fore.castShadow = true;
    elbow.add(fore);
    bx(elbow, armor, [0, -0.05, -0.02], [0.155, 0.11, 0.155]);    // coudière
    bx(elbow, plate, [0, -0.17, -0.03], [0.14, 0.14, 0.12]);      // avant-bras renforcé
    // gant détaillé
    const hand = new THREE.Group();
    hand.position.y = -0.27;
    elbow.add(hand);
    add(hand, G.box, boot, [0, 0, -0.01], [0.12, 0.12, 0.14]);
    for (let i = 0; i < 3; i++) add(hand, G.box, boot, [side * 0.035, 0.02 - i * 0.03, -0.09], [0.05, 0.026, 0.07], [0.5, 0, 0]);
    return { shoulder, elbow };
  };
  const aR = mkArm(1);
  const aL = mkArm(-1);
  aR.shoulder.rotation.set(-1.18, 0, -0.14);
  aR.elbow.rotation.set(0.8, 0, 0);
  aL.shoulder.rotation.set(-1.34, 0, 0.52);
  aL.elbow.rotation.set(0.9, 0, 0);

  // ═══ ARME PORTÉE ═══
  const gun = new THREE.Group();
  gun.position.set(0.17, 0.02, -0.4);
  gun.rotation.set(0, 0.06, 0);
  torso.add(gun);
  bx(gun, armor, [0, 0, 0], [0.07, 0.1, 0.5]);
  bx(gun, plate, [0, 0.055, -0.02], [0.05, 0.035, 0.46]);
  add(gun, G.cyl, metal, [0, -0.005, -0.33], [0.032, 0.24, 0.032], [Math.PI / 2, 0, 0]);
  add(gun, G.cyl, armor, [0, -0.005, -0.47], [0.05, 0.08, 0.05], [Math.PI / 2, 0, 0]);  // cache-flamme
  bx(gun, armor, [0, -0.12, 0.02], [0.05, 0.16, 0.07], [0.2, 0, 0]);                    // poignée
  bx(gun, armor, [0, -0.11, -0.12], [0.05, 0.14, 0.06]);                                // chargeur
  bx(gun, trim, [0, 0.075, 0.02], [0.028, 0.012, 0.14]);                                // rail lumineux
  bx(gun, armor, [0, -0.05, 0.19], [0.05, 0.1, 0.16]);                                  // crosse
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -0.52);
  gun.add(muzzle);

  // ═══ JAMBES ═══
  const mkLeg = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.125, 0.76, 0);
    root.add(hip);
    const thigh = new THREE.Mesh(G.capsule, suit);
    thigh.scale.set(0.175, 0.19, 0.175);
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    hip.add(thigh);
    bx(hip, armor, [0, -0.15, -0.05], [0.19, 0.2, 0.13]);          // cuissard
    bx(hip, trim, [side * 0.09, -0.16, -0.02], [0.02, 0.12, 0.1]);

    const knee = new THREE.Group();
    knee.position.y = -0.35;
    hip.add(knee);
    const shin = new THREE.Mesh(G.capsule, suit);
    shin.scale.set(0.145, 0.175, 0.145);
    shin.position.y = -0.16;
    shin.castShadow = true;
    knee.add(shin);
    const kneePad = new THREE.Mesh(G.sphere, armor);
    kneePad.scale.set(0.11, 0.1, 0.1);
    kneePad.position.set(0, -0.01, -0.07);
    knee.add(kneePad);
    bx(knee, plate, [0, -0.17, -0.06], [0.15, 0.2, 0.1]);          // tibiale
    bx(knee, trim, [0, -0.1, -0.11], [0.08, 0.04, 0.02]);
    // botte : semelle + tige
    const bt = new THREE.Mesh(G.box, boot);
    bt.scale.set(0.18, 0.13, 0.28);
    bt.position.set(0, -0.35, -0.04);
    bt.castShadow = true;
    knee.add(bt);
    add(knee, G.box, rubber, [0, -0.42, -0.05], [0.19, 0.045, 0.3]);
    add(knee, G.box, boot, [0, -0.27, 0.02], [0.17, 0.13, 0.17]);
    return { hip, knee };
  };
  const lR = mkLeg(1);
  const lL = mkLeg(-1);

  // hitboxes jambes (invisibles, le visuel est porté par les membres)
  const mkLegHit = (side: 1 | -1) => {
    const m = new THREE.Mesh(G.box, suit);
    m.scale.set(0.22, 0.74, 0.24);
    m.position.set(side * 0.125, 0.39, 0);
    m.visible = false;
    root.add(m);
    return m;
  };
  const hitLegR = mkLegHit(1);
  const hitLegL = mkLegHit(-1);

  return {
    group: root,
    hitHead, hitBody, hitLegL, hitLegR,
    legL: lL.hip, legR: lR.hip,
    armL: aL.shoulder, armR: aR.shoulder,
    torso, headPivot, muzzle, visor,
  };
}
