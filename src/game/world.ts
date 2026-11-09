import * as THREE from 'three';
import { MAPS, type MapId } from './data';

export interface Obstacle {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: 'container' | 'concrete' | 'building';
  color: number;
}

export const MAP_SCALE = 1.45;
const BASE_SITES = [
  { id: 'A' as const, x: -11.5, z: -4.8 },
  { id: 'B' as const, x: 11.5, z: -4.8 },
];
export const SITES = BASE_SITES.map((site) => ({ ...site, x: site.x * MAP_SCALE, z: site.z * MAP_SCALE }));

const EXPANSION: Obstacle[] = [
  { x: 0, z: 20, w: 10, d: 1.8, h: 3.3, kind: 'concrete', color: 0x6c7772 },
  { x: 0, z: -22, w: 10, d: 1.8, h: 3.3, kind: 'concrete', color: 0x687672 },
  { x: -27, z: 18, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x5e7772 },
  { x: 27, z: 18, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x836854 },
  { x: -27, z: 6, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x876b56 },
  { x: 27, z: 6, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x506e70 },
  { x: -27, z: -6, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x587471 },
  { x: 27, z: -6, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x806655 },
  { x: -27, z: -18, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x836a56 },
  { x: 27, z: -18, w: 4, d: 6, h: 3.2, kind: 'container', color: 0x557174 },
];

// Both spawn lines are screened by cover; the outer and inner lanes remain connected.
export const OBSTACLES: Obstacle[] = [
  { x: 0, z: 32.7, w: 67, d: 1, h: 4.5, kind: 'concrete', color: 0x536363 },
  { x: 0, z: -32.7, w: 67, d: 1, h: 4.5, kind: 'concrete', color: 0x536363 },
  { x: -33.2, z: 0, w: 1, d: 65, h: 4.5, kind: 'concrete', color: 0x536363 },
  { x: 33.2, z: 0, w: 1, d: 65, h: 4.5, kind: 'concrete', color: 0x536363 },
  { x: 0, z: 9.2, w: 10, d: 1.8, h: 3.3, kind: 'concrete', color: 0x6c7772 },
  { x: -16, z: 12, w: 6, d: 3, h: 3.2, kind: 'container', color: 0x826350 },
  { x: 16, z: 12, w: 6, d: 3, h: 3.2, kind: 'container', color: 0x49696b },
  { x: -17, z: 3.2, w: 3.6, d: 7, h: 3.4, kind: 'container', color: 0x4b6969 },
  { x: 17, z: 3.2, w: 3.6, d: 7, h: 3.4, kind: 'container', color: 0x806354 },
  { x: -8.5, z: 2.5, w: 4, d: 4, h: 3.1, kind: 'container', color: 0x697c77 },
  { x: 8.5, z: 2.5, w: 4, d: 4, h: 3.1, kind: 'container', color: 0x687875 },
  { x: 0, z: -2.3, w: 8.5, d: 3.5, h: 3.6, kind: 'container', color: 0x506767 },
  { x: -17, z: -9, w: 3.7, d: 6, h: 3.4, kind: 'container', color: 0x8b6c55 },
  { x: 17, z: -9, w: 3.7, d: 6, h: 3.4, kind: 'container', color: 0x526e70 },
  { x: -7, z: -10.5, w: 3.5, d: 4, h: 2.7, kind: 'concrete', color: 0x6f7971 },
  { x: 7, z: -10.5, w: 3.5, d: 4, h: 2.7, kind: 'concrete', color: 0x6f7971 },
  { x: 0, z: -14.7, w: 11, d: 1.8, h: 3.5, kind: 'concrete', color: 0x687672 },
  { x: -16, z: -18, w: 6, d: 2.6, h: 3.1, kind: 'container', color: 0x506b6a },
  { x: 16, z: -18, w: 6, d: 2.6, h: 3.1, kind: 'container', color: 0x806957 },
  ...EXPANSION,
];

