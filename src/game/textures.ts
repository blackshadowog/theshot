import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function finish(c: HTMLCanvasElement, key: string, rx = 1, ry = 1, srgb = true) {
  const existing = cache.get(key);
  if (existing) return existing;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

export function disposeTemporaryTextures() {
  cache.forEach((t) => {
    if (t.userData.temporary) t.dispose();
  });
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[], size: [number, number]) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    const s = size[0] + Math.random() * (size[1] - size[0]);
    g.fillRect(Math.random() * w, Math.random() * h, s, s * (0.6 + Math.random() * 0.8));
  }
}

function blotches(g: CanvasRenderingContext2D, w: number, h: number, count: number, colors: string[], min: number, max: number) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    g.beginPath();
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = min + Math.random() * (max - min);
    for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 5) {
      const rr = r * (0.6 + Math.random() * 0.6);
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.75;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
}

// ---------------------------------------------------------------- high-detail faces
export interface FaceOptions {
  skin: string;
  hair: string;
  beard: number;
  mask?: string;
  goggles?: boolean;
  paint?: string;
  scar?: boolean;
  eyes?: string;
}

export function faceTexture(opts: FaceOptions) {
  const key = `face-hd-${JSON.stringify(opts)}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const W = 512;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  g.fillStyle = opts.skin;
  g.fillRect(0, 0, W, H);

  // Subtle subsurface warmth (cheeks, nose, ears) + cranial ambient occlusion
  const cx = 128; // u = 0.25 (+Z front of sphere)
  const warmGrad = g.createRadialGradient(cx, 134, 8, cx, 134, 82);
  warmGrad.addColorStop(0, "rgba(215,75,55,0.18)");
  warmGrad.addColorStop(0.6, "rgba(195,70,50,0.08)");
  warmGrad.addColorStop(1, "rgba(195,70,50,0)");
  g.fillStyle = warmGrad;
  g.fillRect(0, 0, W, H);

  // Wrap-around head shading
  const sideGrad = g.createLinearGradient(0, 0, W, 0);
  sideGrad.addColorStop(0, "rgba(0,0,0,0.48)");
  sideGrad.addColorStop(0.12, "rgba(0,0,0,0.06)");
  sideGrad.addColorStop(0.25, "rgba(255,235,215,0.08)");
  sideGrad.addColorStop(0.38, "rgba(0,0,0,0.06)");
  sideGrad.addColorStop(0.75, "rgba(0,0,0,0.22)");
  sideGrad.addColorStop(1, "rgba(0,0,0,0.52)");
  g.fillStyle = sideGrad;
  g.fillRect(0, 0, W, H);

  // Forehead highlight & jaw shadow
  const vertGrad = g.createLinearGradient(0, 0, 0, H);
  vertGrad.addColorStop(0, "rgba(0,0,0,0.35)");
  vertGrad.addColorStop(0.28, "rgba(255,240,220,0.16)");
  vertGrad.addColorStop(0.65, "rgba(0,0,0,0)");
  vertGrad.addColorStop(0.82, "rgba(80,35,25,0.18)");
  vertGrad.addColorStop(1, "rgba(25,12,8,0.45)");
  g.fillStyle = vertGrad;
  g.fillRect(0, 0, W, H);

  // Micro skin pores & natural complexion variation
  speckle(g, W, H, 1400, ["rgba(60,30,20,0.06)", "rgba(255,230,210,0.06)", "rgba(140,65,45,0.05)"], [1, 2.2]);

  // Forehead expression creases
  g.strokeStyle = "rgba(70,35,22,0.22)";
  g.lineWidth = 1.4;
  for (const fy of [74, 82]) {
    g.beginPath();
    g.moveTo(cx - 28, fy);
    g.quadraticCurveTo(cx, fy - 3, cx + 28, fy);
    g.stroke();
  }
  // Glabella (frown lines between brows)
  g.beginPath();
  g.moveTo(cx - 4, 88);
  g.lineTo(cx - 3, 102);
  g.moveTo(cx + 4, 88);
  g.lineTo(cx + 3, 102);
  g.stroke();

  // Cheekbone highlights & cheek hollows
  for (const side of [-1, 1]) {
    const chGrad = g.createRadialGradient(cx + side * 32, 134, 2, cx + side * 32, 134, 22);
    chGrad.addColorStop(0, "rgba(255,235,215,0.22)");
    chGrad.addColorStop(0.6, "rgba(215,90,70,0.10)");
    chGrad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = chGrad;
    g.beginPath();
    g.arc(cx + side * 32, 134, 22, 0, Math.PI * 2);
    g.fill();

    // Nasolabial fold (smile/stern crease)
    g.strokeStyle = "rgba(65,30,20,0.32)";
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(cx + side * 11, 144);
    g.quadraticCurveTo(cx + side * 22, 160, cx + side * 18, 180);
    g.stroke();
  }

  // Eye sockets (orbital shadow)
  const eyeY = 114;
  for (const side of [-1, 1]) {
    const ex = cx + side * 23;
    const sock = g.createRadialGradient(ex, eyeY, 4, ex, eyeY, 20);
    sock.addColorStop(0, "rgba(45,20,14,0.38)");
    sock.addColorStop(0.7, "rgba(55,25,18,0.18)");
    sock.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sock;
    g.beginPath();
    g.ellipse(ex, eyeY, 20, 14, 0, 0, Math.PI * 2);
    g.fill();

    // Sclera with soft corner shading
    g.fillStyle = "#f2ede4";
    g.beginPath();
    g.moveTo(ex - 15, eyeY + 1);
    g.quadraticCurveTo(ex, eyeY - 10, ex + 15, eyeY + 1);
    g.quadraticCurveTo(ex, eyeY + 9, ex - 15, eyeY + 1);
    g.closePath();
    g.fill();

    // Pink caruncle (inner tear duct)
    g.fillStyle = "rgba(195,95,85,0.7)";
    g.beginPath();
    g.arc(ex - side * 12.5, eyeY + 1, 2.2, 0, Math.PI * 2);
    g.fill();

    // Iris with limbal ring + radial fibres
    const ix = ex - side * 1.2;
    g.fillStyle = "#1a120c";
    g.beginPath();
    g.arc(ix, eyeY + 0.5, 7.2, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = opts.eyes ?? "#4a3622";
    g.beginPath();
    g.arc(ix, eyeY + 0.5, 6.1, 0, Math.PI * 2);
    g.fill();

    // Radial iris striations
    g.strokeStyle = "rgba(255,220,170,0.22)";
    g.lineWidth = 0.8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      g.beginPath();
      g.moveTo(ix + Math.cos(a) * 2.2, eyeY + 0.5 + Math.sin(a) * 2.2);
      g.lineTo(ix + Math.cos(a) * 5.8, eyeY + 0.5 + Math.sin(a) * 5.8);
      g.stroke();
    }

    // Pupil
    g.fillStyle = "#090705";
    g.beginPath();
    g.arc(ix, eyeY + 0.5, 3.1, 0, Math.PI * 2);
    g.fill();

    // Dual corneal catchlights
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.beginPath();
    g.arc(ix - 2.4, eyeY - 2, 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.arc(ix + 2.2, eyeY + 2.2, 0.9, 0, Math.PI * 2);
    g.fill();

    // Upper eyelid crease & lash line
    g.strokeStyle = "#1b100a";
    g.lineWidth = 3.0;
    g.beginPath();
    g.moveTo(ex - 15.5, eyeY + 1.2);
    g.quadraticCurveTo(ex, eyeY - 10.5, ex + 15.5, eyeY + 1.2);
    g.stroke();

    // Upper eyelid fold
    g.strokeStyle = "rgba(55,25,16,0.5)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(ex - 15, eyeY - 3);
    g.quadraticCurveTo(ex, eyeY - 14, ex + 15, eyeY - 3);
    g.stroke();

    // Lower lid rim & subtle under-eye bag
    g.strokeStyle = "rgba(110,55,42,0.45)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(ex - 14, eyeY + 2);
    g.quadraticCurveTo(ex, eyeY + 9.5, ex + 14, eyeY + 2);
    g.stroke();

    // Textured multi-stroke eyebrows
    g.strokeStyle = opts.hair;
    g.lineWidth = 5.5;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(ex - side * 16, eyeY - 14);
    g.quadraticCurveTo(ex, eyeY - 22, ex + side * 17, eyeY - 13);
    g.stroke();
    // Individual brow hairs
    g.lineWidth = 1.2;
    for (let b = -14; b <= 14; b += 2.5) {
      g.beginPath();
      g.moveTo(ex + b, eyeY - 14 - Math.cos((b / 15) * 1.2) * 5);
      g.lineTo(ex + b + side * 2.5, eyeY - 18 - Math.cos((b / 15) * 1.2) * 5);
      g.stroke();
    }
  }

  // Sculpted nose bridge, tip & nostrils
  const noseShade = g.createLinearGradient(cx - 12, 110, cx + 12, 110);
  noseShade.addColorStop(0, "rgba(65,32,20,0.35)");
  noseShade.addColorStop(0.38, "rgba(255,240,225,0.28)");
  noseShade.addColorStop(0.62, "rgba(255,240,225,0.22)");
  noseShade.addColorStop(1, "rgba(65,32,20,0.38)");
  g.fillStyle = noseShade;
  g.fillRect(cx - 10, 108, 20, 38);

  // Nose base & nostrils
  g.fillStyle = "rgba(60,26,16,0.42)";
  g.beginPath();
  g.ellipse(cx, 151, 13, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#220e08";
  g.beginPath();
  g.ellipse(cx - 5.8, 151, 3.6, 2.2, -0.25, 0, Math.PI * 2);
  g.ellipse(cx + 5.8, 151, 3.6, 2.2, 0.25, 0, Math.PI * 2);
  g.fill();
  // Nose tip highlight
  g.fillStyle = "rgba(255,240,225,0.35)";
  g.beginPath();
  g.arc(cx, 144, 4.5, 0, Math.PI * 2);
  g.fill();

  // Philtrum (groove above upper lip)
  g.strokeStyle = "rgba(70,32,22,0.28)";
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(cx - 3.5, 154);
  g.lineTo(cx - 4.5, 168);
  g.moveTo(cx + 3.5, 154);
  g.lineTo(cx + 4.5, 168);
  g.stroke();

  // Sculpted lips (upper lip darker, lower lip fuller with highlight)
  const mouthY = 175;
  // Upper lip
  g.fillStyle = "rgba(120,52,44,0.68)";
  g.beginPath();
  g.moveTo(cx - 19, mouthY);
  g.quadraticCurveTo(cx - 8, mouthY - 7, cx, mouthY - 4);
  g.quadraticCurveTo(cx + 8, mouthY - 7, cx + 19, mouthY);
  g.quadraticCurveTo(cx, mouthY + 2, cx - 19, mouthY);
  g.closePath();
  g.fill();

  // Lower lip
  g.fillStyle = "rgba(155,72,62,0.58)";
  g.beginPath();
  g.moveTo(cx - 18, mouthY);
  g.quadraticCurveTo(cx, mouthY + 12, cx + 18, mouthY);
  g.quadraticCurveTo(cx, mouthY + 2, cx - 18, mouthY);
  g.closePath();
  g.fill();

  // Lip parting line
  g.strokeStyle = "#2b110c";
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(cx - 20, mouthY);
  g.quadraticCurveTo(cx, mouthY + 3.2, cx + 20, mouthY);
  g.stroke();

  // Lower lip specular highlight
  g.strokeStyle = "rgba(255,225,210,0.38)";
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(cx - 9, mouthY + 4.5);
  g.quadraticCurveTo(cx, mouthY + 6.5, cx + 9, mouthY + 4.5);
  g.stroke();

  // Chin cleft & shadow under lower lip
  g.strokeStyle = "rgba(65,28,18,0.38)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 11, mouthY + 14);
  g.quadraticCurveTo(cx, mouthY + 18, cx + 11, mouthY + 14);
  g.stroke();

  // Painted ear detail at u = 0 and u = 0.5
  for (const ex of [4, 252]) {
    g.fillStyle = "rgba(95,42,30,0.4)";
    g.beginPath();
    g.ellipse(ex, eyeY + 8, 8, 18, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Camo war-paint stripes
  if (opts.paint) {
    g.save();
    g.globalAlpha = 0.68;
    g.fillStyle = opts.paint;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.roundRect(cx + side * 14 - (side < 0 ? 44 : 0), 124, 44, 7, 3);
      g.roundRect(cx + side * 14 - (side < 0 ? 40 : 0), 136, 40, 6.5, 3);
      g.fill();
    }
    // Nose bridge stripe
    g.fillRect(cx - 4, 112, 8, 28);
    g.restore();
  }

  // Realistic battle scar across cheek/brow
  if (opts.scar) {
    g.strokeStyle = "rgba(145,52,48,0.72)";
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(cx - 42, 96);
    g.lineTo(cx - 24, 152);
    g.stroke();
    g.strokeStyle = "rgba(255,220,205,0.48)";
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx - 40.5, 96);
    g.lineTo(cx - 22.5, 152);
    g.stroke();
    // Stitch marks
    g.strokeStyle = "rgba(95,35,30,0.5)";
    for (let t = 0.2; t <= 0.85; t += 0.2) {
      const sx = cx - 42 + 18 * t;
      const sy = 96 + 56 * t;
      g.beginPath();
      g.moveTo(sx - 3.5, sy - 1);
      g.lineTo(sx + 3.5, sy + 1);
      g.stroke();
    }
  }

  // Multi-layered beard, moustache & jaw stubble
  if (opts.beard > 0) {
    g.save();
    g.globalAlpha = Math.min(0.95, opts.beard);
    g.fillStyle = opts.hair;
    // Jaw & chin beard base
    g.beginPath();
    g.ellipse(cx, 222, 68, 52, 0, 0, Math.PI * 2);
    g.fill();
    // Moustache
    g.beginPath();
    g.moveTo(cx - 24, mouthY + 1);
    g.quadraticCurveTo(cx - 10, mouthY - 12, cx, mouthY - 7);
    g.quadraticCurveTo(cx + 10, mouthY - 12, cx + 24, mouthY + 1);
    g.quadraticCurveTo(cx, mouthY - 2, cx - 24, mouthY + 1);
    g.closePath();
    g.fill();
    // Soul patch
    g.beginPath();
    g.ellipse(cx, mouthY + 11, 5, 6, 0, 0, Math.PI * 2);
    g.fill();
    // Hundreds of individual hair strands for crisp close-up texture
    g.strokeStyle = opts.hair;
    g.lineWidth = 1.1;
    for (let i = 0; i < 420; i += 1) {
      const bx = cx + (Math.random() - 0.5) * 124;
      const by = 158 + Math.random() * 88;
      if (Math.hypot((bx - cx) * 0.85, by - 210) < 62) {
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + (Math.random() - 0.5) * 3, by + 4 + Math.random() * 5);
        g.stroke();
      }
    }
    g.restore();
  }

  // Hair cap across crown, temples & back of skull
  g.fillStyle = opts.hair;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, 130);
  g.lineTo(235, 110);
  g.lineTo(222, 66);
  for (let x = 220; x >= 36; x -= 12) {
    g.lineTo(x, 52 + Math.sin(x * 0.18) * 5);
  }
  g.lineTo(34, 66);
  g.lineTo(21, 110);
  g.lineTo(0, 130);
  g.closePath();
  g.fill();

  // Hair strand highlights
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 1.2;
  for (let i = 0; i < 240; i += 1) {
    const hx = Math.random() * W;
    const hy = Math.random() * 64;
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(hx + (Math.random() - 0.5) * 6, hy + 10);
    g.stroke();
  }

  // Ribbed tactical balaclava / mask
  if (opts.mask) {
    g.fillStyle = opts.mask;
    g.fillRect(0, 138, W, H - 138);
    // Knit rib texture
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 0; x < W; x += 5) g.fillRect(x, 138, 2, H - 138);
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 142; y < H; y += 7) g.fillRect(0, y, W, 2);
    // Nose bridge seam & hem
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, 138, W, 4);
    g.strokeStyle = "rgba(255,255,255,0.09)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx, 138);
    g.lineTo(cx, H);
    g.stroke();
  }

  // Goggles strap
  if (opts.goggles) {
    g.fillStyle = "#16191b";
    g.fillRect(0, 102, W, 16);
    g.fillStyle = "rgba(255,255,255,0.08)";
    g.fillRect(0, 104, W, 2);
  }

  return finish(c, key);
}

// Matching bump map for faces so brows, nose, lips, scars & beard catch real 3D light
export function faceBumpTexture(opts: FaceOptions) {
  const key = `face-bump-${Boolean(opts.beard)}-${Boolean(opts.mask)}-${Boolean(opts.scar)}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const W = 256;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, W, H);
  const cx = 64;

  // Skin pores micro-relief
  speckle(g, W, H, 900, ["#767676", "#8a8a8a"], [1, 1.8]);

  // Brow ridge & nose bridge elevation
  g.fillStyle = "#a8a8a8";
  g.fillRect(cx - 24, 44, 48, 6);
  g.fillRect(cx - 4, 50, 8, 22);
  // Eye sockets recessed
  g.fillStyle = "#5c5c5c";
  g.beginPath();
  g.ellipse(cx - 12, 57, 9, 6, 0, 0, Math.PI * 2);
  g.ellipse(cx + 12, 57, 9, 6, 0, 0, Math.PI * 2);
  g.fill();
  // Lips raised
  g.fillStyle = "#9e9e9e";
  g.beginPath();
  g.ellipse(cx, 88, 10, 4.5, 0, 0, Math.PI * 2);
  g.fill();

  if (opts.scar) {
    g.strokeStyle = "#484848";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 21, 48);
    g.lineTo(cx - 12, 76);
    g.stroke();
  }
  if (opts.beard > 0) {
    speckle(g, W, 50, 500, ["#606060", "#a6a6a6"], [1, 2.2]);
  }
  if (opts.mask) {
    for (let x = 0; x < W; x += 3) {
      g.fillStyle = x % 6 === 0 ? "#969696" : "#6c6c6c";
      g.fillRect(x, 69, 2, 59);
    }
  }
  return finish(c, key, 1, 1, false);
}

