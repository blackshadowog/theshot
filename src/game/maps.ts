import * as THREE from "three";
import type { GroundKind, MapDef, TimePreset } from "./data";
import {
  barkTexture,
  buildingFacadeTexture,
  camoTexture,
  cloudTexture,
  containerTexture,
  fabricTexture,
  foliageTexture,
  groundTexture,
  metalTexture,
  moonTexture,
  rockTexture,
  waterBumpTexture,
  woodTexture,
} from "./textures";

export interface SpawnPoint {
  pos: THREE.Vector3;
  range: number;
  elevated: boolean;
}

export interface MapBuild {
  spawns: SpawnPoint[];
  vipPath: [THREE.Vector3, THREE.Vector3];
  camo: number;
  perchColor: number;
  update?: (time: number) => void;
  applyTimePreset?: (preset: TimePreset) => void;
}

interface Ctx {
  scene: THREE.Scene;
  solids: THREE.Object3D[];
  rng: () => number;
  high: boolean;
  windows: THREE.MeshStandardMaterial[];
  lamps: Array<{ light: THREE.PointLight; bulb: THREE.Mesh; cone: THREE.Mesh; baseIntensity: number }>;
  dome: THREE.Mesh | null;
  celestialDisc: THREE.Mesh | null;
  celestialHalo: THREE.Sprite | null;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.9, metal = 0, emissive = 0, emissiveIntensity = 0) {
  const key = `${color}-${rough}-${metal}-${emissive}-${emissiveIntensity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity });
    matCache.set(key, m);
  }
  return m;
}

export function clearMapCache() {
  matCache.forEach((m) => m.dispose());
  matCache.clear();
  texCache.forEach((m) => m.dispose());
  texCache.clear();
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
const texCache = new Map<string, THREE.MeshStandardMaterial>();
function texMat(key: string, make: () => { map: THREE.Texture; rough?: number; metal?: number; color?: number; bump?: number }) {
  let m = texCache.get(key);
  if (!m) {
    const spec = make();
    m = new THREE.MeshStandardMaterial({
      map: spec.map,
      bumpMap: spec.bump ? spec.map : null,
      bumpScale: spec.bump ?? 0,
      roughness: spec.rough ?? 0.9,
      metalness: spec.metal ?? 0,
      color: spec.color ?? 0xffffff,
    });
    texCache.set(key, m);
  }
  return m;
}

function box(ctx: Ctx, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material | number, solid = true, rotY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === "number" ? mat(material) : material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = ctx.high;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  if (solid) ctx.solids.push(mesh);
  return mesh;
}

function cyl(ctx: Ctx, rt: number, rb: number, h: number, x: number, y: number, z: number, material: THREE.Material | number, seg = 8, solid = true) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof material === "number" ? mat(material) : material);
  mesh.position.set(x, y, z);
  mesh.castShadow = ctx.high;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  if (solid) ctx.solids.push(mesh);
  return mesh;
}

type FacadePack = { map: THREE.Texture; emissiveMap: THREE.Texture };

function windowTexture(lit: string, dark: string, wall: string, litChance: number, cols = 4, rows = 8): FacadePack {
  const style = wall === "#c8a377" ? "stucco" : wall === "#3d3f36" ? "brick" : "concrete";
  return buildingFacadeTexture(lit, dark, wall, Math.max(0.42, litChance), cols, rows, style);
}

function building(ctx: Ctx, w: number, h: number, d: number, x: number, z: number, tex: FacadePack, color: number, _emissive: boolean, spawns?: SpawnPoint[], parapet = 0x000000) {
  const rx = Math.max(1, Math.round(w / 3.2));
  const ry = Math.max(1, Math.round(h / 3.6));
  const t = tex.map.clone();
  t.needsUpdate = true;
  t.userData.temporary = true;
  t.repeat.set(rx, ry);

  const em = tex.emissiveMap.clone();
  em.needsUpdate = true;
  em.userData.temporary = true;
  em.repeat.set(rx, ry);

  const material = new THREE.MeshStandardMaterial({
    color,
    map: t,
    bumpMap: t,
    bumpScale: 0.08,
    roughness: 0.84,
    emissive: 0xffe4b5,
    emissiveMap: em,
    emissiveIntensity: 0.85,
  });
  ctx.windows.push(material);

  const roof = texMat(`roof-${color}`, () => ({
    map: groundTexture("concrete", 3, 3),
    color: new THREE.Color(color).multiplyScalar(0.65).getHex(),
    rough: 0.92,
    bump: 0.08,
  }));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [material, material, roof, roof, material, material]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = ctx.high;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  ctx.solids.push(mesh);
  if (parapet) {
    box(ctx, w, 0.5, 0.2, x, h + 0.25, z + d / 2 - 0.1, parapet);
    box(ctx, 0.2, 0.5, d, x - w / 2 + 0.1, h + 0.25, z, parapet);
    box(ctx, 0.2, 0.5, d, x + w / 2 - 0.1, h + 0.25, z, parapet);
  }
  if (spawns) spawns.push({ pos: new THREE.Vector3(x, h, z + d / 2 - 0.9), range: Math.max(0.4, w / 2 - 0.9), elevated: true });
  return mesh;
}

function pine(ctx: Ctx, x: number, z: number, s: number, color: number, snow = false) {
  const trunkMat = texMat("pine-bark", () => ({ map: barkTexture("#35271b", 1, 2), rough: 0.95, bump: 0.14 }));
  const needleMat = texMat(`pine-foliage-${color}-${snow}`, () => ({ map: foliageTexture(color, snow), rough: 0.88, bump: 0.1 }));
  cyl(ctx, 0.08 * s, 0.14 * s, s * 0.8, x, s * 0.4, z, trunkMat, 6, false);
  for (let i = 0; i < 3; i += 1) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(s * (0.44 - i * 0.08), s * 0.82, 8), needleMat);
    c.position.set(x, s * (0.75 + i * 0.4), z);
    c.castShadow = ctx.high;
    ctx.scene.add(c);
    if (snow) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(s * (0.31 - i * 0.06), s * 0.35, 8), mat(0xf2f6fa));
      cap.position.set(x, s * (0.97 + i * 0.4), z);
      ctx.scene.add(cap);
    }
  }
}

function palm(ctx: Ctx, x: number, z: number, h: number) {
  const lean = (ctx.rng() - 0.5) * 0.4;
  const trunkMat = texMat("palm-bark", () => ({ map: barkTexture("#6e5639", 1, 2), rough: 0.92, bump: 0.14 }));
  for (let i = 0; i < 5; i += 1) {
    cyl(ctx, 0.12, 0.15, h / 5 + 0.05, x + lean * i * 0.3, (i + 0.5) * (h / 5), z, trunkMat, 7, false);
  }
  const top = new THREE.Vector3(x + lean * 1.5, h, z);
  const leafMat = texMat("palm-leaf", () => ({ map: foliageTexture(0x567534, false), rough: 0.82 }));
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 5), leafMat);
    leaf.scale.set(1, 1, 0.25);
    leaf.position.copy(top);
    leaf.rotation.set(0, (i / 7) * Math.PI * 2, 1.9);
    leaf.translateY(1.1);
    leaf.castShadow = ctx.high;
    ctx.scene.add(leaf);
  }
}

function lamp(ctx: Ctx, x: number, z: number, color: number, h = 4, intensity = 14) {
  cyl(ctx, 0.05, 0.07, h, x, h / 2, z, 0x2b2c2e, 6, false);
  box(ctx, 0.35, 0.08, 0.2, x, h + 0.04, z, 0x222426, false);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color }));
  bulb.position.set(x, h, z);
  ctx.scene.add(bulb);
  const light = new THREE.PointLight(color, intensity, 16, 2);
  light.position.set(x, h - 0.2, z);
  ctx.scene.add(light);
  // Volumetric light cone for dusk / night
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, h, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  cone.position.set(x, h / 2, z);
  cone.raycast = () => undefined;
  ctx.scene.add(cone);
  ctx.lamps.push({ light, bulb, cone, baseIntensity: intensity });
}

function sandbags(ctx: Ctx, x: number, z: number, w: number, color = 0x7d6d4f) {
  const bagMat = texMat(`bag-${color}`, () => ({ map: fabricTexture(css(color), 2, 2), rough: 1, bump: 0.12 }));
  for (let i = 0; i < Math.round(w / 0.55); i += 1) {
    for (let r = 0; r < 2; r += 1) {
      const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 3, 6), bagMat);
      bag.rotation.z = Math.PI / 2;
      bag.position.set(x - w / 2 + i * 0.55 + (r ? 0.27 : 0), 0.17 + r * 0.3, z);
      bag.castShadow = ctx.high;
      ctx.scene.add(bag);
      ctx.solids.push(bag);
    }
  }
}

function ground(ctx: Ctx, kind: GroundKind, tile: number, opts: { rough?: number; metal?: number; tint?: number } = {}) {
  const material = texMat(`ground-${kind}-${tile}`, () => ({
    map: groundTexture(kind, tile, tile),
    rough: opts.rough ?? 1,
    metal: opts.metal ?? 0,
    color: opts.tint ?? 0xffffff,
    bump: kind === "snow" ? 0.05 : 0.14,
  }));
  const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), material);
  g.rotation.x = -Math.PI / 2;
  g.position.z = -60;
  g.receiveShadow = true;
  ctx.scene.add(g);
  ctx.solids.push(g);
}

// ---------------- detail props ----------------
function crate(ctx: Ctx, x: number, z: number, s = 1, rotY = 0) {
  const body = texMat("crate", () => ({ map: woodTexture("#6b4e33", 2, 2), rough: 0.85, bump: 0.2 }));
  const band = mat(0x4a4a44, 0.6, 0.4);
  const box1 = box(ctx, s, s, s, x, s / 2, z, body, true, rotY);
  for (const dz of [-s * 0.34, s * 0.34]) {
    box(ctx, s * 1.03, s * 0.09, s * 0.05, x, s / 2, z + dz, band, false, rotY);
  }
  return box1;
}

function barrel(ctx: Ctx, x: number, z: number, color = 0x3c5a4a, rust = true) {
  const m = texMat(`barrel-${color}-${rust}`, () => ({
    map: metalTexture(css(color), 1, 2, true),
    rough: 0.6,
    metal: 0.5,
    bump: 0.15,
  }));
  cyl(ctx, 0.29, 0.29, 0.86, x, 0.43, z, m, 12, true);
  cyl(ctx, 0.3, 0.3, 0.04, x, 0.72, z, mat(0x2b2b2b, 0.5, 0.6), 12, false);
  cyl(ctx, 0.3, 0.3, 0.04, x, 0.26, z, mat(0x2b2b2b, 0.5, 0.6), 12, false);
}

function tire(ctx: Ctx, x: number, z: number, stack = 2) {
  for (let i = 0; i < stack; i += 1) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 8, 14), mat(0x1c1c1f, 0.95));
    t.rotation.x = Math.PI / 2;
    t.position.set(x, 0.15 + i * 0.27, z);
    t.castShadow = ctx.high;
    ctx.scene.add(t);
    ctx.solids.push(t);
  }
}

function pallet(ctx: Ctx, x: number, z: number) {
  const m = texMat("pallet", () => ({ map: woodTexture("#7a5a3a", 1, 1), rough: 0.9, bump: 0.2 }));
  for (let i = 0; i < 5; i += 1) box(ctx, 1.2, 0.05, 0.18, x, 0.16, z - 0.4 + i * 0.2, m, false);
  for (const d of [-0.45, 0, 0.45]) box(ctx, 0.18, 0.12, 1, x + d, 0.06, z, m, true);
}

function debris(ctx: Ctx, x: number, z: number, count: number, color = 0x6b6455) {
  for (let i = 0; i < count; i += 1) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + ctx.rng() * 0.34), mat(color));
    r.position.set(x + (ctx.rng() - 0.5) * 4, 0.1 + ctx.rng() * 0.12, z + (ctx.rng() - 0.5) * 4);
    r.rotation.set(ctx.rng() * 3, ctx.rng() * 3, ctx.rng() * 3);
    r.castShadow = ctx.high;
    r.receiveShadow = true;
    ctx.scene.add(r);
    ctx.solids.push(r);
  }
}

function grassTufts(ctx: Ctx, count: number, colors: number[], area = 60) {
  const geo = new THREE.ConeGeometry(0.07, 0.62, 3);
  const tuft = new THREE.InstancedMesh(geo, mat(colors[0]), ctx.high ? count : Math.floor(count / 2));
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < tuft.count; i += 1) {
    dummy.position.set((ctx.rng() - 0.5) * area, 0.3, -12 - ctx.rng() * area);
    dummy.rotation.set((ctx.rng() - 0.5) * 0.4, ctx.rng() * 3, (ctx.rng() - 0.5) * 0.4);
    dummy.scale.setScalar(0.7 + ctx.rng() * 0.9);
    dummy.updateMatrix();
    tuft.setMatrixAt(i, dummy.matrix);
    tuft.setColorAt(i, color.setHex(colors[i % colors.length]));
  }
  tuft.instanceMatrix.needsUpdate = true;
  ctx.scene.add(tuft);
}

function rubble(ctx: Ctx, x: number, z: number, w: number, d: number) {
  const m = texMat("rubble", () => ({ map: groundTexture("concrete", 2, 2), rough: 1, bump: 0.35 }));
  for (let i = 0; i < 7; i += 1) {
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.3 + ctx.rng(), 0.14 + ctx.rng() * 0.2, 0.3 + ctx.rng()), m);
    chunk.position.set(x + (ctx.rng() - 0.5) * w, 0.12, z + (ctx.rng() - 0.5) * d);
    chunk.rotation.set(ctx.rng() * 0.3, ctx.rng() * 3, ctx.rng() * 0.3);
    chunk.castShadow = ctx.high;
    ctx.scene.add(chunk);
    ctx.solids.push(chunk);
  }
}

function updateDomeColors(dome: THREE.Mesh, top: number, horizon: number) {
  const geo = dome.geometry as THREE.BufferGeometry;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const topC = new THREE.Color(top);
  const horC = new THREE.Color(horizon);
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / 200;
    const c = horC.clone().lerp(topC, Math.min(1, Math.max(0, Math.pow(Math.max(0, y), 0.72) * 1.4)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.attributes.color.needsUpdate = true;
}

function skyDome(scene: THREE.Scene, top: number, horizon: number, ctx?: Ctx) {
  const geo = new THREE.SphereGeometry(200, 32, 20);
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  updateDomeColors(dome, top, horizon);
  dome.raycast = () => undefined;
  scene.add(dome);
  if (ctx) ctx.dome = dome;
  return dome;
}

function celestial(scene: THREE.Scene, color: number, pos: [number, number, number], size: number, ctx?: Ctx) {
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshBasicMaterial({ color, fog: false }));
  disc.scale.setScalar(size);
  disc.position.set(...pos);
  disc.raycast = () => undefined;
  scene.add(disc);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.35, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(size * 7, size * 7, 1);
  halo.position.set(...pos);
  halo.raycast = () => undefined;
  scene.add(halo);
  if (ctx) {
    ctx.celestialDisc = disc;
    ctx.celestialHalo = halo;
  }
}

function mountains(ctx: Ctx, color: number, snowCap: boolean, z = -140) {
  const rockMat = texMat(`mountain-rock-${color}`, () => ({ map: rockTexture(color, 4, 4), rough: 0.95, bump: 0.25 }));
  const snowMat = texMat("mountain-snow", () => ({ map: groundTexture("snow", 4, 4), rough: 0.85 }));
  for (let i = 0; i < 9; i += 1) {
    const h = 22 + ctx.rng() * 28;
    const x = -120 + i * 30 + ctx.rng() * 12;
    const m = new THREE.Mesh(new THREE.ConeGeometry(18 + ctx.rng() * 16, h, 7), rockMat);
    m.position.set(x, h / 2 - 2, z - ctx.rng() * 30);
    ctx.scene.add(m);
    if (snowCap) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(6.5, h * 0.32, 7), snowMat);
      cap.position.set(x, h - h * 0.15 - 2, m.position.z);
      ctx.scene.add(cap);
    }
  }
}

// ---------------- MAPS ----------------

function marsh(ctx: Ctx): MapBuild {
  const spawns: SpawnPoint[] = [];
  ground(ctx, "marsh", 22);
  grassTufts(ctx, 900, [0x3c5226, 0x2f4220, 0x4b6230, 0x27361d], 70);
  skyDome(ctx.scene, 0x050a0c, 0x1c2a26, ctx);
  celestial(ctx.scene, 0xd9ccaa, [-40, 55, -170], 5, ctx);
  mountains(ctx, 0x26342c, false);
  const water = new THREE.MeshStandardMaterial({
    color: 0x0e2224,
    roughness: 0.12,
    metalness: 0.85,
    bumpMap: waterBumpTexture(5, 5),
    bumpScale: 0.08,
  });
  for (const [x, z, r] of [[-3, -32, 7], [9, -48, 6], [-12, -52, 8], [14, -22, 4]] as const) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(r, 24), water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(x, 0.02, z);
    w.receiveShadow = true;
    ctx.scene.add(w);
  }
  const reedGeo = new THREE.ConeGeometry(0.03, 1.3, 3);
  const reeds = new THREE.InstancedMesh(reedGeo, mat(0x55653a), ctx.high ? 500 : 200);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < reeds.count; i += 1) {
    const a = ctx.rng() * Math.PI * 2;
    const cx = [-3, 9, -12][i % 3];
    const cz = [-32, -48, -52][i % 3];
    const r = 5 + ctx.rng() * 3;
    dummy.position.set(cx + Math.cos(a) * r, 0.6, cz + Math.sin(a) * r * 0.8);
    dummy.rotation.set((ctx.rng() - 0.5) * 0.3, 0, (ctx.rng() - 0.5) * 0.3);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
  }
  ctx.scene.add(reeds);

  // watchtower
  const tx = -9;
  const tz = -40;
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) box(ctx, 0.2, 5, 0.2, tx + dx, 2.5, tz + dz, 0x3b3226);
  box(ctx, 3.2, 0.2, 3.2, tx, 5, tz, 0x4a3d2c);
  box(ctx, 3.2, 0.9, 0.08, tx, 5.55, tz - 1.55, 0x4a3d2c);
  box(ctx, 3.6, 0.15, 3.6, tx, 7.6, tz, 0x2f281f);
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) box(ctx, 0.1, 2.5, 0.1, tx + dx, 6.3, tz + dz, 0x3b3226, false);
  spawns.push({ pos: new THREE.Vector3(tx, 5.1, tz + 0.6), range: 0.9, elevated: true });

  const tex = windowTexture("#e8b060", "#141814", "#3d3f36", 0.18, 3, 3);
  building(ctx, 7, 4, 6, 11, -46, tex, 0x6c6a5a, true, spawns, 0x4d4b40);
  building(ctx, 5, 3.5, 5, -16, -26, tex, 0x5a5a4c, true, spawns, 0x4d4b40);
  building(ctx, 9, 5, 7, 2, -62, tex, 0x5f5e50, true, spawns, 0x4d4b40);

  // dock bridge
  box(ctx, 9, 0.2, 1.8, 0, 0.35, -32, 0x4c3f2d);
  for (let i = 0; i < 5; i += 1) box(ctx, 0.15, 0.8, 0.15, -4 + i * 2, 0.2, -31, 0x33291d, false);

  sandbags(ctx, 4, -27, 3);
  sandbags(ctx, -6, -44, 2.5);
  sandbags(ctx, 12, -44, 2, 0x55604a);
  crate(ctx, 6.5, -36, 0.95);
  crate(ctx, 7.3, -37, 0.75, 0.4);
  crate(ctx, 6.8, -36.4, 0.7);
  barrel(ctx, 8.4, -34.5, 0x3f5648);
  barrel(ctx, 8.9, -35.2, 0x6b4a2c);
  tire(ctx, -7.5, -39, 2);
  debris(ctx, -3.5, -37, 5, 0x5c5648);
  debris(ctx, 9.5, -43, 4, 0x4c4a40);
  pallet(ctx, -10.5, -30);

  for (let i = 0; i < 26; i += 1) {
    const side = i % 2 ? 1 : -1;
    pine(ctx, side * (16 + ctx.rng() * 20), -14 - ctx.rng() * 60, 4 + ctx.rng() * 3, 0x21332a);
  }
  for (let i = 0; i < 18; i += 1) pine(ctx, -30 + i * 3.6 + ctx.rng() * 2, -72 - ctx.rng() * 10, 5 + ctx.rng() * 3, 0x1c2c24);

  lamp(ctx, -5, -28, 0xffb566, 3);
  lamp(ctx, 8, -40, 0xffb566, 3);
  lamp(ctx, -11, -36, 0xffb566, 3);

  for (const [x, z, r] of [[-4, -26, 2.5], [2, -36, 3], [7, -30, 2], [-3, -48, 3], [5, -54, 3], [-12, -32, 2], [13, -34, 2], [0, -42, 2.5]] as const) {
    spawns.push({ pos: new THREE.Vector3(x, 0, z), range: r, elevated: false });
  }
  return { spawns, vipPath: [new THREE.Vector3(-20, 0, -38), new THREE.Vector3(20, 0, -38)], camo: 0x4a5340, perchColor: 0x3a3a32 };
}

function desert(ctx: Ctx): MapBuild {
  const spawns: SpawnPoint[] = [];
  ground(ctx, "sand", 18);
  grassTufts(ctx, 220, [0x9e9a58, 0x8a7c46], 60);
  skyDome(ctx.scene, 0x5f86b3, 0xf2b27a, ctx);
  celestial(ctx.scene, 0xfff0c8, [70, 22, -170], 8, ctx);
  mountains(ctx, 0xb4845a, false, -150);
  for (let i = 0; i < 10; i += 1) {
    const dune = new THREE.Mesh(new THREE.SphereGeometry(10 + ctx.rng() * 8, 16, 8), mat(0xc59a62));
    dune.scale.set(1.6, 0.22, 1);
    dune.position.set(-70 + i * 16, 0, -85 - ctx.rng() * 20);
    ctx.scene.add(dune);
  }
  const tex = windowTexture("#2a1d12", "#1e150e", "#c8a377", 0.5, 3, 3);
  building(ctx, 6, 5, 6, -12, -30, tex, 0xd4b085, false, spawns, 0xbf9b70);
  building(ctx, 7, 7, 6, -4, -48, tex, 0xcfa87a, false, spawns, 0xbf9b70);
  building(ctx, 6, 4, 6, 8, -38, tex, 0xd9b88e, false, spawns, 0xbf9b70);
  building(ctx, 5, 6, 5, 15, -26, tex, 0xc9a276, false, spawns, 0xbf9b70);
  building(ctx, 8, 9, 7, 12, -58, tex, 0xc49c6e, false, spawns, 0xbf9b70);
  building(ctx, 6, 3.5, 5, -17, -48, tex, 0xd6b389, false, spawns, 0xbf9b70);
  // dome mosque-like
  building(ctx, 8, 6, 8, -14, -66, tex, 0xe0c9a3, false);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3f8c8a, 0.5, 0.3));
  dome.position.set(-14, 6, -66);
  ctx.scene.add(dome);
  cyl(ctx, 0.6, 0.7, 14, -8.5, 7, -68, 0xe0c9a3, 10);

  const cloth = [0xb33b2e, 0x2e5fa3, 0xd9a13b, 0x3f8a5a];
  for (let i = 0; i < 4; i += 1) {
    const x = -5 + i * 3.4;
    const z = -26 - (i % 2) * 2;
    for (const [dx, dz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]]) cyl(ctx, 0.04, 0.04, 2.3, x + dx, 1.15, z + dz, 0x5a4630, 5, false);
    const roof = box(ctx, 2.8, 0.06, 2.4, x, 2.35, z, cloth[i], false);
    roof.rotation.x = 0.12;
    box(ctx, 2.2, 0.8, 0.8, x, 0.4, z + 0.6, 0x7a5a3a);
  }
  for (let i = 0; i < 12; i += 1) palm(ctx, (i % 2 ? 1 : -1) * (6 + ctx.rng() * 18), -16 - ctx.rng() * 50, 5 + ctx.rng() * 3);
  const market = texMat("market-tent", () => ({ map: fabricTexture("#d9a13b", 3, 2), rough: 0.95 }));
  box(ctx, 4, 1.4, 2, 3, 0.7, -33, market, true, 0.4);
  box(ctx, 2.5, 0.9, 1.9, 3.2, 1.8, -33, 0x5d5646, true, 0.4);
  sandbags(ctx, -8, -38, 3, 0xa38a62);
  crate(ctx, -6.2, -33.5, 0.85);
  crate(ctx, -5.4, -34.3, 0.7, 0.5);
  barrel(ctx, 10.5, -31, 0x7a5a3a, false);
  barrel(ctx, 11.1, -31.8, 0x8a6a44, false);
  debris(ctx, 7, -46, 6, 0xa08a68);
  debris(ctx, -12, -38, 5, 0x96795a);
  tire(ctx, -14.5, -32, 3);
  for (let i = 0; i < 6; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + ctx.rng() * 0.8), mat(0x9c7b56));
    rock.position.set(-20 + ctx.rng() * 40, 0.3, -20 - ctx.rng() * 40);
    rock.castShadow = ctx.high;
    ctx.scene.add(rock);
    ctx.solids.push(rock);
  }
  for (const [x, z, r] of [[-2, -30, 3], [6, -29, 2.5], [-8, -34, 2], [2, -42, 3], [-10, -44, 2], [6, -50, 3], [16, -34, 2], [-3, -56, 3]] as const) {
    spawns.push({ pos: new THREE.Vector3(x, 0, z), range: r, elevated: false });
  }
  return { spawns, vipPath: [new THREE.Vector3(-22, 0, -35), new THREE.Vector3(22, 0, -35)], camo: 0x9b8662, perchColor: 0xb89468 };
}

function snow(ctx: Ctx): MapBuild {
  const spawns: SpawnPoint[] = [];
  ground(ctx, "snow", 14);
  skyDome(ctx.scene, 0x8ea3b8, 0xd5dee8, ctx);
  celestial(ctx.scene, 0xfff4d8, [-32, 34, -165], 7, ctx);
  mountains(ctx, 0x8c9aab, true, -130);
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xa9c6db,
    roughness: 0.08,
    metalness: 0.45,
    bumpMap: waterBumpTexture(4, 4),
    bumpScale: 0.04,
  });
  const ice = new THREE.Mesh(new THREE.CircleGeometry(9, 28), iceMat);
  ice.rotation.x = -Math.PI / 2;
  ice.position.set(-5, 0.02, -38);
  ctx.scene.add(ice);

  // radar building + dome
  const tex = windowTexture("#ffe7a8", "#2a3440", "#7d8a94", 0.35, 4, 2);
  building(ctx, 9, 4, 6, 9, -46, tex, 0x8a96a0, true, spawns, 0x6b7780);
  const radar = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.8), mat(0xeef2f6, 0.6));
  radar.position.set(11, 4, -48);
  ctx.scene.add(radar);
  building(ctx, 5, 3, 5, -15, -28, tex, 0x7c8790, true, spawns, 0x6b7780);
  building(ctx, 10, 6, 8, -4, -64, tex, 0x77838c, true, spawns, 0x6b7780);

  // cabins with pitched roofs
  for (const [x, z] of [[15, -28], [-17, -46], [18, -60]] as const) {
    box(ctx, 4, 2.6, 3.4, x, 1.3, z, 0x5b4331);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), mat(0xf0f4f8));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.85);
    roof.position.set(x, 3.4, z);
    ctx.scene.add(roof);
  }
  // comms mast
  const mx = -10;
  const mz = -40;
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(ctx, 0.12, 6, 0.12, mx + dx, 3, mz + dz, 0x9a3a2a);
  box(ctx, 2.4, 0.15, 2.4, mx, 6, mz, 0x6b6f73);
  cyl(ctx, 0.06, 0.06, 8, mx, 10, mz, 0xb54a38, 6, false);
  spawns.push({ pos: new THREE.Vector3(mx, 6.08, mz + 0.5), range: 0.7, elevated: true });

  // helipad
  const pad = new THREE.Mesh(new THREE.CircleGeometry(4, 24), mat(0x3d4247));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(16, 0.03, -36);
  ctx.scene.add(pad);
  box(ctx, 0.4, 0.02, 2.4, 15.2, 0.05, -36, 0xf0e8d0, false);
  box(ctx, 0.4, 0.02, 2.4, 16.8, 0.05, -36, 0xf0e8d0, false);
  box(ctx, 1.6, 0.02, 0.4, 16, 0.05, -36, 0xf0e8d0, false);

  sandbags(ctx, 3, -28, 3, 0xcfd6dc);
  sandbags(ctx, -3, -50, 3, 0xcfd6dc);
  crate(ctx, -6.4, -44, 0.9);
  crate(ctx, -6.9, -43.1, 0.6, 0.3);
  barrel(ctx, 5.6, -46, 0x8c3a2a);
  barrel(ctx, 6.2, -45.2, 0x3a5a6b);
  tire(ctx, -13, -34, 2);
  debris(ctx, 12, -30, 5, 0x8e9aa3);
  debris(ctx, -11, -52, 6, 0x7d8992);
  const netMat = new THREE.MeshStandardMaterial({ map: camoTexture(["#8f8f7a", "#e6ecf1", "#5f665c"], "snow-net", false, 3, 3), roughness: 0.95, transparent: true, opacity: 0.95 });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), netMat);
  net.position.set(-18.4, 1.6, -44);
  net.rotation.y = Math.PI / 2.2;
  net.rotation.z = 0.06;
  ctx.scene.add(net);
  for (let i = 0; i < 12; i += 1) box(ctx, 0.12, 1.1, 0.12, -20 + i * 3.4, 0.55, -24, 0x5b4331, false);
  box(ctx, 40, 0.1, 0.06, -1, 0.95, -24, 0x5b4331, false);
  for (let i = 0; i < 34; i += 1) {
    const side = i % 2 ? 1 : -1;
    pine(ctx, side * (18 + ctx.rng() * 24), -12 - ctx.rng() * 70, 4.5 + ctx.rng() * 3.5, 0x2a4034, true);
  }
  lamp(ctx, 4, -40, 0xfff0c8, 4, 8);
  lamp(ctx, -8, -30, 0xfff0c8, 4, 8);
  for (const [x, z, r] of [[0, -30, 3], [6, -34, 2.5], [-6, -32, 2], [3, -42, 3], [-8, -50, 2.5], [6, -54, 3], [14, -40, 2], [-2, -56, 3]] as const) {
    spawns.push({ pos: new THREE.Vector3(x, 0, z), range: r, elevated: false });
  }
  return { spawns, vipPath: [new THREE.Vector3(-22, 0, -34), new THREE.Vector3(16, 0, -36)], camo: 0xcdd4da, perchColor: 0x8d969e };
}

function city(ctx: Ctx): MapBuild {
  const spawns: SpawnPoint[] = [];
  ground(ctx, "asphalt", 26, { rough: 0.34, metal: 0.42, tint: 0xc2cad8 });
  skyDome(ctx.scene, 0x04040a, 0x2a1a3a, ctx);
  celestial(ctx.scene, 0xdbe6ff, [45, 38, -168], 6.5, ctx);
  const texA = windowTexture("#ffd89a", "#0d0f18", "#1f2230", 0.35, 4, 8);
  const texB = windowTexture("#9ad8ff", "#0b0e16", "#191c28", 0.3, 5, 10);
  // road + sidewalks
  box(ctx, 80, 0.15, 3, 0, 0.07, -26, 0x2a2a33);
  box(ctx, 80, 0.15, 3, 0, 0.07, -40, 0x2a2a33);
  for (let i = 0; i < 14; i += 1) box(ctx, 1.6, 0.02, 0.18, -26 + i * 4, 0.02, -33, mat(0xd8c070, 0.6), false);

  // rooftop buildings (mid-row)
  building(ctx, 7, 8, 6, -13, -46, texA, 0x3a3d4a, true, spawns, 0x2a2c36);
  building(ctx, 6, 11, 6, -4, -48, texB, 0x333745, true, spawns, 0x2a2c36);
  building(ctx, 8, 7, 6, 6, -46, texA, 0x3d3a48, true, spawns, 0x2a2c36);
  building(ctx, 6, 9.5, 6, 15, -45, texB, 0x363a48, true, spawns, 0x2a2c36);
  building(ctx, 5, 6, 5, -17, -22, texA, 0x3a3a46, true, spawns, 0x2a2c36);
  building(ctx, 5, 5, 5, 18, -21, texB, 0x3a3a46, true, spawns, 0x2a2c36);
  // skyline
  for (let i = 0; i < 16; i += 1) {
    const h = 18 + ctx.rng() * 34;
    building(ctx, 7 + ctx.rng() * 6, h, 8, -52 + i * 7 + ctx.rng() * 3, -72 - ctx.rng() * 20, i % 2 ? texA : texB, 0x2b2e3b, true);
  }
  // neon signs
  const neon = [0xff3fa4, 0x33e6ff, 0xffd23f, 0x9d5cff];
  for (let i = 0; i < 8; i += 1) {
    const color = neon[i % neon.length];
    const x = -16 + i * 4.6;
    const y = 3 + ctx.rng() * 3;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8 + ctx.rng(), 0.6, 0.1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 }));
    sign.position.set(x, y, -42.9);
    ctx.scene.add(sign);
    const light = new THREE.PointLight(color, 10, 10, 2);
    light.position.set(x, y, -41.5);
    ctx.scene.add(light);
  }
  // cars
  const carColors = [0x8a1f2a, 0x1f3f8a, 0xdadada, 0x222222, 0xd9a330];
  for (let i = 0; i < 7; i += 1) {
    const x = -20 + i * 6.5 + ctx.rng() * 2;
    const z = i % 2 ? -31 : -35;
    box(ctx, 3.8, 0.8, 1.7, x, 0.55, z, mat(carColors[i % 5], 0.3, 0.6));
    box(ctx, 2, 0.6, 1.5, x - 0.2, 1.25, z, mat(0x0d1018, 0.1, 0.8));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 1.3), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff2a2a : 0xfff4d0 }));
    tail.position.set(x + (i % 2 ? 1.92 : -1.92), 0.7, z);
    ctx.scene.add(tail);
  }
  for (let i = 0; i < 6; i += 1) lamp(ctx, -18 + i * 7.5, -24.4, 0xffc78a, 5, 12);
  rubble(ctx, -9, -31, 6, 4);
  rubble(ctx, 11, -42, 5, 4);
  debris(ctx, -14, -36, 7, 0x4a4c55);
  debris(ctx, 4, -43, 6, 0x3f4148);
  barrel(ctx, -20, -28, 0x4a5a6a);
  tire(ctx, 18, -34, 2);
  pallet(ctx, -19, -43);
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0.85 });
  for (const [px, pz, r] of [[-8, -29, 2.4], [6, -36, 1.8], [-16, -40, 2.2], [13, -30, 1.6]] as const) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, 0.012, pz);
    ctx.scene.add(p);
  }
  // billboard
  box(ctx, 0.2, 5, 0.2, 10, 2.5, -24, 0x333333);
  const bb = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 0.15), new THREE.MeshStandardMaterial({ color: 0x33e6ff, emissive: 0x1a8aa8, emissiveIntensity: 2 }));
  bb.position.set(10, 6, -24);
  ctx.scene.add(bb);
  ctx.solids.push(bb);

  for (const [x, z, r] of [[-6, -27, 3], [4, -27.5, 3], [-12, -38, 2.5], [2, -39.5, 3.5], [12, -39, 2.5], [-2, -33, 3], [9, -33, 2.5], [-15, -30, 2]] as const) {
    spawns.push({ pos: new THREE.Vector3(x, 0.15, z), range: r, elevated: false });
  }
  let flicker = 0;
  return {
    spawns,
    vipPath: [new THREE.Vector3(-22, 0.15, -39.5), new THREE.Vector3(22, 0.15, -39.5)],
    camo: 0x2a2a30,
    perchColor: 0x2d2f38,
    update: (time) => {
      flicker = Math.sin(time * 23) > 0.96 ? 0.3 : 3;
      bb.material.emissiveIntensity = flicker;
    },
  };
}

function harbor(ctx: Ctx): MapBuild {
  const spawns: SpawnPoint[] = [];
  skyDome(ctx.scene, 0x2c2748, 0xe08a6a, ctx);
  celestial(ctx.scene, 0xffc49a, [-70, 14, -170], 9, ctx);
  // dock concrete
  const dockMat = texMat("dock", () => ({ map: groundTexture("concrete", 30, 18), rough: 0.85, bump: 0.16, color: 0xc8c8cc }));
  const dock = new THREE.Mesh(new THREE.BoxGeometry(120, 2, 70), dockMat);
  dock.position.set(0, -1, -17);
  dock.receiveShadow = true;
  ctx.scene.add(dock);
  ctx.solids.push(dock);
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x1c3248,
    roughness: 0.14,
    metalness: 0.75,
    bumpMap: waterBumpTexture(16, 12),
    bumpScale: 0.12,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -1.2, -150);
  ctx.scene.add(sea);
  ctx.solids.push(sea);
  box(ctx, 120, 0.1, 0.4, 0, 0.05, -51.8, 0xd9b43a, false);

  const colors = [0xb23a2b, 0x2b5fa3, 0x3f8a4a, 0xd9a13b, 0x7a3b8a, 0x2f7f86, 0x9a4b2a];
  const stack = (x: number, z: number, levels: number, rot = 0) => {
    for (let l = 0; l < levels; l += 1) {
      const hue = colors[Math.floor(ctx.rng() * colors.length)];
      const c = box(
        ctx,
        6,
        2.6,
        2.5,
        x,
        1.3 + l * 2.6,
        z,
        texMat(`container-${hue}`, () => ({ map: containerTexture(css(hue), 2, 1), rough: 0.72, metal: 0.35, bump: 0.2 })),
        true,
        rot,
      );
      for (let r = -2; r <= 2; r += 1) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 2.55), mat(0x000000, 1));
        rib.material = (c.material as THREE.MeshStandardMaterial);
        rib.position.set(r * 1.2, 0, 0);
        rib.scale.set(1, 0.98, 1.02);
        c.add(rib);
      }
    }
    if (rot === 0) spawns.push({ pos: new THREE.Vector3(x, levels * 2.6, z + 0.6), range: 2.2, elevated: true });
  };
  stack(-12, -28, 2);
  stack(-12, -31, 1);
  stack(-2, -44, 3);
  stack(7, -30, 1);
  stack(9, -40, 2);
  stack(16, -26, 2);
  stack(-18, -44, 2);
  stack(18, -46, 1);
  stack(-5, -24, 1, 0.3);

  // cranes
  for (const [x, z] of [[-14, -54], [12, -55]] as const) {
    for (const dx of [-2, 2]) box(ctx, 0.5, 18, 0.5, x + dx, 9, z, 0xd9a13b);
    box(ctx, 5, 0.6, 0.6, x, 17, z, 0xd9a13b);
    box(ctx, 0.8, 0.8, 26, x, 18, z - 4, 0xd9a13b);
    box(ctx, 2.5, 2, 2.5, x, 16, z + 2, 0x3a3a3a);
    cyl(ctx, 0.03, 0.03, 10, x, 13, z - 14, 0x222222, 4, false);
  }
  // ship
  box(ctx, 44, 7, 11, 2, 2, -66, 0x6b1f1f);
  box(ctx, 44, 0.3, 11, 2, 5.6, -66, 0x4a4a4a);
  building(ctx, 8, 7, 8, 18, -66, windowTexture("#ffd89a", "#1a1a1a", "#dadada", 0.4, 4, 4), 0xe5e5e5, true);
  const shipDeck = 5.75;
  spawns.push({ pos: new THREE.Vector3(-8, shipDeck, -61), range: 4, elevated: true });
  spawns.push({ pos: new THREE.Vector3(6, shipDeck, -61), range: 3, elevated: true });
  // lighthouse
  cyl(ctx, 1.4, 2.2, 22, -60, 10, -130, 0xe8e8e8, 12, false);
  const beacon = new THREE.PointLight(0xfff2c0, 60, 60, 2);
  beacon.position.set(-60, 22, -128);
  ctx.scene.add(beacon);
  for (let i = 0; i < 10; i += 1) cyl(ctx, 0.2, 0.25, 0.6, -24 + i * 5, 0.3, -51, 0x2b2b2b, 8);
  lamp(ctx, -6, -36, 0xffb070, 6, 14);
  lamp(ctx, 12, -34, 0xffb070, 6, 14);
  // forklift
  const fork = texMat("forklift", () => ({ map: metalTexture("#d9a13b", 1, 1, true), rough: 0.5, metal: 0.5 }));
  box(ctx, 1.4, 1.2, 2.2, 2, 0.6, -35, fork);
  box(ctx, 1.2, 1, 1, 2, 1.7, -35.4, 0x222222);
  // yard clutter
  barrel(ctx, -20, -30, 0x2f5a4a);
  barrel(ctx, -19.4, -30.8, 0x8a4a2a);
  barrel(ctx, 15, -24, 0x3a4a6a);
  pallet(ctx, 4, -30);
  pallet(ctx, 4.2, -31.4);
  pallet(ctx, -14, -36);
  tire(ctx, -8, -46, 3);
  tire(ctx, 20, -30, 2);
  debris(ctx, 9, -28, 6, 0x7a7a80);
  debris(ctx, -17, -48, 7, 0x6e6e74);
  rubble(ctx, 3, -44, 7, 5);
  crate(ctx, 19.5, -52, 0.9);
  crate(ctx, 18.8, -51.2, 0.7, 0.6);

  for (const [x, z, r] of [[-4, -30, 3], [3, -34, 3], [-8, -38, 2], [13, -34, 2], [-10, -48, 3], [4, -49, 4], [-16, -36, 2], [18, -38, 2]] as const) {
    spawns.push({ pos: new THREE.Vector3(x, 0, z), range: r, elevated: false });
  }
  let beam = 0;
  return {
    spawns,
    vipPath: [new THREE.Vector3(-24, 0, -49), new THREE.Vector3(20, 0, -49)],
    camo: 0x2f3a4a,
    perchColor: 0x4a4a52,
    update: (time) => {
      beam = Math.max(0, Math.sin(time * 1.2)) * 80;
      beacon.intensity = beam;
    },
  };
}

export function buildMap(def: MapDef, scene: THREE.Scene, solids: THREE.Object3D[], rng: () => number, high: boolean): MapBuild {
  const ctx: Ctx = { scene, solids, rng, high, windows: [], lamps: [], dome: null, celestialDisc: null, celestialHalo: null };
  let built: MapBuild;
  switch (def.id) {
    case "desert":
      built = desert(ctx);
      break;
    case "snow":
      built = snow(ctx);
      break;
    case "city":
      built = city(ctx);
      break;
    case "harbor":
      built = harbor(ctx);
      break;
    default:
      built = marsh(ctx);
      break;
  }

  // Ensure every map has a sky dome and celestial disc ready for Din / Shaam / Raat
  if (!ctx.dome) skyDome(scene, def.sky, def.fog, ctx);
  if (!ctx.celestialDisc) celestial(scene, 0xfff2c8, [-35, 32, -165], 7, ctx);

  // Starfield for Raat & Shaam
  const starCount = high ? 900 : 450;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = rng() * Math.PI * 2;
    const phi = rng() * Math.PI * 0.44;
    const r = 188;
    starPositions[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    starPositions[i * 3 + 1] = Math.cos(phi) * r + 6;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    const tint = i % 5 === 0 ? new THREE.Color(0xbad6ff) : i % 7 === 0 ? new THREE.Color(0xffe1b8) : new THREE.Color(0xffffff);
    starColors[i * 3] = tint.r;
    starColors[i * 3 + 1] = tint.g;
    starColors[i * 3 + 2] = tint.b;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 1.35,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.raycast = () => undefined;
  scene.add(stars);

  // Drifting volumetric cloud layer for Din & Shaam
  const clouds: THREE.Sprite[] = [];
  const cTex = cloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cTex,
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    fog: false,
    depthWrite: false,
  });
  for (let i = 0; i < 16; i += 1) {
    const sp = new THREE.Sprite(cloudMat);
    sp.position.set(-135 + i * 19 + (rng() - 0.5) * 10, 38 + rng() * 26, -125 - rng() * 45);
    sp.scale.set(42 + rng() * 28, 13 + rng() * 9, 1);
    sp.raycast = () => undefined;
    scene.add(sp);
    clouds.push(sp);
  }

  const prevUpdate = built.update;
  built.update = (time: number) => {
    prevUpdate?.(time);
    for (let i = 0; i < clouds.length; i += 1) {
      const c = clouds[i];
      c.position.x = ((((c.position.x + 150 + 0.015) % 300) + 300) % 300) - 150;
    }
  };

  built.applyTimePreset = (preset: TimePreset) => {
    if (ctx.dome) updateDomeColors(ctx.dome, preset.skyTop, preset.skyHorizon);
    if (ctx.celestialDisc && ctx.celestialHalo) {
      const [sx, sy, sz] = preset.sunPos;
      const distScale = 4.2;
      ctx.celestialDisc.position.set(sx * distScale, Math.max(14, sy * 1.9), sz * 3.1);
      ctx.celestialDisc.scale.setScalar(preset.celestialSize);
      const discMat = ctx.celestialDisc.material as THREE.MeshBasicMaterial;
      discMat.color.setHex(preset.celestialColor);
      discMat.map = preset.isNight ? moonTexture() : null;
      discMat.needsUpdate = true;

      ctx.celestialHalo.position.copy(ctx.celestialDisc.position);
      ctx.celestialHalo.scale.set(preset.celestialSize * (preset.isNight ? 5.5 : 8.5), preset.celestialSize * (preset.isNight ? 5.5 : 8.5), 1);
      ctx.celestialHalo.material.color.setHex(preset.celestialColor);
      ctx.celestialHalo.material.opacity = preset.isNight ? 0.28 : 0.45;
    }
    starMat.opacity = preset.starOpacity;
    cloudMat.opacity = preset.cloudOpacity;
    cloudMat.color.setHex(preset.cloudColor);

    for (const wMat of ctx.windows) {
      wMat.emissiveIntensity = preset.windowGlow;
    }
    for (const l of ctx.lamps) {
      const active = preset.lampIntensity > 0;
      l.light.intensity = active ? (l.baseIntensity * preset.lampIntensity) / 14 : 0;
      l.bulb.visible = active;
      l.cone.visible = active;
      (l.cone.material as THREE.MeshBasicMaterial).opacity = preset.isNight ? 0.09 : 0.045;
    }
  };

  return built;
}

export function buildPerch(scene: THREE.Scene, color: number, high: boolean) {
  const group = new THREE.Group();
  const m = texMat(`perch-${color}`, () => ({ map: metalTexture(css(color), 3, 1), rough: 0.9, bump: 0.25 }));
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 1.2), m);
  ledge.position.set(0, 3.55, 10.4);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5, 3.6, 0.6), m);
  wall.position.set(0, 1.8, 10.7);
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 0.8), m);
  pillarL.position.set(-2.9, 5, 10.6);
  const pillarR = pillarL.clone();
  pillarR.position.x = 2.9;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.6, 0.9), m);
  lintel.position.set(0, 6.8, 10.6);
  for (const mesh of [ledge, wall, pillarL, pillarR, lintel]) {
    mesh.castShadow = high;
    mesh.receiveShadow = true;
    mesh.userData.ignoreShot = true;
    group.add(mesh);
  }
  const bag = texMat("perch-bags", () => ({ map: fabricTexture("#6b5d45", 2, 2), rough: 1, bump: 0.12 }));
  for (let i = 0; i < 5; i += 1) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 3, 6), bag);
    b.rotation.z = Math.PI / 2;
    b.position.set(-1.6 + i * 0.8, 3.85, 10.2);
    group.add(b);
  }
  // camo netting draped over the firing position
  const netMat = new THREE.MeshStandardMaterial({
    map: camoTexture(["#3f4636", "#5a6349", "#2d3327", "#6b7359"], `net-${color}`, false, 4, 3),
    roughness: 0.98,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), netMat);
    net.position.set(side * 2.9, 6.2, 10.5);
    net.rotation.y = Math.PI / 2;
    net.rotation.z = side * 0.12;
    net.raycast = () => undefined;
    group.add(net);
  }
  const topNet = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), netMat);
  topNet.position.set(0, 7.05, 10.4);
  topNet.rotation.x = Math.PI / 2;
  topNet.raycast = () => undefined;
  group.add(topNet);
  scene.add(group);
  return group;
}