const TERMINAL_OBSTACLES: Obstacle[] = ([
  ...OBSTACLES.slice(0, 5),
  { x: -16, z: 12, w: 3.5, d: 5, h: 3.2, kind: 'container', color: 0x776c5a },
  { x: 16, z: 12, w: 3.5, d: 5, h: 3.2, kind: 'container', color: 0x557277 },
  { x: -17, z: 3, w: 6, d: 3, h: 3.4, kind: 'container', color: 0x526d72 },
  { x: 17, z: 3, w: 6, d: 3, h: 3.4, kind: 'container', color: 0x917158 },
  { x: -8.5, z: 3.5, w: 3, d: 6, h: 3.1, kind: 'container', color: 0x697f7b },
  { x: 8.5, z: 3.5, w: 3, d: 6, h: 3.1, kind: 'container', color: 0x697f7b },
  { x: 0, z: -1.3, w: 3.5, d: 8, h: 3.6, kind: 'container', color: 0x4b6669 },
  { x: -17, z: -9, w: 6, d: 3, h: 3.4, kind: 'container', color: 0x92765e },
  { x: 17, z: -9, w: 6, d: 3, h: 3.4, kind: 'container', color: 0x56737a },
  { x: -7, z: -10.5, w: 3.5, d: 4, h: 2.7, kind: 'concrete', color: 0x737e79 },
  { x: 7, z: -10.5, w: 3.5, d: 4, h: 2.7, kind: 'concrete', color: 0x737e79 },
  { x: 0, z: -14.7, w: 11, d: 1.8, h: 3.5, kind: 'concrete', color: 0x697a79 },
  { x: -16, z: -18, w: 6, d: 2.6, h: 3.1, kind: 'container', color: 0x587478 },
  { x: 16, z: -18, w: 6, d: 2.6, h: 3.1, kind: 'container', color: 0x876f5c },
  ...EXPANSION,
] as Obstacle[]).map((obstacle, index) => ({ ...obstacle, h: index < 4 ? 8.3 : obstacle.h, kind: obstacle.kind === 'container' ? 'building' as const : obstacle.kind, color: obstacle.kind === 'container' ? 0x667777 : 0x657674 }));

const USINE_OBSTACLES: Obstacle[] = ([
  ...OBSTACLES.slice(0, 5),
  { x: -15, z: 13, w: 7, d: 2.7, h: 3.5, kind: 'building', color: 0x765f4c },
  { x: 15, z: 13, w: 7, d: 2.7, h: 3.5, kind: 'building', color: 0x5b706a },
  { x: -20, z: 4, w: 3.2, d: 7, h: 3.4, kind: 'building', color: 0x72695a },
  { x: 20, z: 4, w: 3.2, d: 7, h: 3.4, kind: 'building', color: 0x80614d },
  { x: -9, z: 3.5, w: 5, d: 3, h: 3.1, kind: 'concrete', color: 0x6e7770 },
  { x: 9, z: 3.5, w: 5, d: 3, h: 3.1, kind: 'concrete', color: 0x6e7770 },
  { x: 0, z: -1.5, w: 8, d: 3.5, h: 3.6, kind: 'building', color: 0x596c65 },
  { x: -17, z: -9, w: 3.5, d: 6, h: 3.4, kind: 'building', color: 0x846b53 },
  { x: 17, z: -9, w: 3.5, d: 6, h: 3.4, kind: 'building', color: 0x5c7069 },
  { x: -7, z: -11, w: 3.5, d: 3.5, h: 2.7, kind: 'concrete', color: 0x74766b },
  { x: 7, z: -11, w: 3.5, d: 3.5, h: 2.7, kind: 'concrete', color: 0x74766b },
  { x: 0, z: -14.7, w: 11, d: 1.8, h: 3.5, kind: 'concrete', color: 0x6e756b },
  { x: -16, z: -18, w: 5, d: 2.6, h: 3.1, kind: 'building', color: 0x71634f },
  { x: 16, z: -18, w: 5, d: 2.6, h: 3.1, kind: 'building', color: 0x586c63 },
  ...EXPANSION.map((obstacle) => ({ ...obstacle, kind: obstacle.kind === 'container' ? 'building' as const : obstacle.kind, color: obstacle.kind === 'container' ? 0x6d6d5d : 0x6c7066 })),
] as Obstacle[]).map((obstacle, index) => index < 4 ? { ...obstacle, h: 8.3 } : obstacle);

