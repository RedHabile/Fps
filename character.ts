import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type Skin, type WeaponId } from './data';

export interface OperatorRig {
  group: THREE.Group;
  upperBody: THREE.Group;
  head: THREE.Group;
  hitbox: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  rifle: THREE.Group;
  weaponParts: THREE.Group;
  fireFlash: THREE.Mesh;
}

function rounded(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const radius = Math.min(w, h, d) * 0.17;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, radius), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function capsule(radius: number, length: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function sphere(radius: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function fabricTexture(team: 'blue' | 'red') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ededed';
  ctx.fillRect(0, 0, 128, 128);
  let seed = team === 'blue' ? 391 : 647;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = `rgba(45,45,45,${0.04 + random() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(random() * 128, random() * 128, 3 + random() * 12, 2 + random() * 7, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 550; i++) {
    ctx.fillStyle = `rgba(35,35,35,${random() * 0.12})`;
    ctx.fillRect(random() * 128, random() * 128, 1, 1 + random() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Bake static equipment by material while keeping the joints independently animated.
function mergeEquipment(group: THREE.Group) {
  for (const child of [...group.children]) if (child instanceof THREE.Group) mergeEquipment(child);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.userData.keepSeparate || Array.isArray(child.material)) continue;
    const batch = batches.get(child.material) ?? [];
    batch.push(child);
    batches.set(child.material, batch);
  }
  batches.forEach((meshes, material) => {
    if (meshes.length < 2) return;
    const geometries = meshes.map((mesh) => {
      const source = mesh.geometry.clone();
      const geometry = source.index ? source.toNonIndexed() : source;
      if (geometry !== source) source.dispose();
      for (const name of Object.keys(geometry.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name);
      }
      if (!geometry.getAttribute('uv')) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
      mesh.updateMatrix();
      geometry.applyMatrix4(mesh.matrix);
      return geometry;
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) return;
    meshes.forEach((mesh) => { group.remove(mesh); mesh.geometry.dispose(); });
    group.add(new THREE.Mesh(merged, material));
  });
}

export function setOperatorWeapon(rig: OperatorRig, id: WeaponId, skin?: Skin) {
  rig.weaponParts.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
  rig.weaponParts.clear();
  const body = new THREE.MeshStandardMaterial({ color: skin?.body ?? '#566a62', roughness: 0.65, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2928, roughness: 0.72, metalness: 0.22 });
  const accent = new THREE.MeshStandardMaterial({ color: skin?.detail ?? '#83988a', roughness: 0.75 });
  const parts = rig.weaponParts;
  const pistol = id === 'p12' || id === 'r45';
  const smg = id === 'spectre';
  const shotgun = id === 'bulldog';
  const marksman = id === 'phantom';
  if (pistol) {
    parts.add(rounded(id === 'r45' ? 0.15 : 0.12, 0.11, id === 'r45' ? 0.34 : 0.27, body, 0, 0, -0.02));
    parts.add(rounded(0.09, 0.16, 0.1, dark, 0, -0.11, 0.05));
    parts.add(rounded(0.11, 0.025, 0.14, accent, 0, 0.06, -0.05));
    rig.fireFlash.position.z = id === 'r45' ? -0.25 : -0.21;
  } else {
    const length = smg ? 0.3 : marksman ? 0.5 : 0.42;
    parts.add(rounded(0.13, 0.14, length, body, 0, 0, 0));
    parts.add(rounded(0.13, 0.08, smg ? 0.2 : 0.3, accent, 0, -0.01, -0.29));
    parts.add(rounded(0.11, 0.1, marksman ? 0.3 : 0.22, dark, 0, -0.015, 0.27));
    parts.add(rounded(0.09, smg ? 0.25 : 0.2, 0.12, dark, 0, -0.14, 0.02));
    parts.add(rounded(0.1, 0.07, marksman ? 0.22 : 0.15, accent, 0, 0.09, -0.08));
    const barrelLength = smg ? 0.22 : marksman ? 0.52 : shotgun ? 0.46 : 0.34;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(shotgun ? 0.035 : 0.026, shotgun ? 0.035 : 0.026, barrelLength, 8), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.46 - barrelLength / 2);
    parts.add(barrel);
    if (shotgun) parts.add(rounded(0.15, 0.09, 0.24, dark, 0, -0.08, -0.42));
    if (marksman) parts.add(rounded(0.1, 0.08, 0.27, dark, 0, 0.16, -0.08));
    rig.fireFlash.position.z = -0.49 - barrelLength;
  }
  parts.name = `operator-${id}`;
  mergeEquipment(parts);
}

export function buildOperator(id: string, team: 'blue' | 'red'): OperatorRig {
  const group = new THREE.Group();
  const upperBody = new THREE.Group();
  group.add(upperBody);
  const camo = fabricTexture(team);
  const uniform = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x58706c : 0x827268, map: camo, roughness: 0.94 });
  const fabric = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x405957 : 0x67584e, map: camo, roughness: 0.94 });
  const armor = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x304945 : 0x50463e, roughness: 0.78, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x7a9185 : 0x9a8570, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b2928, roughness: 0.72, metalness: 0.22 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb08d75, roughness: 1 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x6d9d9a, roughness: 0.2, metalness: 0.55 });
  const stripe = new THREE.MeshStandardMaterial({ color: team === 'blue' ? 0x72e9d1 : 0xf1a078, emissive: team === 'blue' ? 0x174d42 : 0x542713, emissiveIntensity: 0.5 });

  upperBody.add(rounded(0.48, 0.56, 0.29, uniform, 0, 1.2, 0));
  upperBody.add(rounded(0.51, 0.45, 0.35, armor, 0, 1.22, -0.01));
  upperBody.add(rounded(0.4, 0.28, 0.07, fabric, 0, 1.27, -0.205));
  for (const x of [-0.145, 0, 0.145]) {
    upperBody.add(rounded(0.12, 0.15, 0.075, trim, x, 1.11, -0.25));
    upperBody.add(rounded(0.105, 0.025, 0.025, dark, x, 1.14, -0.295));
  }
  for (const x of [-0.18, 0.18]) {
    upperBody.add(rounded(0.065, 0.39, 0.055, dark, x, 1.29, -0.205));
    upperBody.add(rounded(0.065, 0.045, 0.06, trim, x, 1.35, -0.24));
  }
  upperBody.add(rounded(0.22, 0.055, 0.025, stripe, 0, 1.38, -0.25));
  upperBody.add(rounded(0.45, 0.12, 0.34, dark, 0, 0.91, 0));
  upperBody.add(rounded(0.13, 0.16, 0.18, armor, -0.28, 0.9, 0));
  upperBody.add(rounded(0.13, 0.19, 0.18, armor, 0.28, 0.89, 0));
  upperBody.add(rounded(0.36, 0.43, 0.19, fabric, 0, 1.22, 0.23));
  upperBody.add(rounded(0.27, 0.23, 0.07, armor, 0, 1.2, 0.35));
  upperBody.add(rounded(0.23, 0.035, 0.04, trim, 0, 1.3, 0.395));
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.39, 6), dark);
  antenna.position.set(0.16, 1.58, 0.28);
  antenna.rotation.z = -0.12;
  upperBody.add(antenna);

  const head = new THREE.Group();
  head.position.y = 1.53;
  upperBody.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.16, 10), fabric);
  neck.position.y = 0.02;
  head.add(neck);
  const face = sphere(0.17, skin, 0, 0.17, 0);
  face.scale.set(0.92, 1.08, 0.92);
  head.add(face);
  head.add(rounded(0.29, 0.15, 0.14, fabric, 0, 0.09, -0.135));
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.195, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), armor);
  helmet.position.y = 0.22;
  helmet.scale.set(1.05, 0.94, 1.05);
  head.add(helmet);
  head.add(rounded(0.31, 0.075, 0.11, dark, 0, 0.205, -0.17));
  head.add(rounded(0.115, 0.055, 0.025, lens, -0.072, 0.21, -0.232));
  head.add(rounded(0.115, 0.055, 0.025, lens, 0.072, 0.21, -0.232));
  head.add(rounded(0.12, 0.06, 0.045, trim, 0, 0.32, -0.155));
  head.add(rounded(0.06, 0.13, 0.15, dark, -0.19, 0.16, 0));
  head.add(rounded(0.06, 0.13, 0.15, dark, 0.19, 0.16, 0));
  head.add(rounded(0.025, 0.025, 0.14, dark, 0.15, 0.09, -0.15));

  const leg = (side: number) => {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.145, 0.86, 0);
    thigh.add(capsule(0.105, 0.24, uniform, 0, -0.17, 0));
    thigh.add(rounded(0.19, 0.13, 0.13, fabric, 0, -0.12, 0.08));
    const shin = new THREE.Group();
    shin.position.y = -0.37;
    shin.add(capsule(0.09, 0.2, uniform, 0, -0.15, 0));
    shin.add(rounded(0.19, 0.16, 0.09, armor, 0, -0.02, -0.105));
    shin.add(rounded(0.18, 0.055, 0.08, trim, 0, -0.06, -0.145));
    shin.add(rounded(0.21, 0.13, 0.31, dark, 0, -0.35, -0.055));
    shin.add(rounded(0.2, 0.025, 0.29, trim, 0, -0.405, -0.055));
    thigh.add(shin);
    group.add(thigh);
    return { thigh, shin };
  };
  const arm = (side: number) => {
    const upper = new THREE.Group();
    upper.position.set(side * 0.31, 1.4, 0);
    upper.rotation.set(1.16, 0, -side * 0.3);
    const shoulder = sphere(0.125, armor, 0, -0.035, 0);
    shoulder.scale.set(1.05, 0.83, 1);
    upper.add(shoulder);
    upper.add(capsule(0.095, 0.19, uniform, 0, -0.16, 0));
    upper.add(rounded(0.19, 0.075, 0.19, stripe, 0, -0.13, 0));
    const forearm = new THREE.Group();
    forearm.position.y = -0.31;
    forearm.rotation.x = -0.15;
    forearm.add(capsule(0.085, 0.16, fabric, 0, -0.13, 0));
    forearm.add(rounded(0.17, 0.12, 0.19, dark, 0, -0.28, -0.01));
    forearm.add(rounded(0.13, 0.045, 0.12, trim, 0, -0.31, -0.07));
    upper.add(forearm);
    upperBody.add(upper);
    return { upper, forearm };
  };
  const left = leg(-1);
  const right = leg(1);
  const leftHand = arm(-1);
  const rightHand = arm(1);

  const rifle = new THREE.Group();
  rifle.position.set(0.08, 1.19, -0.39);
  const weaponParts = new THREE.Group();
  rifle.add(weaponParts);
  const fireFlash = sphere(0.08, new THREE.MeshBasicMaterial({ color: 0xffd89a }), 0, 0, -0.79);
  fireFlash.userData.keepSeparate = true;
  fireFlash.visible = false;
  rifle.add(fireFlash);
  upperBody.add(rifle);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 12), new THREE.MeshBasicMaterial({ color: 0x101c19, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  shadow.scale.y = 1.35;
  shadow.userData.keepSeparate = true;
  group.add(shadow);
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.94, 0.7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hitbox.position.y = 0.97;
  hitbox.userData.actorId = id;
  hitbox.userData.keepSeparate = true;
  group.add(hitbox);
  mergeEquipment(group);
  const rig: OperatorRig = {
    group, upperBody, head, hitbox,
    leftLeg: left.thigh, rightLeg: right.thigh, leftShin: left.shin, rightShin: right.shin,
    leftArm: leftHand.upper, rightArm: rightHand.upper,
    leftForearm: leftHand.forearm, rightForearm: rightHand.forearm, rifle, weaponParts, fireFlash,
  };
  setOperatorWeapon(rig, 'p12');
  return rig;
}