// ---------------------------------------------------------------- architectural & nature textures
export function buildingFacadeTexture(
  lit: string,
  dark: string,
  wall: string,
  litChance: number,
  cols = 4,
  rows = 8,
  style: "brick" | "stucco" | "concrete" | "glass" = "concrete",
) {
  const W = 256;
  const H = 512;
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);

  // Wall surface relief: courses, mortar, stucco or panels
  if (style === "brick") {
    for (let y = 0; y < H; y += 12) {
      g.fillStyle = "rgba(0,0,0,0.22)";
      g.fillRect(0, y, W, 1.5);
      const off = (y / 12) % 2 === 0 ? 0 : 12;
      for (let x = off; x < W; x += 24) {
        g.fillStyle = Math.random() > 0.5 ? "rgba(180,80,55,0.12)" : "rgba(0,0,0,0.10)";
        g.fillRect(x, y + 1.5, 22, 10.5);
      }
    }
  } else if (style === "stucco") {
    blotches(g, W, H, 65, ["rgba(255,235,200,0.10)", "rgba(90,60,30,0.12)"], 10, 38);
    speckle(g, W, H, 1400, ["rgba(0,0,0,0.12)", "rgba(255,245,220,0.12)"], [1, 2.5]);
  } else {
    for (let y = 0; y < H; y += 32) {
      g.fillStyle = "rgba(0,0,0,0.24)";
      g.fillRect(0, y, W, 2);
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(0, y + 2, W, 1.5);
    }
    for (let x = 0; x < W; x += 64) {
      g.fillStyle = "rgba(0,0,0,0.14)";
      g.fillRect(x, 0, 1.5, H);
    }
    speckle(g, W, H, 900, ["rgba(0,0,0,0.14)", "rgba(255,255,255,0.06)"], [1, 2.4]);
  }

  // Vertical weathering streaks & rooftop/ground grime gradient
  const grime = g.createLinearGradient(0, 0, 0, H);
  grime.addColorStop(0, "rgba(0,0,0,0.42)");
  grime.addColorStop(0.12, "rgba(0,0,0,0)");
  grime.addColorStop(0.82, "rgba(0,0,0,0)");
  grime.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = grime;
  g.fillRect(0, 0, W, H);

  // Separate emissive canvas so only lit windows glow at dusk/night!
  const ce = canvas(W, H);
  const ge = ce.getContext("2d")!;
  ge.fillStyle = "#000000";
  ge.fillRect(0, 0, W, H);

  const cw = W / cols;
  const rh = H / rows;
  for (let r = 0; r < rows; r += 1) {
    // Horizontal floor cornice
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(0, r * rh, W, 3);
    for (let col = 0; col < cols; col += 1) {
      const wx = col * cw + cw * 0.18;
      const wy = r * rh + rh * 0.22;
      const ww = cw * 0.64;
      const wh = rh * 0.54;
      const isLit = Math.random() < litChance;

      // Recessed window frame
      g.fillStyle = "rgba(10,12,16,0.85)";
      g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

      // Window glass pane
      if (isLit) {
        const wGrad = g.createLinearGradient(wx, wy, wx, wy + wh);
        wGrad.addColorStop(0, lit);
        wGrad.addColorStop(1, "#ff9d42");
        g.fillStyle = wGrad;
        ge.fillStyle = wGrad;
        ge.fillRect(wx, wy, ww, wh);
      } else {
        const dGrad = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        dGrad.addColorStop(0, dark);
        dGrad.addColorStop(0.5, "#1d2836");
        dGrad.addColorStop(1, dark);
        g.fillStyle = dGrad;
      }
      g.fillRect(wx, wy, ww, wh);

      // Window muntins / blinds
      g.fillStyle = "rgba(15,18,22,0.78)";
      g.fillRect(wx + ww * 0.48, wy, 2, wh);
      g.fillRect(wx, wy + wh * 0.46, ww, 2);

      // Stone window sill
      g.fillStyle = "rgba(210,205,195,0.32)";
      g.fillRect(wx - 4, wy + wh + 2, ww + 8, 4);

      // Occasional AC unit under window
      if ((r + col) % 3 === 0) {
        g.fillStyle = "rgba(70,74,78,0.85)";
        g.fillRect(wx + 2, wy + wh + 7, ww * 0.55, rh * 0.14);
        g.fillStyle = "rgba(20,22,25,0.75)";
        g.beginPath();
        g.arc(wx + 2 + ww * 0.2, wy + wh + 7 + rh * 0.07, rh * 0.045, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(ce);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 4;

  return { map, emissiveMap };
}

export function barkTexture(base = "#3b2d20", rx = 1, ry = 3) {
  const key = `bark-${base}-${rx}x${ry}`;
  const c = canvas(128, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 6) {
    g.fillStyle = x % 12 === 0 ? "rgba(0,0,0,0.38)" : "rgba(255,220,180,0.08)";
    g.fillRect(x + Math.sin(x) * 2, 0, 2.5, 256);
  }
  speckle(g, 128, 256, 500, ["rgba(0,0,0,0.22)", "rgba(90,110,70,0.12)"], [1.5, 3.5]);
  return finish(c, key, rx, ry);
}

export function foliageTexture(baseHex: number, snow = false) {
  const key = `foliage-${baseHex.toString(16)}-${snow}`;
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  const col = new THREE.Color(baseHex);
  g.fillStyle = `#${col.getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  const dark = `#${col.clone().multiplyScalar(0.65).getHexString()}`;
  const light = `#${col.clone().multiplyScalar(1.28).getHexString()}`;
  for (let i = 0; i < 420; i += 1) {
    g.strokeStyle = i % 2 === 0 ? dark : light;
    g.lineWidth = 1.6;
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 10, y + 6 + Math.random() * 6);
    g.stroke();
  }
  if (snow) blotches(g, 128, 128, 18, ["rgba(240,246,252,0.75)"], 6, 18);
  return finish(c, key, 2, 2);
}

export function rockTexture(baseHex: number, rx = 3, ry = 3) {
  const key = `rock-${baseHex.toString(16)}-${rx}x${ry}`;
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  const col = new THREE.Color(baseHex);
  g.fillStyle = `#${col.getHexString()}`;
  g.fillRect(0, 0, 256, 256);
  const d1 = `#${col.clone().multiplyScalar(0.72).getHexString()}`;
  const d2 = `#${col.clone().multiplyScalar(0.55).getHexString()}`;
  const l1 = `#${col.clone().multiplyScalar(1.22).getHexString()}`;
  blotches(g, 256, 256, 45, [d1, d2, l1], 10, 36);
  // Cracks & strata lines
  g.strokeStyle = "rgba(0,0,0,0.38)";
  for (let i = 0; i < 18; i += 1) {
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    let x = Math.random() * 256;
    let y = Math.random() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s += 1) {
      x += 18 + Math.random() * 24;
      y += (Math.random() - 0.5) * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  speckle(g, 256, 256, 800, ["rgba(0,0,0,0.18)", "rgba(255,255,255,0.10)"], [1, 2.8]);
  return finish(c, key, rx, ry);
}

export function waterBumpTexture(rx = 6, ry = 6) {
  const key = `water-bump-${rx}x${ry}`;
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 8) {
    g.strokeStyle = y % 16 === 0 ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)";
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      g.lineTo(x, y + Math.sin(x * 0.08 + y * 0.1) * 3.5);
    }
    g.stroke();
  }
  return finish(c, key, rx, ry, false);
}

