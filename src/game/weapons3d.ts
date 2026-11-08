import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { type Skin, type Weapon } from './data';

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0, round = false) {
  const geometry = round ? new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.15) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function tube(radius: number, length: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildViewWeapon(weapon: Weapon, skin: Skin) {
  const group = new THREE.Group();
  group.name = `view-${weapon.id}`;
  const metal = new THREE.MeshStandardMaterial({ color: skin.body, roughness: 0.55, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x303d39, roughness: 0.75, metalness: 0.3 });
  const detail = new THREE.MeshStandardMaterial({ color: skin.detail, roughness: 0.8 });
  const accent = new THREE.MeshStandardMaterial({ color: skin.accent, roughness: 0.65, metalness: 0.25 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x46524b, roughness: 0.95 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x374c49, roughness: 0.95 });
  const pistol = weapon.kind === 'pistol' || weapon.kind === 'heavy-pistol';
  let muzzleZ = -1.12;
  let frontHandZ = -0.54;
  let magazineHome = new THREE.Vector3(0, -0.18, -0.12);
  let boltHomeZ = -0.16;
  let viewZ = -0.7;

  if (pistol) {
    const heavy = weapon.kind === 'heavy-pistol';
    group.add(box(heavy ? 0.19 : 0.16, heavy ? 0.15 : 0.13, heavy ? 0.48 : 0.38, metal, 0, 0.035, -0.14, true));
    group.add(box(0.16, 0.045, heavy ? 0.42 : 0.33, detail, 0, -0.04, -0.13, true));
    group.add(box(0.12, 0.24, 0.13, dark, 0, -0.15, 0.02, true));
    group.add(box(0.11, 0.055, 0.08, dark, 0, 0.12, 0.01, true));
    group.add(box(0.08, 0.045, 0.055, dark, 0, 0.12, heavy ? -0.35 : -0.28, true));
    group.add(box(0.17, 0.025, 0.09, accent, 0, 0.075, -0.17));
    if (heavy) group.add(box(0.21, 0.17, 0.1, detail, 0, 0.035, -0.42, true));
    group.add(tube(0.027, 0.18, dark, 0, 0.035, heavy ? -0.45 : -0.37));
    muzzleZ = heavy ? -0.56 : -0.48;
    frontHandZ = -0.19;
    magazineHome = new THREE.Vector3(0, -0.23, 0.035);
    boltHomeZ = -0.06;
    viewZ = -0.62;
  } else {
    const smg = weapon.kind === 'smg';
    const shotgun = weapon.kind === 'shotgun';
    const marksman = weapon.kind === 'marksman';
    const receiverLength = smg ? 0.4 : marksman ? 0.65 : shotgun ? 0.5 : 0.58;
    group.add(box(smg ? 0.16 : 0.18, 0.16, receiverLength, metal, 0, 0, -0.1, true));
    group.add(box(0.185, 0.025, 0.11, accent, 0, 0.02, -0.26));
    group.add(box(0.185, 0.025, 0.07, accent, 0, 0.02, -0.04));
    const handguardLength = smg ? 0.26 : marksman ? 0.55 : shotgun ? 0.48 : 0.4;
    group.add(box(0.15, shotgun ? 0.12 : 0.085, handguardLength, detail, 0, -0.03, -0.47, true));
    const barrelLength = smg ? 0.24 : marksman ? 0.68 : shotgun ? 0.58 : 0.36;
    const barrelZ = smg ? -0.67 : marksman ? -1.01 : shotgun ? -0.98 : -0.88;
    group.add(tube(shotgun ? 0.04 : 0.028, barrelLength, dark, 0, 0.01, barrelZ));
    muzzleZ = barrelZ - barrelLength / 2 - 0.03;
    group.add(box(0.12, 0.065, 0.22, dark, 0, 0.11, -0.14, true));
    if (marksman) {
      group.add(tube(0.07, 0.32, dark, 0, 0.2, -0.16));
      group.add(tube(0.052, 0.05, accent, 0, 0.2, -0.34));
      group.add(box(0.1, 0.06, 0.13, detail, 0, 0.13, -0.15));
    } else {
      group.add(box(0.075, 0.09, 0.12, dark, 0, 0.17, -0.16, true));
    }
    if (shotgun) {
      group.add(tube(0.035, 0.54, dark, 0, -0.09, -0.82));
      for (let z = -0.62; z <= -0.33; z += 0.08) group.add(box(0.16, 0.13, 0.025, dark, 0, -0.03, z));
    }
    if (smg) {
      group.add(box(0.095, 0.18, 0.09, dark, 0, -0.16, -0.39, true));
      group.add(box(0.05, 0.09, 0.31, dark, 0, 0, 0.28));
    } else {
      group.add(box(marksman ? 0.17 : 0.15, 0.12, marksman ? 0.42 : 0.31, detail, 0, -0.02, marksman ? 0.36 : 0.3, true));
    }
    if (marksman) {
      const legA = box(0.025, 0.28, 0.025, dark, -0.08, -0.14, -0.66);
      const legB = box(0.025, 0.28, 0.025, dark, 0.08, -0.14, -0.66);
      legA.rotation.z = -0.3; legB.rotation.z = 0.3;
      group.add(legA, legB);
    }
    group.add(box(0.11, 0.2, 0.1, dark, 0, -0.16, 0.11, true));
    frontHandZ = smg ? -0.38 : -0.54;
    magazineHome = new THREE.Vector3(0, -0.18, smg ? -0.03 : -0.12);
  }

  const magazine = new THREE.Group();
  magazine.position.copy(magazineHome);
  const magHeight = pistol ? 0.17 : weapon.kind === 'smg' ? 0.3 : weapon.kind === 'shotgun' ? 0.2 : 0.24;
  magazine.add(box(pistol ? 0.09 : 0.12, magHeight, pistol ? 0.11 : 0.16, dark, 0, 0, 0, true));
  magazine.add(box(pistol ? 0.1 : 0.13, 0.03, pistol ? 0.12 : 0.17, detail, 0, -magHeight / 2, 0));
  if (!pistol) for (let y = -0.07; y <= 0.07; y += 0.07) magazine.add(box(0.125, 0.012, 0.17, metal, 0, y, 0));
  group.add(magazine);

  group.add(box(0.15, 0.18, 0.16, glove, 0.08, -0.17, 0.08, true));
  group.add(box(0.155, 0.055, 0.14, dark, 0.09, -0.19, 0.02));
  const offhand = new THREE.Group();
  offhand.add(box(0.16, 0.16, 0.18, glove, -0.1, -0.12, frontHandZ, true));
  offhand.add(box(0.17, 0.055, 0.1, dark, -0.1, -0.11, frontHandZ - 0.08));
  const rightSleeve = box(0.2, 0.19, 0.45, sleeve, 0.16, -0.26, 0.35, true);
  rightSleeve.rotation.z = -0.18;
  group.add(rightSleeve);
  const leftSleeve = box(0.19, 0.18, 0.47, sleeve, -0.2, -0.24, frontHandZ + 0.32, true);
  leftSleeve.rotation.z = 0.34;
  offhand.add(leftSleeve);
  group.add(offhand);
  const bolt = new THREE.Group();
  bolt.position.set(0.1, 0.08, boltHomeZ);
  bolt.add(box(0.045, 0.045, 0.12, dark));
  group.add(bolt);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdf9d, transparent: true, opacity: 0.9 }));
  flash.position.set(0, 0.02, muzzleZ);
  flash.visible = false;
  group.add(flash);
  group.position.set(0.31, -0.29, viewZ);
  return { group, flash, magazine, offhand, bolt, magazineHome, boltHomeZ, handTravel: pistol ? 0.16 : 0.34, viewZ, pistol };
}