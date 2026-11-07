// ─────────────────────────────────────────────────────────────
//  VALENCE — Construction du monde 3D (procédural, piloté par thème)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BUY_BARRIER, BOUNDS, type MapDef, type Solid } from './maps';

export interface WorldRefs {
  wallMeshes: THREE.Object3D[];
  colliders: { minX: number; maxX: number; minZ: number; maxZ: number; h: number; y0: number }[];
  barrier: THREE.Mesh;
  sun: THREE.DirectionalLight;
  update: (dt: number, t: number) => void;
  dispose: () => void;
}

function makeCanvas(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  return c;
}
function tex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function hash(i: number) { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); }
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// ——— texture de mur ———
function wallTexture(style: string, speck: string): THREE.CanvasTexture {
  const c = makeCanvas(256, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    if (style === 'desert') {
      for (let i = 0; i < 5200; i++) {
        const v = 200 + Math.random() * 55;
        g.fillStyle = `rgba(${v},${v * 0.95 | 0},${v * 0.86 | 0},${0.1 + Math.random() * 0.14})`;
        g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.4, 1 + Math.random() * 2.4);
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(120,98,70,${0.03 + Math.random() * 0.05})`;
        g.fillRect(Math.random() * s, 0, 1 + Math.random() * 3, s);
      }
    } else if (style === 'arctic') {
      // panneaux métalliques rivetés
      g.fillStyle = '#f2f6fa'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(70,95,120,0.3)'; g.lineWidth = 3;
      for (let y = 0; y <= s; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
      for (let x = 0; x <= s; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, s); g.stroke(); }
      g.fillStyle = 'rgba(60,85,110,0.4)';
      for (let y = 10; y < s; y += 64) for (let x = 12; x < s; x += 26) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
      for (let i = 0; i < 1200; i++) {
        g.fillStyle = `rgba(190,210,228,${Math.random() * 0.25})`;
        g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
    } else {
      // béton urbain + tags
      g.fillStyle = '#eceaf2'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 4200; i++) {
        const v = 190 + Math.random() * 60;
        g.fillStyle = `rgba(${v},${v},${v + 8 | 0},${0.08 + Math.random() * 0.14})`;
        g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      g.strokeStyle = 'rgba(40,40,60,0.18)'; g.lineWidth = 2;
      for (let y = 0; y <= s; y += 86) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
      for (let i = 0; i < 5; i++) {
        g.fillStyle = `rgba(${150 + Math.random() * 100 | 0},${40 + Math.random() * 80 | 0},${140 + Math.random() * 110 | 0},0.1)`;
        g.fillRect(Math.random() * s, Math.random() * s, 30 + Math.random() * 70, 14 + Math.random() * 26);
      }
    }
    const grad = g.createLinearGradient(0, s * 0.78, 0, s);
    grad.addColorStop(0, 'rgba(60,50,40,0)');
    grad.addColorStop(1, `rgba(40,42,52,0.32)`);
    g.fillStyle = grad; g.fillRect(0, s * 0.78, s, s * 0.22);
    void speck;
  });
  return tex(c);
}

// ——— texture du sol (plan tactique intégré) ———
function groundTexture(map: MapDef): THREE.CanvasTexture {
  const th = map.theme;
  const W = 120;
  const px = 2048 / W;
  const to = (x: number, z: number) => [(x + W / 2) * px, (z + W / 2) * px] as const;
  const c = makeCanvas(2048, (g, s) => {
    g.fillStyle = th.groundBase; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 30000; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.045})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    g.fillStyle = th.groundSpeck;
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 30 + Math.random() * 130;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, th.groundSpeck + '44');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    for (const z of map.zones) {
      const [ax, az] = to(z.x0, z.z0);
      const [bx, bz] = to(z.x1, z.z1);
      g.fillStyle = th.groundPave;
      g.fillRect(ax, az, bx - ax, bz - az);
      g.strokeStyle = th.groundLine;
      g.lineWidth = 7;
      g.strokeRect(ax, az, bx - ax, bz - az);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 2;
      const step = 3.4 * px;
      for (let x = ax; x < bx; x += step) { g.beginPath(); g.moveTo(x, az); g.lineTo(x, bz); g.stroke(); }
      for (let y = az; y < bz; y += step) { g.beginPath(); g.moveTo(ax, y); g.lineTo(bx, y); g.stroke(); }
    }
    for (const site of [map.siteA, map.siteB]) {
      const [cx, cz] = to(site.x, site.z);
      const r = site.r * px;
      g.strokeStyle = th.accentCss;
      g.lineWidth = 9; g.setLineDash([58, 30]);
      g.beginPath(); g.arc(cx, cz, r, 0, 7); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 0.14;
      g.fillStyle = th.accentCss;
      g.beginPath(); g.arc(cx, cz, r, 0, 7); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.font = `800 ${r * 1.05 | 0}px Rajdhani, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(site.name, cx, cz + 4);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crateTexture(color: string, style: string): THREE.CanvasTexture {
  const c = makeCanvas(128, (g, s) => {
    g.fillStyle = color; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.14})`;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 9;
    g.strokeRect(5, 5, s - 10, s - 10);
    if (style === 'desert') {
      g.beginPath(); g.moveTo(5, 5); g.lineTo(s - 5, s - 5); g.moveTo(s - 5, 5); g.lineTo(5, s - 5); g.stroke();
    } else {
      // nervures de conteneur
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 6;
      for (let x = 16; x < s; x += 16) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, s - 8); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.fillRect(14, s * 0.4, s * 0.4, 10);
    }
  });
  return tex(c);
}

function clothTexture(c1: string, c2: string): THREE.CanvasTexture {
  const c = makeCanvas(128, (g, s) => {
    g.fillStyle = c1; g.fillRect(0, 0, s, s);
    g.fillStyle = c2;
    for (let x = 0; x < s; x += 32) g.fillRect(x, 0, 16, s);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  return tex(c);
}

/** enseigne / panneau lumineux (cartes néon) */
function signTexture(accent: string): THREE.CanvasTexture {
  const glyphs = ['零 八', 'ネオン', '四番', 'VALENCE', '96 区', 'ラーメン'];
  const c = makeCanvas(256, (g, s) => {
    g.fillStyle = '#0a0812'; g.fillRect(0, 0, s, s);
    g.strokeStyle = accent; g.lineWidth = 8;
    g.strokeRect(12, 12, s - 24, s - 24);
    g.shadowColor = accent; g.shadowBlur = 26;
    g.fillStyle = accent;
    g.font = '700 54px Rajdhani, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(glyphs[(Math.random() * glyphs.length) | 0], s / 2, s / 2);
    g.shadowBlur = 0;
  });
  return tex(c);
}

// ═════════════════════════════════════════════════════════════
export function buildWorld(scene: THREE.Scene, map: MapDef, quality: 'low' | 'medium' | 'high'): WorldRefs {
  const th = map.theme;
  const wallMeshes: THREE.Object3D[] = [];
  const colliders: WorldRefs['colliders'] = [];
  const animated: ((dt: number, t: number) => void)[] = [];
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T): T => { disposables.push(d); return d; };
  const detail = quality === 'high' ? 1 : quality === 'medium' ? 0.6 : 0.3;

  // ——— Lumières ———
  const sun = new THREE.DirectionalLight(th.sunColor, th.sunInt);
  sun.position.set(...th.sunPos);
  sun.castShadow = quality !== 'low';
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
  const sc = sun.shadow.camera;
  sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58; sc.far = 220;
  sun.shadow.bias = -0.0007;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiInt));
  if (th.indoor) scene.add(new THREE.AmbientLight(0xaebccd, 0.85));
  scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);

  const indoor = !!th.indoor;

  // ——— Ciel ———
  const skyMat = track(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(th.sky[0]) },
      mid: { value: new THREE.Color(th.sky[1]) },
      bot: { value: new THREE.Color(th.sky[2]) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){ float h=normalize(vP).y;
      vec3 c = h>0.18 ? mix(mid,top,smoothstep(0.18,0.75,h)) : mix(bot,mid,smoothstep(-0.08,0.18,h));
      gl_FragColor=vec4(c,1.0); }`,
  }));
  scene.add(new THREE.Mesh(track(new THREE.SphereGeometry(420, 24, 16)), skyMat));

  // astre (extérieur uniquement)
  const sunSpr = new THREE.Sprite(track(new THREE.SpriteMaterial({
    map: tex(makeCanvas(128, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      const core = th.style === 'neon' ? 'rgba(220,200,255,1)' : 'rgba(255,248,226,1)';
      const mid = th.style === 'neon' ? 'rgba(160,120,255,0.7)' : 'rgba(255,224,160,0.85)';
      gr.addColorStop(0, core); gr.addColorStop(0.28, mid); gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    })), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
  })));
  sunSpr.scale.setScalar(th.style === 'neon' ? 60 : 90);
  sunSpr.position.set(th.sunPos[0] * 2.6, th.sunPos[1] * 2.8, th.sunPos[2] * 2.6);
  if (!indoor) scene.add(sunSpr);

  // étoiles (nuit)
  if (th.style === 'neon') {
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.8 + 0.1, r = 330;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, track(new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, fog: false, transparent: true, opacity: 0.85 }))));
  }

  // ——— Nuages ———
  const cloudTex = tex(makeCanvas(256, (g, s) => {
    for (let i = 0; i < 22; i++) {
      const x = s * 0.2 + Math.random() * s * 0.6, y = s * 0.35 + Math.random() * s * 0.3, r = 18 + Math.random() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }));
  const cloudCount = indoor ? 0 : Math.round(9 * detail) + 2;
  for (let i = 0; i < cloudCount; i++) {
    const m = new THREE.Mesh(
      track(new THREE.PlaneGeometry(60 + hash(i) * 70, 18 + hash(i + 9) * 16)),
      track(new THREE.MeshBasicMaterial({
        map: cloudTex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
        opacity: th.style === 'neon' ? 0.42 : 0.8,
        color: th.style === 'neon' ? 0x7a62c8 : 0xffffff,
      }))
    );
    m.position.set((hash(i * 3) - 0.5) * 320, 66 + hash(i * 7) * 45, (hash(i * 13) - 0.5) * 320);
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    const sp = 0.4 + hash(i * 5) * 0.5;
    animated.push((dt) => { m.position.x += dt * sp; if (m.position.x > 240) m.position.x = -240; });
  }

  // ——— Sol ———
  const ground = new THREE.Mesh(
    track(new THREE.PlaneGeometry(120, 120)),
    track(new THREE.MeshStandardMaterial({
      map: track(groundTexture(map)),
      roughness: th.style === 'neon' ? 0.42 : 0.95,
      metalness: th.style === 'neon' ? 0.22 : 0,
    }))
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ——— Horizon ———
  const farMat = track(new THREE.MeshStandardMaterial({
    color: th.style === 'arctic' ? 0xcfe0ec : th.style === 'neon' ? 0x241c3c : 0xc9a86f,
    roughness: 1, flatShading: true,
  }));
  const farMat2 = track(new THREE.MeshStandardMaterial({
    color: th.style === 'arctic' ? 0xa9c2d6 : th.style === 'neon' ? 0x16112a : 0xa8815a,
    roughness: 1, flatShading: true,
  }));
  if (indoor || th.terrain === 'none') {
    // complexe fermé : aucun décor d'horizon
  } else if (th.terrain === 'towers') {
    // skyline de gratte-ciels
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + hash(i) * 0.1;
      const r = 95 + hash(i * 3) * 60;
      const h = 24 + hash(i * 5) * 70;
      const w = 8 + hash(i * 7) * 12;
      const b = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, w)), i % 3 ? farMat : farMat2);
      b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      scene.add(b);
      // fenêtres lumineuses
      if (i % 2 === 0) {
        const win = new THREE.Mesh(
          track(new THREE.PlaneGeometry(w * 0.8, h * 0.8)),
          track(new THREE.MeshBasicMaterial({ color: hash(i * 11) > 0.5 ? 0xff5fae : 0x45e0ff, transparent: true, opacity: 0.12, fog: true }))
        );
        win.position.set(Math.cos(a) * (r - w / 2 - 0.1), h / 2, Math.sin(a) * (r - w / 2 - 0.1));
        win.lookAt(0, h / 2, 0);
        scene.add(win);
      }
    }
  } else {
    const count = th.terrain === 'bergs' ? 26 : 22;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + hash(i) * 0.25;
      const r = 92 + hash(i * 2) * 35;
      const h = 9 + hash(i * 3) * 14;
      const seg = th.terrain === 'bergs' ? 4 : 5;
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(24 + hash(i * 5) * 22, h, seg)), farMat);
      cone.position.set(Math.cos(a) * r, h / 2 - 1.5, Math.sin(a) * r);
      cone.rotation.y = hash(i * 7) * 3;
      scene.add(cone);
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const r = 210 + hash(i * 11) * 70;
      const h = 60 + hash(i * 13) * 55;
      const m = new THREE.Mesh(track(new THREE.ConeGeometry(60 + hash(i) * 40, h, 4)), farMat2);
      m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      scene.add(m);
    }
  }

  // ——— Matériaux de la carte ———
  const wallTex = track(wallTexture(th.style, th.groundSpeck));
  const wallMats = th.wallPalette.map((col) => track(new THREE.MeshStandardMaterial({
    map: wallTex, color: new THREE.Color(col),
    roughness: th.style === 'arctic' ? 0.62 : 0.93,
    metalness: th.style === 'arctic' ? 0.25 : 0.03,
  })));
  const trimMats = th.trimPalette.map((col) => track(new THREE.MeshStandardMaterial({
    color: new THREE.Color(col), roughness: 0.7, metalness: 0.2,
    emissive: th.style === 'neon' ? new THREE.Color(col).multiplyScalar(0.55) : new THREE.Color(0x000000),
    emissiveIntensity: th.style === 'neon' ? 1.4 : 0,
  })));
  const crateMats = th.crateTints.map((col) => track(new THREE.MeshStandardMaterial({
    map: track(crateTexture(col, th.style)), roughness: 0.84, metalness: th.style === 'desert' ? 0.03 : 0.3,
  })));
  const metalMat = track(new THREE.MeshStandardMaterial({ color: 0x59636e, roughness: 0.45, metalness: 0.78 }));
  const accentMat = track(new THREE.MeshStandardMaterial({
    color: 0x0c1014, emissive: new THREE.Color(th.accent), emissiveIntensity: 2.2, roughness: 0.4,
  }));
  const leafMat = track(new THREE.MeshStandardMaterial({ color: th.style === 'arctic' ? 0x9fc7d6 : 0x5d7d3a, roughness: 1 }));
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const cylGeo = track(new THREE.CylinderGeometry(0.5, 0.5, 1, 14));

  // ——— Construction des solides ———
  const push = (s: Solid) => {
    colliders.push({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2, h: s.h, y0: s.y0 ?? 0 });
  };

  let idx = 0;
  for (const s of map.solids) {
    idx++;
    push(s);
    const tint = s.tint ?? 0;
    const y0 = s.y0 ?? 0;

    if (s.kind === 'barrel' || s.kind === 'tank') {
      // fût / cuve cylindrique
      const mat = s.kind === 'tank' ? metalMat : crateMats[tint % crateMats.length];
      const body = new THREE.Mesh(cylGeo, mat);
      body.scale.set(s.w, s.h, s.d);
      body.position.set(s.x, y0 + s.h / 2, s.z);
      body.castShadow = body.receiveShadow = true;
      scene.add(body);
      wallMeshes.push(body);
      const ring = new THREE.Mesh(cylGeo, trimMats[tint % trimMats.length]);
      ring.scale.set(s.w * 1.05, s.h * 0.1, s.d * 1.05);
      ring.position.set(s.x, y0 + s.h * 0.72, s.z);
      scene.add(ring);
      const cap = new THREE.Mesh(cylGeo, metalMat);
      cap.scale.set(s.w * 0.92, s.h * 0.08, s.d * 0.92);
      cap.position.set(s.x, y0 + s.h + 0.02, s.z);
      scene.add(cap);
      if (s.kind === 'tank') {
        const glow = new THREE.Mesh(boxGeo, accentMat);
        glow.scale.set(s.w * 0.3, s.h * 0.12, 0.06);
        glow.position.set(s.x, y0 + s.h * 0.45, s.z - s.d / 2 - 0.03);
        scene.add(glow);
      }
      continue;
    }

    if (s.kind === 'sign') {
      const body = new THREE.Mesh(boxGeo, crateMats[tint % crateMats.length]);
      body.scale.set(s.w, s.h, s.d);
      body.position.set(s.x, y0 + s.h / 2, s.z);
      body.castShadow = body.receiveShadow = true;
      scene.add(body);
      wallMeshes.push(body);
      const panel = new THREE.Mesh(
        track(new THREE.PlaneGeometry(s.w * 0.9, s.h * 0.7)),
        track(new THREE.MeshBasicMaterial({ map: track(signTexture(th.accentCss)), transparent: true, side: THREE.DoubleSide }))
      );
      panel.position.set(s.x, y0 + s.h * 0.55, s.z - s.d / 2 - 0.02);
      scene.add(panel);
      const l = new THREE.PointLight(th.accent, th.style === 'neon' ? 2.4 : 0.6, 7, 2);
      l.position.set(s.x, y0 + s.h * 0.6, s.z - s.d / 2 - 0.4);
      if (th.style === 'neon') scene.add(l);
      continue;
    }

    // boîte générique
    let bodyMat: THREE.Material = wallMats[tint % wallMats.length];
    if (s.kind === 'crate') bodyMat = crateMats[tint % crateMats.length];
    if (s.kind === 'planter') bodyMat = trimMats[2 % trimMats.length];
    if (s.kind === 'stall') bodyMat = crateMats[(tint + 1) % crateMats.length];
    if (s.kind === 'pillar' && tint === 4) bodyMat = metalMat;

    const body = new THREE.Mesh(boxGeo, bodyMat);
    body.scale.set(s.w, s.h, s.d);
    body.position.set(s.x, y0 + s.h / 2, s.z);
    body.castShadow = body.receiveShadow = true;
    scene.add(body);
    wallMeshes.push(body);

    if (s.kind === 'bldg' || s.kind === 'wall') {
      const bandH = Math.min(0.55, s.h * 0.1);
      const band = new THREE.Mesh(boxGeo, trimMats[tint % trimMats.length]);
      band.scale.set(s.w + 0.07, bandH, s.d + 0.07);
      band.position.set(s.x, s.h - bandH / 2 - 0.5, s.z);
      scene.add(band);
      const cap = new THREE.Mesh(boxGeo, wallMats[(tint + 2) % wallMats.length]);
      cap.scale.set(s.w + 0.3, 0.44, s.d + 0.3);
      cap.position.set(s.x, s.h + 0.22, s.z);
      cap.castShadow = true;
      scene.add(cap);
      wallMeshes.push(cap);
      // pilastres d'angle
      if (s.h >= 6 && s.w > 5 && s.d > 5) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const p = new THREE.Mesh(boxGeo, trimMats[(tint + 1) % trimMats.length]);
          p.scale.set(0.46, s.h, 0.46);
          p.position.set(s.x + sx * (s.w / 2 - 0.23), s.h / 2, s.z + sz * (s.d / 2 - 0.23));
          scene.add(p);
        }
      }
      // fenêtres / hublots sur les grandes façades
      if (s.h >= 6 && detail > 0.5) {
        const rows = th.style === 'neon' ? 3 : 1;
        const faceZ = s.z + s.d / 2 + 0.03;
        const cols = Math.max(1, Math.floor(s.w / 3.4));
        for (let r = 0; r < rows; r++) {
          for (let cI = 0; cI < cols; cI++) {
            const wx = s.x - s.w / 2 + (cI + 0.5) * (s.w / cols);
            const wy = 1.9 + r * 2.4;
            if (wy > s.h - 1) continue;
            const win = new THREE.Mesh(boxGeo,
              th.style === 'neon' && hash(idx * 7 + cI + r * 3) > 0.45 ? accentMat : trimMats[3 % trimMats.length]);
            win.scale.set(Math.min(1.3, s.w / cols * 0.45), 1.1, 0.12);
            win.position.set(wx, wy, faceZ);
            scene.add(win);
          }
        }
      }
    }
    if (s.kind === 'stall') {
      const awnMat = track(new THREE.MeshStandardMaterial({
        map: track(clothTexture(tint % 2 ? hex(th.accent) : th.trimPalette[0], '#efe6d2')), roughness: 0.9, side: THREE.DoubleSide,
      }));
      const awn = new THREE.Mesh(boxGeo, awnMat);
      awn.scale.set(s.w + 0.8, 0.09, s.d + 1.5);
      awn.position.set(s.x, s.h + 0.66, s.z);
      awn.rotation.x = 0.3;
      awn.castShadow = true;
      scene.add(awn);
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(cylGeo, metalMat);
        p.scale.set(0.07, s.h + 0.7, 0.07);
        p.position.set(s.x + sx * (s.w / 2 + 0.3), (s.h + 0.7) / 2, s.z - s.d / 2 - 0.5);
        scene.add(p);
      }
    }
    if (s.kind === 'crate' && detail > 0.4) {
      // cadre métallique sur les grosses caisses
      if (s.w > 3) {
        for (const sz of [-1, 1]) {
          const bar = new THREE.Mesh(boxGeo, metalMat);
          bar.scale.set(s.w + 0.04, 0.1, 0.1);
          bar.position.set(s.x, s.h - 0.12, s.z + sz * (s.d / 2));
          scene.add(bar);
        }
      }
    }
    if (s.kind === 'planter') {
      const leaf = new THREE.Mesh(boxGeo, leafMat);
      leaf.scale.set(s.w * 0.92, 0.5, s.d * 0.92);
      leaf.position.set(s.x, s.h + 0.22, s.z);
      scene.add(leaf);
    }
    if (s.kind === 'pillar' && tint === 4) {
      const glow = new THREE.Mesh(boxGeo, accentMat);
      glow.scale.set(s.w * 0.34, s.h * 0.9, s.d * 0.34);
      glow.position.set(s.x, s.h / 2, s.z);
      scene.add(glow);
      const l = new THREE.PointLight(th.accent, 2.6, 11, 2);
      l.position.set(s.x, s.h * 0.7, s.z);
      scene.add(l);
    }
  }

  // ——— Plafonds (cartes intérieures) ———
  if (map.ceilings?.length) {
    const ceilMat = track(new THREE.MeshStandardMaterial({
      map: wallTex, color: new THREE.Color(th.wallPalette[3]), roughness: 0.95, metalness: 0.08, side: THREE.DoubleSide,
    }));
    const beamMat = track(new THREE.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.6, metalness: 0.5 }));
    const tubeMat = track(new THREE.MeshStandardMaterial({
      color: 0x10151a, emissive: new THREE.Color(th.lampColor), emissiveIntensity: 2.6, roughness: 0.3,
    }));
    const ductMat = track(new THREE.MeshStandardMaterial({ color: 0x737b85, roughness: 0.5, metalness: 0.65 }));

    for (const c of map.ceilings) {
      const w = c.x1 - c.x0, d = c.z1 - c.z0;
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      // dalle
      const slab = new THREE.Mesh(boxGeo, ceilMat);
      slab.scale.set(w, 0.45, d);
      slab.position.set(cx, c.y + 0.225, cz);
      slab.receiveShadow = true;
      scene.add(slab);
      wallMeshes.push(slab);   // bloque les balles et la ligne de vue

      // poutres transversales
      const along = w >= d;
      const span = along ? w : d;
      const nBeams = Math.max(2, Math.floor(span / 6));
      for (let i = 0; i < nBeams; i++) {
        const t = (i + 0.5) / nBeams;
        const b = new THREE.Mesh(boxGeo, beamMat);
        if (along) { b.scale.set(0.42, 0.34, d); b.position.set(c.x0 + t * w, c.y - 0.15, cz); }
        else { b.scale.set(w, 0.34, 0.42); b.position.set(cx, c.y - 0.15, c.z0 + t * d); }
        scene.add(b);
      }

      // néons encastrés + halo lumineux
      if (c.lights !== false && detail > 0.25) {
        const nL = Math.max(1, Math.floor(span / 9));
        for (let i = 0; i < nL; i++) {
          const t = (i + 0.5) / nL;
          const tb = new THREE.Mesh(boxGeo, tubeMat);
          if (along) { tb.scale.set(1.9, 0.11, 0.3); tb.position.set(c.x0 + t * w, c.y - 0.34, cz); }
          else { tb.scale.set(0.3, 0.11, 1.9); tb.position.set(cx, c.y - 0.34, c.z0 + t * d); }
          scene.add(tb);
          const l = new THREE.PointLight(th.lampColor, 7.5, 26, 1.7);
          l.position.set(tb.position.x, c.y - 0.7, tb.position.z);
          scene.add(l);
        }
      }

      // gaines de ventilation le long du plafond
      if (detail > 0.5 && span > 12) {
        const duct = new THREE.Mesh(cylGeo, ductMat);
        const off = along ? d * 0.3 : w * 0.3;
        if (along) { duct.scale.set(0.62, w * 0.85, 0.62); duct.rotation.z = Math.PI / 2; duct.position.set(cx, c.y - 0.5, cz + off); }
        else { duct.scale.set(0.62, d * 0.85, 0.62); duct.rotation.x = Math.PI / 2; duct.position.set(cx + off, c.y - 0.5, cz); }
        scene.add(duct);
      }
    }
  }

  // ——— Guirlandes / rampes lumineuses ———
  if (th.lamps) {
    const wireMat = track(new THREE.LineBasicMaterial({ color: 0x3a3330, transparent: true, opacity: 0.75 }));
    const bulbGeo = track(new THREE.SphereGeometry(0.1, 6, 5));
    const bulbMat = track(new THREE.MeshBasicMaterial({ color: th.lampColor }));
    const strings: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-8, 5.2, 12), new THREE.Vector3(-18, 4.8, 12)],
      [new THREE.Vector3(8, 5.0, 18), new THREE.Vector3(18, 4.7, 18)],
      [new THREE.Vector3(-24, 5.4, -6), new THREE.Vector3(-34, 5.0, -6)],
      [new THREE.Vector3(24, 5.4, -6), new THREE.Vector3(34, 5.0, -6)],
      [new THREE.Vector3(-10, 5.6, -8), new THREE.Vector3(10, 5.6, -8)],
      [new THREE.Vector3(-6, 5.8, 32), new THREE.Vector3(6, 5.8, 32)],
    ];
    for (const [a, b] of strings) {
      const pts: THREE.Vector3[] = [];
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(t * Math.PI) * 0.55;
        pts.push(p);
      }
      scene.add(new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(pts)), wireMat));
      for (let i = 1; i < n; i += 2) {
        const m = new THREE.Mesh(bulbGeo, bulbMat);
        m.position.copy(pts[i]);
        scene.add(m);
      }
      if (th.style === 'neon' || th.style === 'arctic') {
        const l = new THREE.PointLight(th.lampColor, 1.5, 12, 2);
        l.position.copy(a).lerp(b, 0.5).setY(a.y - 0.4);
        scene.add(l);
      }
    }
  }

  // ——— Bannières ———
  if (th.cloth) {
    const cloths = [
      track(clothTexture(hex(th.accent), '#ece8e1')),
      track(clothTexture(th.trimPalette[0], '#ece8e1')),
    ];
    const spots: [number, number, number, number][] = [
      [-12, 4.2, 22, 0], [12, 4.2, 22, 1], [-32, 4.5, 8, 0], [32, 4.5, 8, 1], [0, 4.4, -4.2, 0],
    ];
    for (const [bx2, by, bz, ci] of spots) {
      const b = new THREE.Mesh(
        track(new THREE.PlaneGeometry(2.1, 3.1, 1, 6)),
        track(new THREE.MeshStandardMaterial({ map: cloths[ci], side: THREE.DoubleSide, roughness: 1 }))
      );
      b.position.set(bx2, by, bz);
      b.castShadow = true;
      scene.add(b);
      const ph = hash(bx2 + bz) * 6;
      animated.push((dt, t) => { void dt; b.rotation.y = Math.sin(t * 0.9 + ph) * 0.16; b.rotation.z = Math.sin(t * 1.3 + ph) * 0.05; });
    }
  }

  // ——— Particules d'ambiance (poussière / neige / pluie lumineuse) ———
  const pn = Math.round((th.style === 'arctic' ? 520 : 280) * detail) + 60;
  // (en intérieur la poussière flotte au lieu de tomber)
  const ppos = new Float32Array(pn * 3);
  const pvel = new Float32Array(pn);
  for (let i = 0; i < pn; i++) {
    ppos[i * 3] = (Math.random() - 0.5) * 88;
    ppos[i * 3 + 1] = Math.random() * (indoor ? 4.2 : 12);
    ppos[i * 3 + 2] = (Math.random() - 0.5) * 88;
    pvel[i] = 0.3 + Math.random() * 1.2;
  }
  const pGeo = track(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pMat = track(new THREE.PointsMaterial({
    color: th.style === 'arctic' ? 0xffffff : th.style === 'neon' ? 0xa9b6ff : th.style === 'bunker' ? 0xbfc8d2 : 0xf5e2b0,
    size: th.style === 'arctic' ? 0.11 : 0.055,
    transparent: true, opacity: th.style === 'arctic' ? 0.85 : 0.6, depthWrite: false,
  }));
  const parts = new THREE.Points(pGeo, pMat);
  parts.frustumCulled = false;
  scene.add(parts);
  const falling = th.style === 'arctic' || th.style === 'neon';
  animated.push((dt, t) => {
    if (falling) {
      const a = pGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pn; i++) {
        let y = a.getY(i) - pvel[i] * dt * (th.style === 'arctic' ? 1.1 : 3.2);
        let x = a.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.25;
        if (y < 0) { y = 12; x = (Math.random() - 0.5) * 88; }
        a.setY(i, y); a.setX(i, x);
      }
      a.needsUpdate = true;
    } else {
      parts.rotation.y = t * 0.008;
      parts.position.y = Math.sin(t * 0.24) * 0.4;
    }
  });

  // ——— Barrière d'achat ———
  const bw = BUY_BARRIER.x1 - BUY_BARRIER.x0;
  const barrierTex = tex(makeCanvas(128, (g, s) => {
    g.fillStyle = 'rgba(255,70,85,0.14)'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,90,105,0.8)'; g.lineWidth = 3;
    for (let y = 0; y <= s; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); }
    g.strokeStyle = 'rgba(255,150,160,0.5)';
    for (let x = -s; x < s * 2; x += 26) { g.beginPath(); g.moveTo(x, s); g.lineTo(x + s, 0); g.stroke(); }
  }), bw / 3, 1.6);
  const barrier = new THREE.Mesh(
    track(new THREE.BoxGeometry(bw, BUY_BARRIER.h, BUY_BARRIER.z1 - BUY_BARRIER.z0)),
    track(new THREE.MeshBasicMaterial({ map: barrierTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }))
  );
  barrier.position.set((BUY_BARRIER.x0 + BUY_BARRIER.x1) / 2, BUY_BARRIER.h / 2, (BUY_BARRIER.z0 + BUY_BARRIER.z1) / 2);
  scene.add(barrier);
  animated.push((dt) => { barrierTex.offset.y -= dt * 0.35; barrierTex.offset.x += dt * 0.12; });

  for (const px of [BUY_BARRIER.x0, BUY_BARRIER.x1]) {
    const post2 = new THREE.Mesh(boxGeo, metalMat);
    post2.scale.set(0.5, BUY_BARRIER.h + 0.6, 1.0);
    post2.position.set(px, (BUY_BARRIER.h + 0.6) / 2, (BUY_BARRIER.z0 + BUY_BARRIER.z1) / 2);
    scene.add(post2);
  }

  const update = (dt: number, t: number) => { for (const fn of animated) fn(dt, t); };
  const dispose = () => { for (const d of disposables) d.dispose(); };

  return { wallMeshes, colliders, barrier, sun, update, dispose };
}

export { BOUNDS };