const FORT_OBSTACLES: Obstacle[] = [
  ...OBSTACLES.slice(0, 4).map((obstacle) => ({ ...obstacle, color: 0x827968 })),
  { x: 0, z: 9.2, w: 9, d: 2, h: 3.3, kind: 'concrete', color: 0xa49880 },
  { x: -14, z: 13, w: 4, d: 4, h: 3.2, kind: 'concrete', color: 0x9c8970 },
  { x: 14, z: 13, w: 4, d: 4, h: 3.2, kind: 'concrete', color: 0x9c8970 },
  { x: -20, z: 4, w: 4, d: 5, h: 3.4, kind: 'concrete', color: 0xa49880 },
  { x: 20, z: 4, w: 4, d: 5, h: 3.4, kind: 'concrete', color: 0xa49880 },
  { x: -10, z: 3, w: 3, d: 5, h: 3.1, kind: 'concrete', color: 0x9c8970 },
  { x: 10, z: 3, w: 3, d: 5, h: 3.1, kind: 'concrete', color: 0x9c8970 },
  { x: 0, z: -1, w: 5, d: 5, h: 3.6, kind: 'concrete', color: 0x92836e },
  { x: -16, z: -9, w: 4, d: 4, h: 3.4, kind: 'concrete', color: 0xa49880 },
  { x: 16, z: -9, w: 4, d: 4, h: 3.4, kind: 'concrete', color: 0xa49880 },
  { x: -6, z: -11, w: 3, d: 3, h: 2.7, kind: 'concrete', color: 0x9c8970 },
  { x: 6, z: -11, w: 3, d: 3, h: 2.7, kind: 'concrete', color: 0x9c8970 },
  { x: 0, z: -14.7, w: 10, d: 1.8, h: 3.5, kind: 'concrete', color: 0x9c8970 },
  { x: -16, z: -18, w: 5, d: 3, h: 3.1, kind: 'concrete', color: 0xa49880 },
  { x: 16, z: -18, w: 5, d: 3, h: 3.1, kind: 'concrete', color: 0xa49880 },
  ...EXPANSION.map((obstacle) => ({ ...obstacle, kind: 'concrete' as const, color: 0x9c907a })),
];

function baseObstaclesForMap(mapId: MapId) {
  if (mapId === 'terminal') return TERMINAL_OBSTACLES;
  if (mapId === 'usine') return USINE_OBSTACLES;
  if (mapId === 'forteresse') return FORT_OBSTACLES;
  return OBSTACLES;
}

export function obstaclesForMap(mapId: MapId) {
  return baseObstaclesForMap(mapId).map((obstacle) => ({
    ...obstacle,
    x: obstacle.x * MAP_SCALE,
    z: obstacle.z * MAP_SCALE,
    w: obstacle.w * MAP_SCALE,
    d: obstacle.d * MAP_SCALE,
  }));
}

export function blocked(x: number, z: number, radius = 0.55, obstacles = OBSTACLES) {
  return obstacles.some((box) =>
    x > box.x - box.w / 2 - radius && x < box.x + box.w / 2 + radius &&
    z > box.z - box.d / 2 - radius && z < box.z + box.d / 2 + radius,
  );
}

export function lineClear(x1: number, z1: number, x2: number, z2: number, margin = 0, obstacles = OBSTACLES) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return !obstacles.some((box) => {
    let near = 0;
    let far = 1;
    for (const [origin, direction, min, max] of [
      [x1, dx, box.x - box.w / 2 - margin, box.x + box.w / 2 + margin],
      [z1, dz, box.z - box.d / 2 - margin, box.z + box.d / 2 + margin],
    ]) {
      if (Math.abs(direction) < 0.0001) {
        if (origin < min || origin > max) return false;
      } else {
        const a = (min - origin) / direction;
        const b = (max - origin) / direction;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) return false;
      }
    }
    return far > 0.01 && near < 0.99;
  });
}

const STEP = 2 * MAP_SCALE;
const MIN_X = -31 * MAP_SCALE;
const MIN_Z = -29 * MAP_SCALE;
const COLS = 32;
const ROWS = 30;