export function moonTexture() {
  const key = "celestial-moon-hd";
  const existing = cache.get(key);
  if (existing) return existing;
  const c = canvas(256, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8e4d8";
  g.fillRect(0, 0, 256, 128);
  blotches(g, 256, 128, 28, ["rgba(110,115,125,0.32)", "rgba(85,90,100,0.25)", "rgba(255,252,242,0.3)"], 8, 28);
  for (let i = 0; i < 45; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 128;
    const r = 2 + Math.random() * 8;
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = "rgba(90,94,102,0.28)";
    g.fill();
  }
  return finish(c, key);
}

export function cloudTexture() {
  const key = "sky-cloud-puff";
  const existing = cache.get(key);
  if (existing) return existing;
  const c = canvas(256, 128);
  const g = c.getContext("2d")!;
  for (const [x, y, rx, ry, a] of [
    [128, 68, 90, 38, 0.55],
    [82, 72, 60, 28, 0.45],
    [174, 74, 62, 26, 0.45],
    [128, 54, 58, 28, 0.5],
  ] as const) {
    const grad = g.createRadialGradient(x, y, 4, x, y, rx);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${a * 0.45})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, key);
}

// ---------------------------------------------------------------- surfaces
export function camoTexture(colors: string[], key: string, pixel = false, rx = 1, ry = 1) {
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = colors[0];
  g.fillRect(0, 0, 128, 128);
  if (pixel) {
    for (let i = 0; i < 240; i += 1) {
      g.fillStyle = colors[1 + Math.floor(Math.random() * (colors.length - 1))];
      const s = 4 + Math.random() * 10;
      g.globalAlpha = 0.6 + Math.random() * 0.4;
      g.fillRect(Math.floor(Math.random() * 32) * 4, Math.floor(Math.random() * 32) * 4, s, s);
    }
    g.globalAlpha = 1;
  } else {
    blotches(g, 128, 128, 28, colors.slice(1), 6, 20);
    blotches(g, 128, 128, 14, [colors[0]], 4, 12);
  }
  // Ripstop fabric grid overlay
  g.fillStyle = "rgba(0,0,0,0.08)";
  for (let i = 0; i < 128; i += 4) {
    g.fillRect(i, 0, 1, 128);
    g.fillRect(0, i, 128, 1);
  }
  speckle(g, 128, 128, 500, ["rgba(0,0,0,0.10)", "rgba(255,255,255,0.05)"], [1, 2.4]);
  return finish(c, `camo-${key}`, rx, ry);
}

