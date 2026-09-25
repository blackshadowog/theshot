import * as THREE from "three";
import type { GunDef } from "./data";
import { camoTexture, fabricTexture, faceBumpTexture, faceTexture, metalTexture, polymerTexture, woodTexture } from "./textures";

export type CharacterKind = "soldier" | "heavy" | "vip" | "civilian" | "hostage" | "boss";

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  rifle: THREE.Group | null;
  muzzle: THREE.Object3D | null;
  flash: THREE.Sprite | null;
  parts: THREE.Mesh[];
  materials: THREE.MeshStandardMaterial[];
}

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
const shade = (hex: number, amount: number) => new THREE.Color(hex).lerp(new THREE.Color(amount < 0 ? 0x000000 : 0xffffff), Math.abs(amount)).getHex();

let glowTexture: THREE.Texture | null = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,240,200,0.8)");
  grad.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const SKINS: Array<{ base: string; hair: string; eyes: string }> = [
  { base: "#c99a78", hair: "#2a1c12", eyes: "#4a3421" },
  { base: "#a8765a", hair: "#161210", eyes: "#2f2313" },
  { base: "#7b5039", hair: "#120f0d", eyes: "#3a2a14" },
  { base: "#e0b894", hair: "#7a5228", eyes: "#4c6a7a" },
  { base: "#5e3b29", hair: "#0f0c0a", eyes: "#33240f" },
  { base: "#d8ad8a", hair: "#4a4238", eyes: "#3a4a3a" },
];

const CIVILIAN_CLOTHING: Array<{ shirt: number; pants: number; cap: number }> = [
  { shirt: 0xe4e0d4, pants: 0x2f4468, cap: 0x8a4a3a },
  { shirt: 0x4f7fb8, pants: 0x8a8172, cap: 0x2a2a2a },
  { shirt: 0xb8483f, pants: 0x3a3a3a, cap: 0xd9a441 },
  { shirt: 0xd9a441, pants: 0x44553a, cap: 0x6a4a2a },
  { shirt: 0x6fa36b, pants: 0x4a4a52, cap: 0x2a3a5a },
  { shirt: 0x9a5fb0, pants: 0x2a2a30, cap: 0xe4e0d4 },
];