export function findPath(startX: number, startZ: number, goalX: number, goalZ: number, obstacles = OBSTACLES) {
  const node = (x: number, z: number) => ({
    x: Math.max(0, Math.min(COLS - 1, Math.round((x - MIN_X) / STEP))),
    z: Math.max(0, Math.min(ROWS - 1, Math.round((z - MIN_Z) / STEP))),
  });
  const world = (x: number, z: number) => ({ x: MIN_X + x * STEP, z: MIN_Z + z * STEP });
  const start = node(startX, startZ);
  const end = node(goalX, goalZ);
  const key = (x: number, z: number) => z * COLS + x;
  const nearestOpen = (point: { x: number; z: number }) => {
    if (!blocked(world(point.x, point.z).x, world(point.x, point.z).z, 0.8, obstacles)) return point;
    for (let r = 1; r < 5; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = point.x + dx;
          const z = point.z + dz;
          if (x < 0 || x >= COLS || z < 0 || z >= ROWS) continue;
          const p = world(x, z);
          if (!blocked(p.x, p.z, 0.8, obstacles)) return { x, z };
        }
      }
    }
    return point;
  };
  const from = nearestOpen(start);
  const to = nearestOpen(end);
  const startKey = key(from.x, from.z);
  const endKey = key(to.x, to.z);
  const open = [startKey];
  const cameFrom = new Map<number, number>();
  const costs = new Map<number, number>([[startKey, 0]]);
  const heuristic = (id: number) => {
    const x = id % COLS;
    const z = Math.floor(id / COLS);
    return Math.abs(x - to.x) + Math.abs(z - to.z);
  };
  const seen = new Set<number>();
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      if ((costs.get(open[i]) ?? Infinity) + heuristic(open[i]) <
          (costs.get(open[best]) ?? Infinity) + heuristic(open[best])) best = i;
    }
    const current = open.splice(best, 1)[0];
    if (current === endKey) {
      const path: { x: number; z: number }[] = [];
      let currentNode = current;
      while (currentNode !== startKey && cameFrom.has(currentNode)) {
        path.unshift(world(currentNode % COLS, Math.floor(currentNode / COLS)));
        currentNode = cameFrom.get(currentNode)!;
      }
      return path;
    }
    seen.add(current);
    const x = current % COLS;
    const z = Math.floor(current / COLS);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= COLS || nz < 0 || nz >= ROWS) continue;
      const next = key(nx, nz);
      if (seen.has(next)) continue;
      const position = world(nx, nz);
      if (blocked(position.x, position.z, 0.8, obstacles)) continue;
      const newCost = (costs.get(current) ?? Infinity) + 1;
      if (newCost < (costs.get(next) ?? Infinity)) {
        costs.set(next, newCost);
        cameFrom.set(next, current);
        if (!open.includes(next)) open.push(next);
      }
    }
  }
  return [];
}