export type GroundKind = "marsh" | "sand" | "snow" | "asphalt" | "concrete";

export function groundTexture(kind: GroundKind, rx = 18, ry = 18) {
  const key = `ground-${kind}-${rx}x${ry}`;
  const c = canvas(256, 256);
  const g = c.getContext("2d")!;
  if (kind === "marsh") {
    g.fillStyle = "#1f2b1e";
    g.fillRect(0, 0, 256, 256);
    blotches(g, 256, 256, 48, ["#26341f", "#182215", "#2d3b25", "#332e21"], 10, 36);
    for (let i = 0; i < 320; i += 1) {
      g.strokeStyle = ["#3d5228", "#4a6230", "#33421f"][i % 3];
      g.lineWidth = 1.1;
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5) * 6, y - 4 - Math.random() * 8);
      g.stroke();
    }
    blotches(g, 256, 256, 14, ["#3b3427", "#2a2820"], 8, 22);
  } else if (kind === "sand") {
    g.fillStyle = "#c9a370";
    g.fillRect(0, 0, 256, 256);
    blotches(g, 256, 256, 36, ["#d4b283", "#bd9663", "#c99f6b"], 12, 40);
    for (let y = 0; y < 256; y += 5) {
      g.strokeStyle = y % 10 ? "rgba(255,235,200,0.14)" : "rgba(120,90,55,0.15)";
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin((x + y) * 0.05) * 2.6);
      g.stroke();
    }
    speckle(g, 256, 256, 450, ["rgba(255,240,215,0.35)", "rgba(140,110,70,0.3)"], [1, 2.2]);
  } else if (kind === "snow") {
    g.fillStyle = "#e9eef4";
    g.fillRect(0, 0, 256, 256);
    blotches(g, 256, 256, 38, ["#d6e0ea", "#f4f8fc", "#c2cfdc"], 12, 40);
    speckle(g, 256, 256, 520, ["rgba(255,255,255,0.8)", "rgba(150,175,200,0.22)"], [1, 2.6]);
    for (let i = 0; i < 80; i += 1) {
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
  } else if (kind === "asphalt") {
    g.fillStyle = "#191920";
    g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, 1100, ["rgba(255,255,255,0.08)", "rgba(120,130,150,0.10)", "rgba(0,0,0,0.32)"], [1, 2.6]);
    g.strokeStyle = "rgba(0,0,0,0.55)";
    for (let i = 0; i < 14; i += 1) {
      g.lineWidth = 1 + Math.random();
      g.beginPath();
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      g.moveTo(x, y);
      for (let s = 0; s < 5; s += 1) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    blotches(g, 256, 256, 10, ["rgba(40,44,60,0.35)", "rgba(90,70,50,0.2)"], 14, 36);
  } else {
    g.fillStyle = "#5a5b60";
    g.fillRect(0, 0, 256, 256);
    blotches(g, 256, 256, 30, ["#62636a", "#515258", "#6b6c72"], 14, 40);
    g.strokeStyle = "rgba(30,30,34,0.6)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 128);
    g.lineTo(256, 128);
    g.moveTo(128, 0);
    g.lineTo(128, 256);
    g.stroke();
    speckle(g, 256, 256, 620, ["rgba(255,255,255,0.07)", "rgba(0,0,0,0.18)", "rgba(120,90,60,0.14)"], [1, 3]);
  }
  speckle(g, 256, 256, 240, ["rgba(0,0,0,0.08)"], [1, 2]);
  return finish(c, key, rx, ry);
}