export function buildCharacter(kind: CharacterKind, id: number, camo: number): CharacterRig {
  const root = new THREE.Group();
  const parts: THREE.Mesh[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const track = (m: THREE.MeshStandardMaterial) => {
    if (!materials.includes(m)) materials.push(m);
    return m;
  };
  const plain = (color: number, rough = 0.85, metal = 0) => {
    const key = `p${color}-${rough}-${metal}`;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      matCache.set(key, m);
      track(m);
    }
    return m;
  };
  const textured = (key: string, tex: THREE.Texture, color = 0xffffff, rough = 0.86, metal = 0) => {
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: tex, color, roughness: rough, metalness: metal });
      matCache.set(key, m);
      track(m);
    }
    return m;
  };

  const skin = SKINS[id % SKINS.length];
  const civilian = CIVILIAN_CLOTHING[id % CIVILIAN_CLOTHING.length];
  const armoured = kind === "heavy" || kind === "boss";
  const plainClothes = kind === "civilian" || kind === "vip" || kind === "hostage";
  const pixel = kind === "soldier" || armoured;
  const camoLight = shade(camo, 0.22);
  const camoDark = shade(camo, -0.34);
  const camoPalette = pixel
    ? [css(camoDark), css(shade(camo, -0.12)), css(shade(camo, 0.3)), css(shade(camo, 0.05))]
    : [css(camoDark), css(camo), css(camoLight)];
  const camoTex = camoTexture(camoPalette, `${kind}-${camo.toString(16)}-${pixel}`, pixel, 2, 2);
  const pantsTex = fabricTexture(css(shade(camo, -0.28)), 2, 2);
  const topMat =
    kind === "civilian"
      ? plain(civilian.shirt, 0.8)
      : kind === "hostage"
        ? textured("hostage-suit", fabricTexture("#d9621e", 2, 2), 0xffffff, 0.9)
        : kind === "boss"
          ? textured("boss-top", camoTexture(["#141418", "#26262c", "#3a1414", "#1d1d22"], "boss", true, 2, 2), 0xffffff, 0.8)
          : textured(`top${camo}`, camoTex, 0xffffff, 0.9);
  const pantsMat =
    kind === "civilian"
      ? plain(civilian.pants, 0.85)
      : kind === "hostage"
        ? textured("hostage-suit-b", fabricTexture("#c4561a", 2, 2), 0xffffff, 0.9)
        : kind === "boss"
          ? plain(0x17171b, 0.8)
          : textured(`pants${camo}`, pantsTex, 0xffffff, 0.92);
  const vestMat = kind === "vip" ? plain(0x1b1b24, 0.55) : textured(`vest${camo}`, camoTex, 0x8f8f8f, 0.8);
  const gearMat = plain(0x2a2d27, 0.8);
  const faceOpts = {
    skin: skin.base,
    hair: skin.hair,
    beard: kind === "boss" ? 0.92 : kind === "heavy" ? 0.85 : kind === "vip" ? 0.25 : id % 3 === 0 ? 0.78 : id % 5 === 0 ? 0.42 : 0,
    mask: kind === "soldier" && id % 4 === 1 ? "#22261f" : undefined,
    goggles: kind === "heavy",
    paint: kind === "boss" ? "#6a1212" : kind === "heavy" ? "#2b3a2a" : kind === "soldier" && id % 3 === 2 ? "#3a2a1c" : undefined,
    scar: kind === "boss" || id % 4 === 2,
    eyes: skin.eyes,
  };
  const skinMat = textured(`face-${id}-${kind}`, faceTexture(faceOpts), 0xffffff, 0.7, 0.02);
  skinMat.bumpMap = faceBumpTexture(faceOpts);
  skinMat.bumpScale = 0.018;
  const hairMat = plain(new THREE.Color(skin.hair).getHex(), 0.95);
  const metalMat = textured("gear-metal", metalTexture("#2a2d30", 1, 1), 0xffffff, 0.45, 0.7);
  const bootMat = plain(0x191a17, 0.95);
  const gloveMat = plainClothes ? plain(new THREE.Color(skin.base).getHex(), 0.8) : textured(`glove${camo}`, camoTex, 0x7a7a7a, 0.9);
  // Unlit glowing parts are deliberately NOT tracked so thermal vision never overrides them
  const glowRed = new THREE.MeshBasicMaterial({ color: 0xff2a1a });

  const add = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
    part: "body" | "head" = "body",
  ) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.enemyId = id;
    mesh.userData.part = part;
    parent.add(mesh);
    parts.push(mesh);
    return mesh;
  };

  const bulk = kind === "boss" ? 1.3 : kind === "heavy" ? 1.16 : 1;
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);

  // ---- torso ----
  add(hips, new THREE.CapsuleGeometry(0.2 * bulk, 0.42, 4, 12), topMat, [0, 0.32, 0]);
  if (kind === "boss") {
    // Warlord juggernaut plate carrier with glowing red trim and oversized pauldrons
    add(hips, new THREE.BoxGeometry(0.62, 0.56, 0.44), plain(0x1c1d22, 0.45, 0.6), [0, 0.34, 0.01]);
    add(hips, new THREE.BoxGeometry(0.36, 0.26, 0.08), plain(0x2c2e35, 0.35, 0.75), [0, 0.36, 0.25]);
    add(hips, new THREE.BoxGeometry(0.38, 0.025, 0.02), glowRed, [0, 0.5, 0.29]);
    add(hips, new THREE.BoxGeometry(0.025, 0.2, 0.02), glowRed, [0, 0.34, 0.3]);
    for (const side of [-1, 1]) {
      const pad = add(hips, new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI / 1.7), plain(0x24252b, 0.4, 0.65), [side * 0.31, 0.55, 0]);
      pad.rotation.z = -side * 0.4;
      add(hips, new THREE.BoxGeometry(0.12, 0.02, 0.2), glowRed, [side * 0.36, 0.58, 0.02]).rotation.z = -side * 0.4;
      add(hips, new THREE.BoxGeometry(0.15, 0.15, 0.1), plain(0x191a1e), [side * 0.15, 0.14, 0.26]);
    }
    add(hips, new THREE.BoxGeometry(0.56, 0.42, 0.3), plain(0x202127, 0.6, 0.3), [0, 0.38, -0.3]);
    add(hips, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), plain(0x3a3b40, 0.4, 0.7), [0.2, 0.75, -0.34]);
  } else if (kind === "hostage") {
    // Zip-tied wrists and a rope around the torso
    add(hips, new THREE.TorusGeometry(0.21, 0.018, 6, 18), plain(0x8a7550, 0.95), [0, 0.3, 0]).rotation.x = Math.PI / 2;
    add(hips, new THREE.TorusGeometry(0.2, 0.018, 6, 18), plain(0x8a7550, 0.95), [0, 0.46, 0]).rotation.x = Math.PI / 2;
  } else if (kind === "heavy") {
    add(hips, new THREE.BoxGeometry(0.54, 0.5, 0.38), plain(0x22262a, 0.6, 0.35), [0, 0.34, 0.01]);
    add(hips, new THREE.BoxGeometry(0.3, 0.22, 0.1), plain(0x2d3238, 0.5, 0.55), [0, 0.3, 0.2]);
    add(hips, new THREE.BoxGeometry(0.16, 0.13, 0.09), plain(0x1a1d20), [-0.14, 0.16, 0.22]);
    add(hips, new THREE.BoxGeometry(0.16, 0.13, 0.09), plain(0x1a1d20), [0.14, 0.16, 0.22]);
    add(hips, new THREE.BoxGeometry(0.5, 0.36, 0.24), plain(0x2a2f31, 0.7), [0, 0.36, -0.24]);
    for (const side of [-1, 1]) add(hips, new THREE.SphereGeometry(0.13, 10, 8), plain(0x272c30, 0.5, 0.4), [side * 0.24, 0.5, 0]);
  } else if (kind === "vip") {
    add(hips, new THREE.BoxGeometry(0.14, 0.36, 0.03), plain(0xececec, 0.6), [0, 0.46, 0.2]);
    add(hips, new THREE.BoxGeometry(0.06, 0.3, 0.035), plain(0xa81f2a, 0.5), [0, 0.44, 0.215]);
    add(hips, new THREE.BoxGeometry(0.36, 0.5, 0.02), plain(0x15151c, 0.6), [0, 0.16, 0.2]);
    add(hips, new THREE.BoxGeometry(0.28, 0.16, 0.1), plain(0x2a2a30, 0.5), [0.32, 0.1, 0.08]);
  } else if (kind === "soldier") {
    add(hips, new THREE.BoxGeometry(0.46, 0.4, 0.32), vestMat, [0, 0.36, 0.01]);
    for (const dx of [-0.15, 0.15]) {
      add(hips, new THREE.BoxGeometry(0.14, 0.16, 0.09), gearMat, [dx, 0.28, 0.2]);
      add(hips, new THREE.BoxGeometry(0.14, 0.12, 0.08), gearMat, [dx, 0.47, 0.2]);
    }
    add(hips, new THREE.BoxGeometry(0.09, 0.14, 0.06), plain(0x3a2f22), [-0.2, 0.16, 0.2]);
    add(hips, new THREE.BoxGeometry(0.24, 0.3, 0.16), gearMat, [0, 0.36, -0.24]);
    add(hips, new THREE.BoxGeometry(0.05, 0.2, 0.05), metalMat, [0.2, 0.52, -0.12]);
    add(hips, new THREE.BoxGeometry(0.07, 0.07, 0.05), plain(0x1b1d1a), [0.2, 0.63, -0.12]);
  } else {
    add(hips, new THREE.BoxGeometry(0.34, 0.3, 0.14), plain(shade(civilian.shirt, -0.12), 0.85), [0, 0.32, 0.16]);
  }

  // ---- head (sculpted cranium, jaw, brow ridge, nose bridge, cheekbones & ears) ----
  const headY = 0.8;
  const skinHex = new THREE.Color(skin.base).getHex();
  const skinPlain = plain(skinHex, 0.74, 0.02);
  add(hips, new THREE.CylinderGeometry(0.064, 0.078, 0.12, 12), skinPlain, [0, 0.64, 0]);
  // Tactical shemagh / collar wrap at base of neck
  if (kind !== "civilian" && kind !== "hostage") {
    const collarColor = kind === "vip" ? 0x22222c : shade(camo, -0.18);
    add(hips, new THREE.TorusGeometry(0.088, 0.028, 8, 16), plain(collarColor, 0.9), [0, 0.61, 0.01]).rotation.x = Math.PI / 2 + 0.15;
  }

  // Cranium with HD face texture (u=0.25 sits on +Z)
  const cranium = add(hips, new THREE.SphereGeometry(0.154, 28, 20), skinMat, [0, headY, 0.008], "head");
  cranium.scale.set(0.96, 1.05, 1.0);

  // Sculpted jawline & chin
  const jaw = add(hips, new THREE.SphereGeometry(0.118, 16, 12), faceOpts.mask ? plain(0x22261f, 0.9) : skinPlain, [0, headY - 0.058, 0.028], "head");
  jaw.scale.set(0.92, 0.78, 0.95);

  // 3D Brow ridge & cheekbones for realistic light/shadow relief
  const brow = add(hips, new THREE.BoxGeometry(0.16, 0.024, 0.05), skinPlain, [0, headY + 0.026, 0.128], "head");
  brow.rotation.x = 0.12;
  for (const side of [-1, 1]) {
    // 3D Eyebrow strip
    const eb = add(hips, new THREE.BoxGeometry(0.052, 0.013, 0.018), hairMat, [side * 0.044, headY + 0.032, 0.15], "head");
    eb.rotation.z = -side * 0.08;
    // Cheekbone
    const cheek = add(hips, new THREE.SphereGeometry(0.042, 10, 8), skinPlain, [side * 0.068, headY - 0.022, 0.112], "head");
    cheek.scale.set(1.1, 0.75, 0.8);
    // Detailed Ear + outer helix
    add(hips, new THREE.SphereGeometry(0.034, 10, 8), skinPlain, [side * 0.148, headY - 0.01, -0.005], "head").scale.set(0.48, 1.15, 0.82);
  }

  // Sculpted nose bridge + tip
  const noseBridge = add(hips, new THREE.BoxGeometry(0.026, 0.055, 0.045), skinPlain, [0, headY - 0.004, 0.146], "head");
  noseBridge.rotation.x = -0.22;
  const noseTip = add(hips, new THREE.SphereGeometry(0.021, 10, 8), skinPlain, [0, headY - 0.026, 0.165], "head");
  noseTip.scale.set(1.1, 0.85, 1.1);

  // 3D beard / moustache geometry when not wearing a balaclava
  if (!faceOpts.mask && faceOpts.beard >= 0.4) {
    const beard = add(hips, new THREE.SphereGeometry(0.126, 16, 12, 0, Math.PI * 2, Math.PI / 2.05, Math.PI / 2.2), hairMat, [0, headY - 0.012, 0.024], "head");
    beard.scale.set(0.95, 1.16, 1.02);
    const stache = add(hips, new THREE.BoxGeometry(0.068, 0.016, 0.024), hairMat, [0, headY - 0.045, 0.152], "head");
    stache.rotation.x = 0.15;
  }

  // Tactical comms earcup + boom mic on soldiers & heavies
  if (kind === "soldier" || armoured) {
    for (const side of [-1, 1]) {
      add(hips, new THREE.CylinderGeometry(0.042, 0.042, 0.026, 12), gearMat, [side * 0.155, headY - 0.006, -0.005], "head").rotation.z = Math.PI / 2;
    }
    add(hips, new THREE.BoxGeometry(0.008, 0.008, 0.11), metalMat, [-0.12, headY - 0.045, 0.075], "head").rotation.y = -0.45;
  }

  if (kind === "soldier") {
    const helmetMat = textured(`helmet${camo}`, camoTex, 0xbfbfbf, 0.85);
    add(hips, new THREE.SphereGeometry(0.176, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.75), helmetMat, [0, headY + 0.015, -0.008], "head");
    add(hips, new THREE.TorusGeometry(0.172, 0.016, 6, 20, Math.PI * 1.1), helmetMat, [0, headY + 0.01, -0.02], "head").rotation.set(Math.PI / 2, 0, 0.3);
    if (id % 2 === 0) {
      add(hips, new THREE.BoxGeometry(0.07, 0.05, 0.09), gearMat, [0.06, headY + 0.13, 0.06], "head");
      add(hips, new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), metalMat, [0.06, headY + 0.13, 0.13], "head").rotation.x = Math.PI / 2;
    }
    add(hips, new THREE.BoxGeometry(0.012, 0.14, 0.012), gearMat, [-0.1, headY - 0.06, 0.05], "head");
    add(hips, new THREE.BoxGeometry(0.012, 0.14, 0.012), gearMat, [0.1, headY - 0.06, 0.05], "head");
  } else if (kind === "heavy") {
    add(hips, new THREE.SphereGeometry(0.196, 18, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), plain(0x24282c, 0.5, 0.45), [0, headY + 0.02, -0.01], "head");
    add(hips, new THREE.BoxGeometry(0.34, 0.05, 0.16), plain(0x1b1f22, 0.4, 0.5), [0, headY + 0.02, 0.09], "head");
    for (const dx of [-0.08, 0.08]) {
      const lens = add(hips, new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0x1c3b45, metalness: 0.8, roughness: 0.1, emissive: 0x0a2229 }), [dx, headY - 0.01, 0.13], "head");
      track(lens.material as THREE.MeshStandardMaterial);
      lens.scale.set(1, 0.75, 0.5);
    }
    add(hips, new THREE.BoxGeometry(0.07, 0.06, 0.1), gearMat, [0, headY + 0.16, 0.05], "head");
    add(hips, new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), metalMat, [0, headY + 0.17, 0.13], "head").rotation.x = Math.PI / 2;
    add(hips, new THREE.BoxGeometry(0.014, 0.16, 0.014), gearMat, [-0.11, headY - 0.07, 0.04], "head");
    add(hips, new THREE.BoxGeometry(0.014, 0.16, 0.014), gearMat, [0.11, headY - 0.07, 0.04], "head");
  } else if (kind === "boss") {
    // Full armoured helm with a glowing red visor slit and a crest ridge
    add(hips, new THREE.SphereGeometry(0.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 1.65), plain(0x1a1b20, 0.35, 0.7), [0, headY + 0.02, -0.01], "head");
    add(hips, new THREE.BoxGeometry(0.3, 0.075, 0.12), plain(0x121316, 0.3, 0.8), [0, headY + 0.005, 0.12], "head");
    add(hips, new THREE.BoxGeometry(0.24, 0.024, 0.02), glowRed, [0, headY + 0.01, 0.182], "head");
    add(hips, new THREE.BoxGeometry(0.035, 0.07, 0.34), plain(0x2a2b31, 0.4, 0.7), [0, headY + 0.2, -0.02], "head");
    for (const side of [-1, 1]) add(hips, new THREE.ConeGeometry(0.03, 0.12, 6), plain(0x2a2b31, 0.4, 0.7), [side * 0.13, headY + 0.17, -0.02], "head").rotation.z = -side * 0.5;
  } else if (kind === "hostage") {
    // Burlap sack hood tied at the neck
    const sack = add(hips, new THREE.SphereGeometry(0.168, 16, 12), textured("hostage-sack", fabricTexture("#9c8358", 3, 3), 0xffffff, 1), [0, headY + 0.01, 0.008], "head");
    sack.scale.set(1, 1.08, 1);
    add(hips, new THREE.TorusGeometry(0.085, 0.016, 6, 14), plain(0x6a5838, 0.95), [0, headY - 0.13, 0.01], "head").rotation.x = Math.PI / 2;
  } else if (kind === "vip") {
    add(hips, new THREE.SphereGeometry(0.16, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), plain(0x6c2026, 0.9), [0, headY + 0.05, 0], "head");
    add(hips, new THREE.CylinderGeometry(0.135, 0.145, 0.05, 14), plain(0x8e2a30, 0.9), [0, headY + 0.1, 0], "head");
    add(hips, new THREE.BoxGeometry(0.2, 0.045, 0.035), plain(0x0a0a0c, 0.2, 0.6), [0, headY - 0.01, 0.135], "head");
    add(hips, new THREE.BoxGeometry(0.05, 0.02, 0.02), plain(0xa81f2a), [0, headY + 0.03, 0.15], "head");
  } else {
    add(hips, new THREE.SphereGeometry(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), plain(id % 2 ? civilian.cap : shade(civilian.shirt, -0.35), 0.9), [0, headY + 0.03, -0.005], "head");
    add(hips, new THREE.CylinderGeometry(0.15, 0.152, 0.04, 14), plain(shade(id % 2 ? civilian.cap : civilian.shirt, -0.2), 0.9), [0, headY + 0.055, 0.05], "head").rotation.x = 0.16;
    if (id % 3 === 0) add(hips, new THREE.BoxGeometry(0.3, 0.2, 0.03), plain(0x9a8fb0, 0.95), [0, headY - 0.04, -0.13], "head").rotation.z = 0.2;
  }

  // ---- arms ----
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27 * bulk, 0.56, 0);
    hips.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(0.068 * bulk, 0.36, 4, 10), plainClothes || kind === "boss" ? topMat : textured(`sleeve${camo}`, camoTex, 0xffffff, 0.9), [0, -0.24, 0]);
    for (const band of [-0.34, -0.18]) add(pivot, new THREE.CylinderGeometry(0.07 * bulk, 0.07 * bulk, 0.022, 10), gearMat, [0, band, 0]);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);
  add(armL, new THREE.SphereGeometry(0.062, 10, 8), gloveMat, [0, -0.5, 0.01]);
  add(armR, new THREE.SphereGeometry(0.062, 10, 8), gloveMat, [0, -0.5, 0.01]);
  if (kind === "vip") add(armR, new THREE.BoxGeometry(0.26, 0.2, 0.08), plain(0x2a2118, 0.5), [0.05, -0.6, 0.02]);

  // ---- legs ----
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.11 * bulk, 0.95, 0);
    root.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(0.086 * bulk, 0.44, 4, 10), pantsMat, [0, -0.32, 0]);
    add(pivot, new THREE.CapsuleGeometry(0.074, 0.24, 4, 8), pantsMat, [0, -0.72, 0]);
    add(pivot, new THREE.BoxGeometry(0.135, 0.1, 0.28), bootMat, [0, -0.9, 0.05]);
    add(pivot, new THREE.BoxGeometry(0.14, 0.03, 0.3), plain(0x0d0e0c), [0, -0.945, 0.05]);
    add(pivot, new THREE.BoxGeometry(0.05, 0.2, 0.05), gearMat, [0, -0.62, -0.14]);
    if (armoured) add(pivot, new THREE.BoxGeometry(0.2, 0.24, 0.16), plain(kind === "boss" ? 0x1f2026 : 0x272b2f, 0.5, 0.45), [0, -0.4, 0.03]);
    if (kind === "soldier") add(pivot, new THREE.BoxGeometry(0.17, 0.14, 0.16), gearMat, [0, -0.3, 0.07]);
    return pivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ---- weapon in hands ----
  let rifle: THREE.Group | null = null;
  let muzzle: THREE.Object3D | null = null;
  let flash: THREE.Sprite | null = null;
  if (kind === "soldier" || armoured) {
    rifle = new THREE.Group();
    rifle.position.set(0.08, 0.36, 0.3);
    hips.add(rifle);
    const gunMetal = textured("npc-metal", metalTexture("#181a1c", 1, 1, true), 0xffffff, 0.4, 0.75);
    const gunBody = plain(kind === "boss" ? 0x1a1b1f : kind === "heavy" ? 0x2b2e28 : 0x333830, 0.6, 0.3);
    if (kind === "boss") {
      // Anti-materiel rifle: long barrel, big optic with glowing laser emitter
      add(rifle, new THREE.CylinderGeometry(0.02, 0.022, 0.7, 8), gunMetal, [0, 0.02, 0.85]).rotation.x = Math.PI / 2;
      add(rifle, new THREE.BoxGeometry(0.06, 0.05, 0.1), gunMetal, [0, 0.02, 1.2]);
      add(rifle, new THREE.CylinderGeometry(0.04, 0.04, 0.34, 12), gunMetal, [0, 0.13, 0.08]).rotation.x = Math.PI / 2;
      add(rifle, new THREE.SphereGeometry(0.022, 8, 6), glowRed, [0.05, 0.05, 0.3]);
    }
    add(rifle, new THREE.BoxGeometry(0.055, 0.1, 0.6), gunBody, [0, 0, 0.05]);
    add(rifle, new THREE.BoxGeometry(0.05, 0.14, 0.06), gunBody, [0, -0.11, 0.06]);
    add(rifle, new THREE.BoxGeometry(0.048, 0.05, 0.16), gunMetal, [0, -0.08, -0.02]);
    add(rifle, new THREE.CylinderGeometry(0.015, 0.017, 0.18, 8), gunMetal, [0, 0.02, 0.32]).rotation.x = Math.PI / 2;
    add(rifle, new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8), gunMetal, [0, 0.02, 0.5]).rotation.x = Math.PI / 2;
    add(rifle, new THREE.CylinderGeometry(0.028, 0.028, 0.12, 10), gunMetal, [0, 0.02, 0.64]).rotation.x = Math.PI / 2;
    add(rifle, new THREE.CylinderGeometry(0.026, 0.026, 0.2, 10), gunMetal, [0, 0.1, 0.0]).rotation.x = Math.PI / 2;
    add(rifle, new THREE.BoxGeometry(0.04, 0.07, 0.03), gunMetal, [0, 0.05, 0.02]);
    add(rifle, new THREE.BoxGeometry(0.06, 0.09, 0.2), gunBody, [0, -0.03, 0.4]);
    muzzle = new THREE.Object3D();
    muzzle.position.set(kind === "boss" ? 0.05 : 0, kind === "boss" ? 0.05 : 0.02, kind === "boss" ? 1.26 : 0.72);
    rifle.add(muzzle);
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffb35c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    flash.scale.set(0.95, 0.95, 0.95);
    flash.visible = false;
    muzzle.add(flash);
    armL.rotation.set(-1.2, 0, 0.35);
    armR.rotation.set(-0.9, 0, -0.1);
  }
  if (kind === "vip") {
    armL.rotation.set(-0.3, 0, 0.12);
    armR.rotation.set(-0.35, 0, -0.1);
  }

  if (kind === "hostage") {
    // hands tied behind the back
    armL.rotation.set(0.55, 0, 0.28);
    armR.rotation.set(0.55, 0, -0.28);
  }
  if (kind === "heavy") root.scale.setScalar(1.06);
  if (kind === "boss") root.scale.setScalar(1.14);
  return { root, hips, legL, legR, armL, armR, rifle, muzzle, flash, parts, materials };
}