function box(w: number, h: number, d: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

function siteTexture(letter: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(145, 226, 211, .8)';
  ctx.lineWidth = 4;
  ctx.setLineDash([15, 10]);
  ctx.beginPath();
  ctx.arc(128, 128, 102, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(145, 226, 211, .45)';
  ctx.strokeRect(51, 51, 154, 154);
  ctx.font = 'bold 104px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(175, 238, 222, .72)';
  ctx.fillText(letter, 128, 130);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function spawnSignTexture(label: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = 'rgba(215, 234, 216, .5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 1000, 232);
  ctx.beginPath();
  ctx.moveTo(326, 42); ctx.lineTo(326, 214);
  ctx.moveTo(698, 42); ctx.lineTo(698, 214);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220, 239, 218, .75)';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('<  A', 170, 147);
  ctx.fillText('B  >', 855, 147);
  ctx.font = `bold ${label.length > 9 ? 43 : 56}px sans-serif`;
  ctx.fillText(label, 512, 120);
  ctx.font = '24px monospace';
  ctx.fillText('RESTRICTED AREA', 512, 165);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function surfaceTexture(kind: 'ground' | 'concrete' | 'metal') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ededed';
  ctx.fillRect(0, 0, 256, 256);
  let seed = kind === 'ground' ? 121 : kind === 'concrete' ? 347 : 759;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const marks = kind === 'ground' ? 1700 : 900;
  for (let i = 0; i < marks; i++) {
    const shade = Math.floor(85 + random() * 120);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.025 + random() * 0.1})`;
    const size = kind === 'metal' ? 1 + random() * 2 : 1 + random() * 4;
    ctx.fillRect(random() * 256, random() * 256, size, size * (kind === 'metal' ? 4 : 1));
  }
  ctx.strokeStyle = 'rgba(70, 70, 70, .08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const x = random() * 256;
    const y = random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + random() * 14, y + random() * (kind === 'metal' ? 38 : 8));
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set((kind === 'ground' ? 20 : 2) * MAP_SCALE, (kind === 'ground' ? 20 : 2) * MAP_SCALE);
  return texture;
}

export function buildWorld(scene: THREE.Scene, mapId: MapId = 'depot') {
  const obstacles = baseObstaclesForMap(mapId);
  const mapRoot = new THREE.Group();
  mapRoot.scale.setScalar(MAP_SCALE);
  const indoor = MAPS.find((map) => map.id === mapId)?.indoor ?? false;
  const colliderMeshes: THREE.Object3D[] = [];
  const sky = document.createElement('canvas');
  sky.width = 8;
  sky.height = 256;
  const skyContext = sky.getContext('2d')!;
  const skyGradient = skyContext.createLinearGradient(0, 0, 0, 256);
  skyGradient.addColorStop(0, mapId === 'forteresse' ? '#8b9c9b' : '#526d78');
  skyGradient.addColorStop(0.55, mapId === 'forteresse' ? '#c4bd9f' : '#9aafb0');
  skyGradient.addColorStop(1, mapId === 'forteresse' ? '#e2c8a0' : '#d2c1a5');
  skyContext.fillStyle = skyGradient;
  skyContext.fillRect(0, 0, 8, 256);
  const skyTexture = new THREE.CanvasTexture(sky);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = indoor ? new THREE.Color(mapId === 'usine' ? 0x4b4c43 : 0x425654) : skyTexture;
  if (indoor) skyTexture.dispose();
  scene.fog = new THREE.Fog(indoor ? 0x697a77 : mapId === 'forteresse' ? 0xb3ad96 : 0x9aada9, (indoor ? 24 : 32) * MAP_SCALE, (indoor ? 82 : 100) * MAP_SCALE);
  mapRoot.add(new THREE.HemisphereLight(indoor ? 0xc5ddd8 : 0xd2edeb, 0x4d5148, indoor ? 1.8 : 2.15));
  const sunlight = new THREE.DirectionalLight(indoor ? 0xffddb4 : 0xffd2a0, indoor ? 1.15 : 2.2);
  sunlight.position.set(-15, 30, 12);
  mapRoot.add(sunlight);

  const groundTexture = surfaceTexture('ground');
  const concreteTexture = surfaceTexture('concrete');
  const metalTexture = surfaceTexture('metal');
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({ color: mapId === 'terminal' ? 0x687b7b : mapId === 'usine' ? 0x79776b : mapId === 'forteresse' ? 0xa59a80 : 0x71817c, map: groundTexture, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.03;
  mapRoot.add(floor);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xaebcaf, transparent: true, opacity: 0.27 });
  const gridX = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.008, 64), lineMat, 13);
  const gridZ = new THREE.InstancedMesh(new THREE.BoxGeometry(64, 0.008, 0.025), lineMat, 13);
  const transform = new THREE.Matrix4();
  for (let i = 0; i < 13; i++) {
    const coordinate = -30 + i * 5;
    gridX.setMatrixAt(i, transform.makeTranslation(coordinate, 0.005, 0));
    gridZ.setMatrixAt(i, transform.makeTranslation(0, 0.006, coordinate));
  }
  gridX.instanceMatrix.needsUpdate = true;
  gridZ.instanceMatrix.needsUpdate = true;
  mapRoot.add(gridX, gridZ);
  const roadMat = new THREE.MeshBasicMaterial({ color: 0xe9c58a, transparent: true, opacity: 0.55 });
  const road = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.015, 1.5), roadMat, 15);
  for (let i = 0; i < 15; i++) road.setMatrixAt(i, transform.makeTranslation(0, 0.02, -28 + i * 4));
  road.instanceMatrix.needsUpdate = true;
  mapRoot.add(road);

  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x263c3d, transparent: true, opacity: 0.52 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x354848, roughness: 0.8 });
  obstacles.forEach((obstacle) => {
    const material = new THREE.MeshStandardMaterial({ color: obstacle.color, map: obstacle.kind === 'container' ? metalTexture : concreteTexture, roughness: 0.9, metalness: obstacle.kind === 'container' ? 0.28 : 0.04 });
    const mesh = box(obstacle.w, obstacle.h, obstacle.d, material);
    mesh.position.set(obstacle.x, obstacle.h / 2, obstacle.z);
    mapRoot.add(mesh);
    colliderMeshes.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMaterial);
    edges.position.copy(mesh.position);
    mapRoot.add(edges);
    if (obstacle.kind === 'container') {
      const positions: number[] = [];
      if (obstacle.w > obstacle.d) {
        for (let x = -obstacle.w / 2 + 0.45; x < obstacle.w / 2; x += 0.55) {
          for (const z of [-obstacle.d / 2 - 0.012, obstacle.d / 2 + 0.012]) {
            positions.push(x, -obstacle.h / 2 + 0.12, z, x, obstacle.h / 2 - 0.12, z);
          }
        }
      } else {
        for (let z = -obstacle.d / 2 + 0.45; z < obstacle.d / 2; z += 0.55) {
          for (const x of [-obstacle.w / 2 - 0.012, obstacle.w / 2 + 0.012]) {
            positions.push(x, -obstacle.h / 2 + 0.12, z, x, obstacle.h / 2 - 0.12, z);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const ribs = new THREE.LineSegments(geometry, edgeMaterial);
      ribs.position.copy(mesh.position);
      mapRoot.add(ribs);
      const trim = box(obstacle.w + 0.05, 0.09, obstacle.d + 0.05, trimMaterial);
      trim.position.set(obstacle.x, obstacle.h - 0.15, obstacle.z);
      mapRoot.add(trim);
    } else if ((obstacle.kind === 'concrete' || obstacle.kind === 'building') && obstacle.w < 20 && obstacle.d < 20) {
      const positions: number[] = [];
      if (obstacle.w > obstacle.d) {
        for (let x = -obstacle.w / 2 + 2; x < obstacle.w / 2; x += 2) {
          for (const z of [-obstacle.d / 2 - 0.015, obstacle.d / 2 + 0.015]) {
            positions.push(x, -obstacle.h / 2, z, x, obstacle.h / 2, z);
          }
        }
        for (const z of [-obstacle.d / 2 - 0.015, obstacle.d / 2 + 0.015]) {
          positions.push(-obstacle.w / 2, -obstacle.h / 2 + 0.45, z, obstacle.w / 2, -obstacle.h / 2 + 0.45, z);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const seams = new THREE.LineSegments(geometry, edgeMaterial);
      seams.position.copy(mesh.position);
      mapRoot.add(seams);
    }
  });

  if (mapId === 'terminal') {
    const windows = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.55, 0.04), new THREE.MeshStandardMaterial({ color: 0x284645, roughness: 0.35, metalness: 0.35 }), 16);
    const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(5.8, 0.1, 0.04), new THREE.MeshBasicMaterial({ color: 0x81b6a4 }), 4);
    let windowIndex = 0;
    let stripeIndex = 0;
    for (const center of [-17, 17]) {
      for (const side of [-1, 1]) {
        const z = 3 + side * 1.53;
        for (const offset of [-2.1, -0.7, 0.7, 2.1]) windows.setMatrixAt(windowIndex++, transform.makeTranslation(center + offset, 2.3, z));
        stripes.setMatrixAt(stripeIndex++, transform.makeTranslation(center, 1.45, z));
      }
    }
    windows.instanceMatrix.needsUpdate = true;
    stripes.instanceMatrix.needsUpdate = true;
    mapRoot.add(windows, stripes);
  }

  const spawnSign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.2, 2.05),
    new THREE.MeshBasicMaterial({ map: spawnSignTexture(MAPS.find((map) => map.id === mapId)!.code), transparent: true, opacity: 0.72, depthWrite: false }),
  );
  spawnSign.position.set(0, 1.9, 20.91);
  mapRoot.add(spawnSign);
  const defenderSign = spawnSign.clone();
  defenderSign.position.z = -22.91;
  defenderSign.rotation.y = Math.PI;
  mapRoot.add(defenderSign);

  for (const site of BASE_SITES) {
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ map: siteTexture(site.id), transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(site.x, 0.025, site.z);
    mapRoot.add(marker);
  }

  if (indoor) {
    const roofMaterial = new THREE.MeshStandardMaterial({ color: mapId === 'usine' ? 0x827b69 : 0x788d89, roughness: 0.95, side: THREE.DoubleSide });
    const beamMaterial = new THREE.MeshStandardMaterial({ color: mapId === 'usine' ? 0x6d5745 : 0x354e50, roughness: 0.75, metalness: 0.35 });
    const roof = box(72, 0.4, 70, roofMaterial);
    roof.position.y = 8.2;
    mapRoot.add(roof);
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(66, 0.35, 0.35), beamMaterial, 7);
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.08, 0.35), new THREE.MeshBasicMaterial({ color: mapId === 'usine' ? 0xffd59a : 0xd0f8ea }), 21);
    for (let i = 0; i < 7; i++) {
      const z = -30 + i * 10;
      beams.setMatrixAt(i, transform.makeTranslation(0, 7.8, z));
      [-22, 0, 22].forEach((x, index) => lights.setMatrixAt(i * 3 + index, transform.makeTranslation(x, 7.58, z)));
    }
    beams.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
    mapRoot.add(beams, lights);
    const conduitGeometry = new THREE.CylinderGeometry(0.18, 0.18, 64, 8);
    conduitGeometry.rotateX(Math.PI / 2);
    const conduits = new THREE.InstancedMesh(conduitGeometry, beamMaterial, 4);
    [-24, -8, 8, 24].forEach((x, index) => conduits.setMatrixAt(index, transform.makeTranslation(x, 7.15, 0)));
    conduits.instanceMatrix.needsUpdate = true;
    mapRoot.add(conduits);
    if (mapId === 'terminal') {
      const railMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb9ac, metalness: 0.6, roughness: 0.5 });
      for (const x of [-23, -21, 21, 23]) {
        const rail = box(0.08, 0.04, 63, railMaterial);
        rail.position.set(x, 0.03, 0);
        mapRoot.add(rail);
      }
    } else {
      const tankMaterial = new THREE.MeshStandardMaterial({ color: 0x8b7258, roughness: 0.7, metalness: 0.4 });
      obstacles.filter((obstacle) => obstacle.kind === 'building').slice(0, 6).forEach((obstacle) => {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2, 12), tankMaterial);
        tank.position.set(obstacle.x, obstacle.h + 1, obstacle.z);
        mapRoot.add(tank);
        const cap = box(1.45, 0.12, 1.45, beamMaterial);
        cap.position.set(obstacle.x, obstacle.h + 2, obstacle.z);
        mapRoot.add(cap);
      });
    }
    mapRoot.add(new THREE.AmbientLight(mapId === 'usine' ? 0xf1d6b5 : 0xd4e9dd, 0.95));
    scene.add(mapRoot);
    return colliderMeshes;
  }

  const distantMaterial = new THREE.MeshStandardMaterial({ color: mapId === 'forteresse' ? 0x9a9078 : 0x677a7b, roughness: 1 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x455a5d, roughness: 0.9 });
  if (mapId === 'forteresse') {
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x544c3e });
    for (const side of [-1, 1]) {
      const tower = box(7, 13, 7, distantMaterial);
      tower.position.set(side * 36, 6.5, -34);
      mapRoot.add(tower);
      for (let x = -2.5; x <= 2.5; x += 2.5) {
        const battlement = box(1.2, 1.3, 1, distantMaterial);
        battlement.position.set(side * 36 + x, 13.4, -30.5);
        mapRoot.add(battlement);
      }
      const window = box(1.1, 2, 0.12, windowMaterial);
      window.position.set(side * 36, 9, -30.42);
      mapRoot.add(window);
    }
    scene.add(mapRoot);
    return colliderMeshes;
  }
  for (let i = 0; i < 9; i++) {
    const height = 6 + (i % 3) * 3;
    const building = box(7 + (i % 2) * 3, height, 8, distantMaterial);
    building.position.set(-40 + i * 10, height / 2, -44 - (i % 2) * 5);
    mapRoot.add(building);
  }
  for (const side of [-1, 1]) {
    const tower = box(0.6, 18, 0.6, darkMaterial);
    tower.position.set(side * 41, 9, -36);
    mapRoot.add(tower);
    const boom = box(14, 0.45, 0.45, darkMaterial);
    boom.position.set(side * 35, 17, -36);
    mapRoot.add(boom);
    const cable = box(0.08, 9, 0.08, darkMaterial);
    cable.position.set(side * 29, 12.5, -36);
    mapRoot.add(cable);
    const lampPost = box(0.15, 7, 0.15, darkMaterial);
    lampPost.position.set(side * 32, 3.5, -1);
    mapRoot.add(lampPost);
    const lamp = box(0.8, 0.14, 0.4, new THREE.MeshBasicMaterial({ color: 0xffc887 }));
    lamp.position.set(side * 32, 6.9, -1);
    mapRoot.add(lamp);
  }
  scene.add(mapRoot);
  return colliderMeshes;
}