export function woodTexture(base = "#6b4e33", rx = 1, ry = 1) {
  const key = `wood-${base}-${rx}x${ry}`;
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.fillRect(0, y, 128, 2.4);
    g.fillStyle = "rgba(255,240,210,0.06)";
    g.fillRect(0, y + 2.4, 128, 1.4);
    for (let i = 0; i < 18; i += 1) {
      g.strokeStyle = Math.random() > 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,225,180,0.11)";
      g.lineWidth = 0.8 + Math.random();
      const ly = y + 4 + Math.random() * 26;
      g.beginPath();
      g.moveTo(0, ly);
      for (let x = 0; x <= 128; x += 16) g.lineTo(x, ly + Math.sin(x * 0.12 + y) * 1.8);
      g.stroke();
    }
    g.fillStyle = "rgba(60,38,22,0.5)";
    g.beginPath();
    g.ellipse(16 + Math.random() * 96, y + 8 + Math.random() * 18, 3, 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  speckle(g, 128, 128, 220, ["rgba(0,0,0,0.12)", "rgba(255,230,190,0.07)"], [1, 2]);
  return finish(c, key, rx, ry);
}

export function metalTexture(base: string, rx = 1, ry = 1, rivets = false) {
  const key = `metal-${base}-${rx}x${ry}-${rivets}`;
  const c = canvas(128, 128);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 380; i += 1) {
    g.strokeStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.15)";
    g.lineWidth = 0.7;
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 6 + Math.random() * 16, y + (Math.random() - 0.5) * 2);
    g.stroke();
  }
  blotches(g, 128, 128, 8, ["rgba(120,70,40,0.24)", "rgba(150,90,50,0.18)"], 4, 14);
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = 2;
  g.strokeRect(2, 2, 124, 124);
  if (rivets) {
    g.fillStyle = "rgba(230,230,230,0.38)";
    for (let i = 0; i < 8; i += 1) {
      g.beginPath();
      g.arc(8 + i * 16, 8, 2, 0, Math.PI * 2);
      g.arc(8 + i * 16, 120, 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(c, key, rx, ry);
}

export function containerTexture(color: string, rx = 2, ry = 4) {
  const key = `container-${color}-${rx}x${ry}`;
  const c = canvas(128, 256);
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 8) {
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.fillRect(x, 0, 2.2, 256);
    g.fillStyle = "rgba(255,255,255,0.09)";
    g.fillRect(x + 3, 0, 1.6, 256);
  }
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(0, 8, 128, 5);
  g.fillRect(0, 243, 128, 5);
  g.fillStyle = "rgba(255,255,255,0.06)";
  g.fillRect(0, 14, 128, 2);
  for (let i = 0; i < 30; i += 1) {
    g.fillStyle = "rgba(120,70,38,0.22)";
    const x = Math.random() * 128;
    const h = 20 + Math.random() * 90;
    g.fillRect(x, Math.random() * 140, 1.6 + Math.random() * 2.6, h);
  }
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.font = "bold 15px monospace";
  g.fillText(`DL-${Math.floor(1000 + Math.random() * 8999)}`, 10, 40);
  return finish(c, key, rx, ry);
}

export function fabricTexture(base: string, rx = 2, ry = 2) {
  const key = `fabric-${base}-${rx}x${ry}`;
  const c = canvas(64, 64);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  for (let i = -64; i < 64; i += 4) {
    g.strokeStyle = i % 8 === 0 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.12)";
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.moveTo(i + 64, 0);
    g.lineTo(i, 64);
    g.stroke();
  }
  speckle(g, 64, 64, 140, ["rgba(0,0,0,0.12)", "rgba(255,255,255,0.05)"], [1, 2]);
  return finish(c, key, rx, ry);
}

export function polymerTexture(base: string, rx = 1, ry = 1) {
  const key = `polymer-${base}-${rx}x${ry}`;
  const c = canvas(64, 64);
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  // Carbon-weave micro-pattern + stippling
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      g.fillStyle = (x + y) % 8 === 0 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.14)";
      g.fillRect(x, y, 2, 2);
    }
  }
  speckle(g, 64, 64, 260, ["rgba(0,0,0,0.18)", "rgba(255,255,255,0.05)"], [1, 1.6]);
  return finish(c, key, rx, ry);
}

export function hexToRgba(hex: number, alpha: number) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}