export function buildGunModel(gun: GunDef) {
  const group = new THREE.Group();
  const spec = gun.model;
  const metalTex = metalTexture(css(spec.metal), 1, 1, true);
  const accentTex = metalTexture(css(spec.accent), 1, 1);
  const bodyTex = spec.wood ? woodTexture(css(spec.body), 1, 1) : polymerTexture(css(spec.body), 1, 1);
  const body = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: spec.wood ? 0.72 : 0.55, metalness: spec.wood ? 0.05 : 0.28 });
  const accent = new THREE.MeshStandardMaterial({ map: accentTex, roughness: 0.45, metalness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.34, metalness: 0.88 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c5a72, roughness: 0.05, metalness: 0.95, emissive: 0x0a1c26 });
  const glow = new THREE.MeshStandardMaterial({ color: spec.accent, emissive: spec.accent, emissiveIntensity: 2.2, roughness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.95 });

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const R = Math.PI / 2;

  // receiver + rails + ejection port
  add(new THREE.BoxGeometry(0.075, 0.09, 0.42), spec.wood ? body : metal, 0, 0, 0);
  add(new THREE.BoxGeometry(0.062, 0.03, 0.4), spec.stock === "future" ? glow : accent, 0, 0.055, 0);
  for (let i = 0; i < 9; i += 1) add(new THREE.BoxGeometry(0.032, 0.008, 0.012), metal, 0, 0.075, -0.19 + i * 0.045);
  add(new THREE.BoxGeometry(0.02, 0.03, 0.1), metal, 0.04, 0.01, 0.06);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), metal, 0.055, -0.02, 0.05).rotation.z = 0.5;

  // handguard with vent slots
  const guardLen = 0.42 + spec.barrel * 0.15;
  add(new THREE.BoxGeometry(0.07, 0.075, guardLen), body, 0, -0.005, -0.21 - guardLen / 2);
  for (let i = 0; i < 5; i += 1) add(new THREE.BoxGeometry(0.076, 0.016, 0.022), metal, 0, 0.012, -0.28 - i * (guardLen / 6) - guardLen / 4);

  // barrel
  const barrelLen = spec.barrel * 0.62;
  const barrelStart = -0.21 - guardLen;
  add(new THREE.CylinderGeometry(0.014, 0.017, barrelLen, 10), metal, 0, 0.005, barrelStart - barrelLen / 2 + 0.1, R);
  let tip = barrelStart - barrelLen + 0.1;
  if (spec.suppressor) {
    add(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 16), rubber, 0, 0.005, tip - 0.1, R);
    for (let i = 0; i < 5; i += 1) add(new THREE.TorusGeometry(0.032, 0.0035, 5, 14), metal, 0, 0.005, tip - 0.02 - i * 0.06);
    tip -= 0.26;
  }
  if (spec.muzzleBrake) {
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), metal, 0, 0.005, tip - 0.05, R);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.012, 0.05, 0.06), metal, s * 0.028, 0.005, tip - 0.04);
    tip -= 0.1;
  }
  if (spec.stock === "future") {
    for (let i = 0; i < 4; i += 1) add(new THREE.TorusGeometry(0.03, 0.007, 6, 16), glow, 0, 0.005, barrelStart - 0.05 - i * 0.1);
    add(new THREE.BoxGeometry(0.078, 0.012, 0.36), glow, 0, -0.022, 0);
    add(new THREE.BoxGeometry(0.03, 0.03, 0.06), metal, 0, 0.07, -0.02);
  }

  // grip, trigger, magazine, bolt
  const grip = add(new THREE.BoxGeometry(0.05, 0.14, 0.06), rubber, 0, -0.1, 0.13);
  grip.rotation.x = -0.35;
  for (let i = 0; i < 3; i += 1) add(new THREE.BoxGeometry(0.052, 0.012, 0.058), body, 0, -0.07 - i * 0.035, 0.128 - i * 0.012);
  add(new THREE.TorusGeometry(0.03, 0.006, 4, 10, Math.PI), metal, 0, -0.055, 0.06, Math.PI);
  const magH = gun.magSize > 6 ? 0.17 : 0.095;
  add(new THREE.BoxGeometry(0.05, magH, 0.1), metal, 0, -0.045 - magH / 2, -0.06);
  add(new THREE.BoxGeometry(0.055, 0.014, 0.104), accent, 0, -0.045 - magH, -0.06);
  if (gun.magSize > 6) add(new THREE.BoxGeometry(0.052, 0.02, 0.104), metal, 0, -0.09, -0.06);

  // stock variants
  if (spec.stock === "classic") {
    const s = add(new THREE.BoxGeometry(0.065, 0.13, 0.42), body, 0, -0.035, 0.42);
    s.rotation.x = 0.08;
    add(new THREE.BoxGeometry(0.07, 0.15, 0.03), rubber, 0, -0.05, 0.64);
    add(new THREE.BoxGeometry(0.05, 0.04, 0.2), accent, 0, 0.04, 0.38);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), metal, 0.035, -0.05, 0.3).rotation.z = R;
  } else if (spec.stock === "skeleton") {
    add(new THREE.BoxGeometry(0.03, 0.025, 0.4), metal, 0, 0.02, 0.42);
    add(new THREE.BoxGeometry(0.03, 0.025, 0.36), metal, 0, -0.08, 0.42).rotation.x = -0.12;
    add(new THREE.BoxGeometry(0.06, 0.15, 0.03), rubber, 0, -0.03, 0.62);
    add(new THREE.BoxGeometry(0.05, 0.035, 0.16), body, 0, 0.045, 0.4);
  } else if (spec.stock === "bullpup") {
    add(new THREE.BoxGeometry(0.08, 0.16, 0.46), body, 0, -0.03, 0.43);
    add(new THREE.BoxGeometry(0.07, 0.05, 0.25), accent, 0, 0.07, 0.42);
    add(new THREE.BoxGeometry(0.084, 0.05, 0.12), rubber, 0, -0.13, 0.55);
  } else if (spec.stock === "heavy") {
    add(new THREE.BoxGeometry(0.095, 0.16, 0.5), body, 0, -0.02, 0.45);
    add(new THREE.BoxGeometry(0.1, 0.18, 0.05), rubber, 0, -0.03, 0.71);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6), metal, 0, -0.16, 0.6);
    add(new THREE.BoxGeometry(0.1, 0.03, 0.46), metal, 0, 0.065, -0.05);
    add(new THREE.BoxGeometry(0.11, 0.05, 0.18), metal, 0, -0.11, 0.5);
  } else if (spec.stock === "thumbhole") {
    add(new THREE.BoxGeometry(0.07, 0.035, 0.34), body, 0, 0.05, 0.4);
    add(new THREE.BoxGeometry(0.07, 0.035, 0.3), body, 0, -0.11, 0.4).rotation.x = 0.16;
    add(new THREE.BoxGeometry(0.07, 0.2, 0.035), body, 0, -0.03, 0.6);
    add(new THREE.BoxGeometry(0.075, 0.22, 0.04), rubber, 0, -0.02, 0.64);
    add(new THREE.BoxGeometry(0.08, 0.06, 0.2), accent, 0, 0.07, 0.34);
  } else if (spec.stock === "lmg") {
    add(new THREE.BoxGeometry(0.1, 0.17, 0.52), body, 0, -0.02, 0.46);
    add(new THREE.BoxGeometry(0.105, 0.2, 0.05), rubber, 0, -0.03, 0.74);
    add(new THREE.BoxGeometry(0.1, 0.03, 0.5), metal, 0, 0.07, -0.02);
    for (const dx of [-0.04, 0.04]) add(new THREE.BoxGeometry(0.014, 0.06, 0.014), metal, dx, 0.11, -0.16);
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.11, 14), metal, 0, -0.13, -0.12).rotation.z = R;
    add(new THREE.BoxGeometry(0.11, 0.05, 0.26), body, 0, -0.02, 0.42);
  } else {
    add(new THREE.BoxGeometry(0.07, 0.14, 0.44), body, 0, -0.03, 0.43);
    add(new THREE.BoxGeometry(0.072, 0.012, 0.44), glow, 0, 0.045, 0.43);
    add(new THREE.BoxGeometry(0.08, 0.17, 0.035), rubber, 0, -0.04, 0.66);
  }
  if (spec.cased) add(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), accent, 0.075, -0.03, 0.02).rotation.z = 0.3;

  // optic
  const scopeY = 0.12;
  const len = spec.scopeLen;
  add(new THREE.CylinderGeometry(0.024, 0.024, len, 16), metal, 0, scopeY, -0.02, R);
  add(new THREE.CylinderGeometry(0.042, 0.026, 0.12, 16), metal, 0, scopeY, -0.02 - len / 2 - 0.05, R);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), glass, 0, scopeY, -0.02 - len / 2 - 0.115, R);
  add(new THREE.CylinderGeometry(0.03, 0.024, 0.08, 16), metal, 0, scopeY, -0.02 + len / 2 + 0.03, R);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 16), glass, 0, scopeY, -0.02 + len / 2 + 0.07, R);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), accent, 0, scopeY + 0.035, -0.02);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), accent, 0.035, scopeY, -0.02).rotation.z = R;
  for (const z of [-len / 3, len / 3]) {
    add(new THREE.BoxGeometry(0.035, 0.075, 0.03), metal, 0, 0.07, z - 0.02);
    add(new THREE.BoxGeometry(0.04, 0.02, 0.035), metal, 0, 0.04, z - 0.02);
  }

  if (spec.bipod) {
    for (const side of [-1, 1]) {
      const leg = add(new THREE.CylinderGeometry(0.007, 0.007, 0.3, 6), metal, side * 0.03, -0.06, barrelStart + 0.16, R);
      leg.rotation.z = side * 0.1;
      add(new THREE.BoxGeometry(0.03, 0.012, 0.03), rubber, side * 0.055, -0.2, barrelStart + 0.16);
    }
  }
  // sling loops
  for (const z of [0.5, -0.3]) add(new THREE.TorusGeometry(0.014, 0.004, 4, 8), metal, 0.045, -0.06, z);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.005, tip - 0.04);
  group.add(muzzle);
  return { group, muzzle, length: 0.7 - tip };
}
