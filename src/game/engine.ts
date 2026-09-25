import * as THREE from "three";
import { audio } from "./audio";
import { getTimePreset, type GunDef, type MapDef, type Mission, type TimeOfDay } from "./data";
import { buildMap, buildPerch, clearMapCache, type MapBuild } from "./maps";
import { buildCharacter, buildGunModel, getGlowTexture, type CharacterKind, type CharacterRig } from "./models";
import type { SaveData } from "./save";

export interface KillInfo {
  headshot: boolean;
  distance: number;
  kind: CharacterKind;
  multi: number;
  score: number;
}

export interface EndInfo {
  success: boolean;
  reason: string;
  health: number;
  timeUsed: number;
  rescued: number;
  bossKilled: boolean;
}

export interface BossTelemetry {
  hp: number;
  max: number;
  phase: number;
  lock: number;
  moving: boolean;
}

export interface EngineCallbacks {
  onAmmo: (mag: number, reserve: number, reloading: boolean) => void;
  onHealth: (hp: number, damaged: boolean) => void;
  onShot: (hits: number) => void;
  onKill: (info: KillInfo) => void;
  onArmorHit: (distance: number) => void;
  onAlert: () => void;
  onObjective: (remaining: number, total: number) => void;
  onToast: (message: string, tone?: "info" | "warn" | "good") => void;
  onKillcam: (active: boolean) => void;
  onEnd: (info: EndInfo) => void;
  onLockLost: () => void;
  onTimeOfDay?: (tod: TimeOfDay) => void;
  onBossHit?: (damage: number, headshot: boolean, brokeLock: boolean) => void;
  onBossPhase?: (phase: number) => void;
  onBossShot?: () => void;
  onExecutionAlert?: (seconds: number) => void;
}

export interface Telemetry {
  range: number | null;
  zoom: number;
  zoomIndex: number;
  scoped: boolean;
  breath: number;
  breathMax: number;
  holding: boolean;
  gasping: boolean;
  wind: number;
  timeLeft: number;
  slowmo: number;
  thermal: number;
  reloadProgress: number;
  targetKind: CharacterKind | null;
  fireReady: number;
  boss: BossTelemetry | null;
  hostagesAlive: number;
}

interface Enemy {
  id: number;
  kind: CharacterKind;
  rig: CharacterRig;
  health: number;
  alive: boolean;
  state: "patrol" | "idle" | "alert" | "dead" | "escaped" | "freed";
  role: "none" | "captor";
  maxHealth: number;
  phase: number;
  lockT: number;
  lockCooldown: number;
  moveFrom: THREE.Vector3 | null;
  moveTo: THREE.Vector3 | null;
  moveT: number;
  freedAt: number;
  home: THREE.Vector3;
  range: number;
  elevated: boolean;
  targetX: number;
  speed: number;
  idleTimer: number;
  alertDelay: number;
  fireTimer: number;
  walkPhase: number;
  deathTime: number;
  deathDir: number;
  stagger: number;
  pendingDeath: boolean;
  flashUntil: number;
  vipProgress: number;
}

interface Effect {
  mesh: THREE.Mesh | THREE.Line;
  life: number;
  max: number;
  grow: number;
}

const BASE_FOV = 68;
const CAMERA_POS = new THREE.Vector3(0, 4.35, 11.6);

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SniperEngine {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 420);
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private cb: EngineCallbacks;
  private map: MapDef;
  private mission: Mission;
  private gun: GunDef;
  private save: SaveData;
  private build: MapBuild;
  private solids: THREE.Object3D[] = [];
  private enemies: Enemy[] = [];
  private effects: Effect[] = [];
  private gunGroup: THREE.Group;
  private muzzle: THREE.Object3D;
  private muzzleLight: THREE.PointLight;
  private muzzleSprite: THREE.Sprite;
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private timeOfDay: TimeOfDay;
  private weather: THREE.Points | THREE.LineSegments | null = null;
  private weatherVel: Float32Array | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private disposed = false;

  private yaw = 0;
  private pitch = -0.07;
  private recoil = 0;
  private recoilYaw = 0;
  private shake = 0;
  private swayT = Math.random() * 10;
  private scoped = false;
  private scopeBlend = 0;
  private zoomIndex = 0;
  private breath = 100;
  private breathMax = 100;
  private holding = false;
  private gaspUntil = 0;
  private wind = 0;
  private windTarget = 0;

  private mag: number;
  private reserve: number;
  private reloading = false;
  private reloadStart = 0;
  private reloadDuration: number;
  private nextFire = 0;
  private health = 100;
  private timeLeft: number;
  private elapsed = 0;
  private paused = true;
  private started = false;
  private ended = false;
  private alerted = false;
  private slowmoUntil = 0;
  private thermalUntil = 0;
  private lastHeartbeat = 0;
  private rangeTimer = 0;
  private telemetry: Telemetry;
  private killcam: null | { from: THREE.Vector3; to: THREE.Vector3; enemy: Enemy; t: number; phase: "travel" | "impact"; bullet: THREE.Mesh; trail: THREE.Line; orbit: number } = null;
  private wasLocked = false;
  private touchLast: { x: number; y: number } | null = null;

  constructor(host: HTMLElement, map: MapDef, mission: Mission, gun: GunDef, save: SaveData, callbacks: EngineCallbacks, initialTime?: TimeOfDay) {
    this.host = host;
    this.map = map;
    this.mission = mission;
    this.gun = gun;
    this.save = save;
    this.cb = callbacks;
    this.timeOfDay = initialTime ?? mission.defaultTime;
    const high = save.settings.quality === "high";

    this.renderer = new THREE.WebGLRenderer({ antialias: high, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = map.exposure;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "world-canvas";
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.FogExp2(map.fog, map.fogDensity);
    this.hemiLight = new THREE.HemisphereLight(map.hemiSky, map.hemiGround, map.hemiIntensity);
    this.scene.add(this.hemiLight);
    const sun = new THREE.DirectionalLight(map.sunColor, map.sunIntensity);
    sun.position.set(...map.sunPos);
    sun.target.position.set(0, 0, -35);
    sun.castShadow = high;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0005;
    this.sunLight = sun;
    this.scene.add(sun, sun.target);

    const rng = mulberry(mission.index * 977 + 13);
    this.build = buildMap(map, this.scene, this.solids, rng, high);
    this.applyTimeOfDay(this.timeOfDay);
    const perch = buildPerch(this.scene, this.build.perchColor, high);
    perch.traverse((o) => {
      if (o instanceof THREE.Mesh) this.solids.push(o);
    });

    this.camera.position.copy(CAMERA_POS);
    this.scene.add(this.camera);
    const model = buildGunModel(gun);
    this.gunGroup = model.group;
    this.muzzle = model.muzzle;
    this.gunGroup.position.set(0.2, -0.2, -0.45);
    this.camera.add(this.gunGroup);
    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 6, 2);
    this.muzzle.add(this.muzzleLight);
    this.muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: gun.sound === "rail" ? 0x6fe6ff : 0xffb35c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.muzzleSprite.scale.set(0.35, 0.35, 0.35);
    this.muzzleSprite.visible = false;
    this.muzzle.add(this.muzzleSprite);
    this.camera.add(new THREE.PointLight(0xffffff, 0.6, 2));

    this.createBossLaser();
    this.spawnEnemies(rng);
    this.createWeather(high);

    const upgrades = save.upgrades;
    this.breathMax = 100 * (1 + upgrades.lungs * 0.3);
    this.breath = this.breathMax;
    this.reloadDuration = gun.reloadTime * (1 - upgrades.reload * 0.12);
    this.mag = gun.magSize;
    this.reserve = gun.reserve;
    this.timeLeft = mission.timeLimit;
    this.wind = (map.windRange[0] + rng() * (map.windRange[1] - map.windRange[0])) * (rng() > 0.5 ? 1 : -1);
    this.windTarget = this.wind;

    this.telemetry = {
      range: null,
      zoom: 1,
      zoomIndex: 0,
      scoped: false,
      breath: this.breath,
      breathMax: this.breathMax,
      holding: false,
      gasping: false,
      wind: this.wind,
      timeLeft: this.timeLeft,
      slowmo: 0,
      thermal: 0,
      reloadProgress: 0,
      targetKind: null,
      fireReady: 1,
      boss: null,
      hostagesAlive: this.mission.hostages ?? 0,
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.bindInput();
    this.cb.onAmmo(this.mag, this.reserve, false);
    this.cb.onHealth(this.health, false);
    this.emitObjective();
    this.frame = requestAnimationFrame(this.loop);
  }

  // ---------------- setup ----------------
  private spawnEnemies(rng: () => number) {
    const m = this.mission;
    const pool = [...this.build.spawns];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const elevated = pool.filter((s) => s.elevated);
    const groundPts = pool.filter((s) => !s.elevated);
    const kinds: CharacterKind[] = [];
    for (let i = 0; i < m.hostiles; i += 1) kinds.push(i < m.heavies ? "heavy" : "soldier");
    let id = 0;
    let eIdx = 0;
    let gIdx = 0;

    if (m.objective === "boss") {
      // Warlord takes a central ground position with room to relocate
      const spot = groundPts[gIdx++ % groundPts.length];
      const boss = this.addEnemy(id++, "boss", spot.pos.clone(), Math.max(1.5, spot.range), false, rng);
      boss.state = "alert";
      boss.lockCooldown = 5.5;
    }

    if (m.objective === "rescue") {
      const count = m.hostages ?? 1;
      for (let h = 0; h < count; h += 1) {
        const spot = groundPts[gIdx++ % groundPts.length];
        const base = spot.pos.clone();
        const hostage = this.addEnemy(id++, "hostage", base.clone(), 0, false, rng);
        hostage.state = "idle";
        for (const side of [-1, 1]) {
          const captor = this.addEnemy(id++, "soldier", base.clone().add(new THREE.Vector3(side * 1.05, 0, -0.45)), 0.5, false, rng);
          captor.role = "captor";
          captor.state = "idle";
        }
      }
    }

    kinds.forEach((kind, index) => {
      const useElevated = kind === "soldier" && index % 2 === 0 && eIdx < elevated.length;
      const spawn = useElevated ? elevated[eIdx++] : groundPts[gIdx++ % groundPts.length] ?? elevated[eIdx++ % elevated.length];
      const offset = !useElevated && gIdx > groundPts.length ? (rng() - 0.5) * 3 : 0;
      this.addEnemy(id++, kind, spawn.pos.clone().add(new THREE.Vector3(offset, 0, offset * 0.5)), spawn.range, spawn.elevated, rng);
    });
    for (let i = 0; i < m.civilians; i += 1) {
      const spawn = groundPts[(gIdx + i * 2) % groundPts.length];
      this.addEnemy(id++, "civilian", spawn.pos.clone().add(new THREE.Vector3((rng() - 0.5) * 2, 0, 1 + rng())), spawn.range + 1, false, rng);
    }
    if (m.objective === "vip") {
      const [a] = this.build.vipPath;
      this.addEnemy(id++, "vip", a.clone(), 0, false, rng);
    }
  }

  private addEnemy(id: number, kind: CharacterKind, pos: THREE.Vector3, range: number, elevated: boolean, rng: () => number): Enemy {
    const rig = buildCharacter(kind, id, this.build.camo);
    rig.root.position.copy(pos);
    this.scene.add(rig.root);
    const health = kind === "boss" ? this.mission.bossHealth ?? 1200 : kind === "heavy" ? 200 : kind === "hostage" ? 1 : 100;
    const enemy: Enemy = {
      id,
      kind,
      rig,
      health,
      maxHealth: health,
      role: "none",
      phase: 1,
      lockT: -1,
      lockCooldown: 5,
      moveFrom: null,
      moveTo: null,
      moveT: 1,
      freedAt: 0,
      alive: true,
      state: kind === "vip" ? "patrol" : rng() > 0.4 ? "patrol" : "idle",
      home: pos.clone(),
      range,
      elevated,
      targetX: pos.x,
      speed: this.mission.moveSpeed * (kind === "civilian" ? 0.7 : 1) * (0.8 + rng() * 0.4),
      idleTimer: rng() * 3,
      alertDelay: 0,
      fireTimer: this.mission.fireInterval * (0.8 + rng()),
      walkPhase: rng() * 6,
      deathTime: 0,
      deathDir: rng() > 0.5 ? 1 : -1,
      stagger: 0,
      pendingDeath: false,
      flashUntil: 0,
      vipProgress: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  private createWeather(high: boolean) {
    const kind = this.map.weather;
    const count = kind === "rain" ? (high ? 1800 : 800) : high ? 1400 : 600;
    const positions = new Float32Array(count * (kind === "rain" ? 6 : 3));
    this.weatherVel = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const x = (Math.random() - 0.5) * 70;
      const y = Math.random() * (kind === "dust" || kind === "mist" ? 8 : 26);
      const z = 10 - Math.random() * 80;
      if (kind === "rain") {
        positions.set([x, y, z, x, y - 0.5, z], i * 6);
      } else {
        positions.set([x, y, z], i * 3);
      }
      this.weatherVel[i * 3] = (Math.random() - 0.5) * 0.4;
      this.weatherVel[i * 3 + 1] = kind === "snow" ? -(0.8 + Math.random() * 0.8) : kind === "rain" ? -(18 + Math.random() * 6) : (Math.random() - 0.5) * 0.3;
      this.weatherVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (kind === "rain") {
      this.weather = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.35 }));
    } else {
      const config: Record<string, [number, number, number, boolean]> = {
        snow: [0xffffff, 0.12, 0.9, false],
        dust: [0xe8c79a, 0.09, 0.45, false],
        fireflies: [0xd8ff8a, 0.14, 0.9, true],
        mist: [0xf0d8d0, 0.8, 0.08, false],
      };
      const [color, size, opacity, additive] = config[kind];
      this.weather = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color, size, opacity, transparent: true, map: getGlowTexture(), depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
      );
    }
    this.weather.frustumCulled = false;
    this.scene.add(this.weather);
  }

  // ---------------- input ----------------
  private onMouseMove = (e: PointerEvent) => {
    if (this.paused || this.ended || this.killcam) return;
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && e.buttons === 0 && e.pointerType === "touch") return;
    this.look(e.movementX, e.movementY);
  };

  private look(dx: number, dy: number) {
    const sens = 0.0021 * this.save.settings.sensitivity * (this.camera.fov / BASE_FOV);
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (this.save.settings.invertY ? -1 : 1);
    this.yaw = THREE.MathUtils.clamp(this.yaw, -0.95, 0.95);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.5, 0.4);
  }

  private onMouseDown = (e: MouseEvent) => {
    if (this.paused || this.ended || this.killcam) return;
    if (e.button === 2) {
      e.preventDefault();
      this.toggleScope();
      return;
    }
    if (e.button === 0) {
      if (document.pointerLockElement !== this.renderer.domElement) this.requestLock();
      this.fire();
    }
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.paused || this.ended) return;
    if (!this.scoped) {
      if (e.deltaY < 0) this.toggleScope();
      return;
    }
    this.changeZoom(e.deltaY < 0 ? 1 : -1);
  };

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    this.touchLast = { x: t.clientX, y: t.clientY };
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchLast || this.paused) return;
    e.preventDefault();
    const t = e.touches[0];
    this.look((t.clientX - this.touchLast.x) * 1.4, (t.clientY - this.touchLast.y) * 1.4);
    this.touchLast = { x: t.clientX, y: t.clientY };
  };

  private onLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (!locked && this.wasLocked && !this.paused && !this.ended && !this.killcam) this.cb.onLockLost();
    this.wasLocked = locked;
  };

  private preventContext = (e: Event) => e.preventDefault();

  private bindInput() {
    const el = this.renderer.domElement;
    el.addEventListener("pointermove", this.onMouseMove as EventListener);
    el.addEventListener("mousedown", this.onMouseDown);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", this.preventContext);
    el.addEventListener("touchstart", this.onTouchStart, { passive: true });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    document.addEventListener("pointerlockchange", this.onLockChange);
  }

  requestLock() {
    const el = this.renderer.domElement as HTMLCanvasElement & { requestPointerLock: () => Promise<void> | void };
    try {
      const result = el.requestPointerLock();
      if (result && typeof (result as Promise<void>).catch === "function") (result as Promise<void>).catch(() => undefined);
    } catch {
      // pointer lock unavailable (e.g. iframe) — relative mouse still works
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------------- public controls ----------------
  start() {
    this.started = true;
    this.paused = false;
    this.clock.getDelta();
  }

  setPaused(p: boolean) {
    if (this.ended) return;
    this.paused = p;
    if (p) {
      this.holding = false;
      this.releaseLock();
    }
    this.clock.getDelta();
  }

  toggleScope() {
    if (this.paused || this.ended) return;
    this.scoped = !this.scoped;
    audio.scope(this.scoped);
  }

  setScope(v: boolean) {
    if (this.scoped !== v) this.toggleScope();
  }

  changeZoom(dir: number) {
    const next = THREE.MathUtils.clamp(this.zoomIndex + dir, 0, this.gun.zoomLevels.length - 1);
    if (next !== this.zoomIndex) {
      this.zoomIndex = next;
      audio.zoom();
    }
  }

  cycleZoom() {
    this.zoomIndex = (this.zoomIndex + 1) % this.gun.zoomLevels.length;
    audio.zoom();
  }

  setHoldBreath(v: boolean) {
    this.holding = v;
  }

  heal(amount: number) {
    this.health = Math.min(100, this.health + amount);
    this.cb.onHealth(this.health, false);
  }

  addAmmo(amount: number) {
    this.reserve += amount;
    this.cb.onAmmo(this.mag, this.reserve, this.reloading);
  }

  activateSlowmo(seconds: number) {
    this.slowmoUntil = performance.now() + seconds * 1000;
    audio.slowmo(true);
  }

  activateThermal(seconds: number) {
    this.thermalUntil = performance.now() + seconds * 1000;
  }

  reload() {
    if (this.reloading || this.mag >= this.gun.magSize || this.reserve <= 0 || this.ended || this.paused) return;
    this.reloading = true;
    this.reloadStart = performance.now();
    audio.reload(this.reloadDuration);
    this.cb.onAmmo(this.mag, this.reserve, true);
  }

  getTelemetry() {
    return this.telemetry;
  }

  setSettings(settings: SaveData["settings"]) {
    this.save = { ...this.save, settings };
  }

  getHealth() {
    return this.health;
  }

  getTimeOfDay() {
    return this.timeOfDay;
  }

  applyTimeOfDay(tod: TimeOfDay) {
    this.timeOfDay = tod;
    const preset = getTimePreset(this.map, tod);
    this.scene.background = new THREE.Color(preset.skyTop);
    this.scene.fog = new THREE.FogExp2(preset.fog, preset.fogDensity);
    this.hemiLight.color.setHex(preset.hemiSky);
    this.hemiLight.groundColor.setHex(preset.hemiGround);
    this.hemiLight.intensity = preset.hemiIntensity;
    this.sunLight.color.setHex(preset.sunColor);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.position.set(...preset.sunPos);
    this.renderer.toneMappingExposure = preset.exposure;
    this.build.applyTimePreset?.(preset);
    this.cb.onTimeOfDay?.(tod);
  }

  cycleTimeOfDay() {
    const order: TimeOfDay[] = ["day", "dusk", "night"];
    const next = order[(order.indexOf(this.timeOfDay) + 1) % order.length];
    this.applyTimeOfDay(next);
    audio.zoom();
    return next;
  }

  // ---------------- shooting ----------------
  fire() {
    if (this.paused || this.ended || this.killcam || !this.started) return;
    const now = performance.now();
    if (this.reloading) return;
    if (now < this.nextFire) return;
    if (this.mag <= 0) {
      audio.dryFire();
      if (this.reserve > 0) this.reload();
      else this.cb.onToast("OUT OF AMMO", "warn");
      return;
    }
    this.mag -= 1;
    this.nextFire = now + this.gun.fireDelay * 1000;
    audio.shot(this.gun.sound);
    this.recoil += this.gun.recoil * (this.scoped ? 1 : 1.4);
    this.recoilYaw += (Math.random() - 0.5) * this.gun.recoil * 0.4;
    this.shake = Math.min(1, this.shake + this.gun.recoil * 6);
    this.muzzleLight.intensity = 25;
    this.muzzleSprite.visible = !this.scoped;
    window.setTimeout(() => {
      this.muzzleLight.intensity = 0;
      this.muzzleSprite.visible = false;
    }, 60);

    this.camera.updateMatrixWorld(true);
    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // hip fire spread
    if (!this.scoped || this.scopeBlend < 0.8) {
      dir.x += (Math.random() - 0.5) * 0.03;
      dir.y += (Math.random() - 0.5) * 0.03;
    }
    // wind drift (rotate around world up)
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.wind * 0.0009);
    dir.normalize();

    this.raycaster.set(origin, dir);
    this.raycaster.far = 400;
    const targets: THREE.Object3D[] = [...this.solids];
    for (const e of this.enemies) if (e.alive) targets.push(...e.rig.parts);
    const hits = this.raycaster.intersectObjects(targets, false);

    let penetration = this.gun.penetration;
    const struck = new Set<number>();
    let endPoint = origin.clone().add(dir.clone().multiplyScalar(160));
    let killsThisShot = 0;
    let hitCount = 0;
    let finalKill: { enemy: Enemy; point: THREE.Vector3 } | null = null;
    const killed: Array<{ enemy: Enemy; headshot: boolean; distance: number }> = [];

    for (const hit of hits) {
      const enemyId = hit.object.userData.enemyId as number | undefined;
      if (enemyId === undefined) {
        endPoint = hit.point.clone();
        this.spawnPuff(hit.point, 0xb8a88a, 0.25);
        audio.impact();
        this.alertNear(hit.point, 4);
        break;
      }
      if (struck.has(enemyId)) continue;
      const enemy = this.enemies.find((e) => e.id === enemyId);
      if (!enemy || !enemy.alive) continue;
      struck.add(enemyId);
      hitCount += 1;
      endPoint = hit.point.clone();
      const headshot = hit.object.userData.part === "head";
      const distance = hit.distance;
      let damage = headshot ? 999 : this.gun.damage;
      // Boss armour: body shots are heavily reduced, the visor is the weak point
      if (enemy.kind === "boss") damage = headshot ? this.gun.damage * 2.6 : this.gun.damage * 0.55;
      if (enemy.kind === "hostage") damage = 999;
      enemy.health -= damage;
      this.spawnPuff(hit.point, enemy.kind === "boss" && !headshot ? 0xffb050 : 0x8a1010, 0.35);
      if (enemy.health <= 0) {
        enemy.alive = false;
        killsThisShot += 1;
        killed.push({ enemy, headshot, distance });
        finalKill = { enemy, point: hit.point.clone() };
      } else if (enemy.kind === "boss") {
        this.damageBoss(enemy, damage, headshot);
      } else {
        enemy.stagger = 0.4;
        this.alertEnemy(enemy, 0.2);
        this.cb.onArmorHit(distance);
        audio.hit(false);
      }
      penetration -= 1;
      if (penetration <= 0) break;
    }

    this.addTracer(this.muzzle.getWorldPosition(new THREE.Vector3()), endPoint);
    this.cb.onShot(hitCount);

    for (const k of killed) {
      const e = k.enemy;
      let score = 100;
      if (k.headshot) score += 150;
      if (k.distance > 45) score += Math.round((k.distance - 45) * 5);
      if (e.kind === "heavy") score += 60;
      if (e.kind === "vip") score += 500;
      if (killsThisShot > 1) score += 200;
      if (e.role === "captor") score += 120;
      if (e.kind === "boss") score += 2500;
      if (e.kind === "civilian") score = -500;
      if (e.kind === "hostage") score = -1000;
      this.cb.onKill({ headshot: k.headshot, distance: k.distance, kind: e.kind, multi: killsThisShot, score });
      if (e.kind !== "civilian" && e.kind !== "hostage") audio.hit(k.headshot);
      if (e.kind === "boss") this.bossLaser.visible = false;
      this.checkBodyDiscovery(e);
    }

    if (!this.gun.suppressed) this.alertAll();

    const civilianKilled = killed.some((k) => k.enemy.kind === "civilian");
    const hostageKilled = killed.some((k) => k.enemy.kind === "hostage");
    const done = this.objectiveComplete();
    if (hostageKilled) {
      killed.forEach((k) => this.startDeath(k.enemy));
      this.finish(false, "You shot the hostage");
    } else if (civilianKilled) {
      killed.forEach((k) => this.startDeath(k.enemy));
      this.finish(false, "Civilian casualty — mission compromised");
    } else if (done && finalKill) {
      if (this.mission.objective === "rescue") this.freeHostages();
      killed.forEach((k) => {
        if (k.enemy !== finalKill!.enemy || !this.save.settings.killcam) this.startDeath(k.enemy);
      });
      if (this.save.settings.killcam) this.startKillcam(finalKill.enemy, finalKill.point);
      else window.setTimeout(() => this.finish(true, "Objective complete"), 900);
    } else {
      killed.forEach((k) => this.startDeath(k.enemy));
    }
    this.emitObjective();

    this.cb.onAmmo(this.mag, this.reserve, false);
    if (this.mag === 0 && this.reserve > 0 && !this.ended) {
      window.setTimeout(() => this.reload(), this.gun.fireDelay * 600);
    }
  }

  private objectiveComplete() {
    const obj = this.mission.objective;
    if (obj === "vip") return this.enemies.some((e) => e.kind === "vip" && !e.alive);
    if (obj === "boss") return this.enemies.some((e) => e.kind === "boss" && !e.alive);
    if (obj === "rescue") {
      const hostagesOk = this.enemies.filter((e) => e.kind === "hostage").every((e) => e.alive);
      return hostagesOk && this.enemies.filter((e) => e.role === "captor").every((e) => !e.alive);
    }
    return this.enemies.filter((e) => e.kind === "soldier" || e.kind === "heavy").every((e) => !e.alive);
  }

  private emitObjective() {
    const obj = this.mission.objective;
    if (obj === "vip" || obj === "boss") {
      const target = this.enemies.find((e) => e.kind === obj);
      this.cb.onObjective(target && target.alive ? 1 : 0, 1);
      return;
    }
    const hostiles = obj === "rescue" ? this.enemies.filter((e) => e.role === "captor") : this.enemies.filter((e) => e.kind === "soldier" || e.kind === "heavy");
    this.cb.onObjective(hostiles.filter((e) => e.alive).length, hostiles.length);
  }

  // ---------------- boss & rescue ----------------
  private bossLaser!: THREE.Line;
  private lastLockBeep = 0;

  private createBossLaser() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    this.bossLaser = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.bossLaser.frustumCulled = false;
    this.bossLaser.visible = false;
    this.bossLaser.raycast = () => undefined;
    this.scene.add(this.bossLaser);
  }

  private bossPhaseTuning(phase: number) {
    return {
      lockDuration: [2.9, 2.35, 1.85][phase - 1] ?? 1.85,
      cooldown: [4.6, 3.6, 2.8][phase - 1] ?? 2.8,
      damage: this.mission.enemyDamage * (2 + phase * 0.25),
    };
  }

  private damageBoss(boss: Enemy, damage: number, headshot: boolean) {
    boss.stagger = 0.45;
    const brokeLock = boss.lockT >= 0;
    boss.lockT = -1;
    boss.lockCooldown = Math.max(boss.lockCooldown, 2.2);
    audio.hit(headshot);
    this.cb.onBossHit?.(Math.round(damage), headshot, brokeLock);
    const ratio = boss.health / boss.maxHealth;
    const phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (phase > boss.phase) {
      boss.phase = phase;
      this.spawnReinforcements(phase === 2 ? 2 : 3, phase === 3);
      this.relocateBoss(boss);
      audio.braam();
      this.cb.onBossPhase?.(phase);
    } else if (headshot) {
      this.relocateBoss(boss);
    }
  }

  private relocateBoss(boss: Enemy) {
    const ground = this.build.spawns.filter((s) => !s.elevated && s.pos.distanceTo(boss.rig.root.position) > 3);
    if (!ground.length) return;
    const spot = ground[Math.floor(Math.random() * ground.length)];
    boss.moveFrom = boss.rig.root.position.clone();
    boss.moveTo = spot.pos.clone();
    boss.moveT = 0;
    boss.range = Math.max(1.5, spot.range);
  }

  private spawnReinforcements(count: number, heavy: boolean) {
    const ground = this.build.spawns.filter((s) => !s.elevated);
    let nextId = this.enemies.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    for (let i = 0; i < count; i += 1) {
      const spot = ground[Math.floor(Math.random() * ground.length)];
      const pos = spot.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, -1.5 - Math.random() * 2));
      const e = this.addEnemy(nextId++, heavy && i === 0 ? "heavy" : "soldier", pos, spot.range, false, Math.random);
      this.alertEnemy(e, 1 + Math.random());
    }
    this.cb.onToast(`REINFORCEMENTS · ${count} INBOUND`, "warn");
  }

  private bossFire(boss: Enemy, now: number) {
    const tune = this.bossPhaseTuning(boss.phase);
    const armor = 1 - this.save.upgrades.armor * 0.12;
    if (boss.rig.flash) {
      boss.rig.flash.visible = true;
      boss.flashUntil = now + 90;
    }
    audio.enemyShot(10);
    audio.hurt();
    this.health = Math.max(0, this.health - tune.damage * armor);
    this.shake = 1;
    this.cb.onHealth(this.health, true);
    this.cb.onBossShot?.();
    if (this.health <= 0) this.finish(false, `Killed by ${this.mission.bossName ?? "the warlord"}`);
  }

  private updateBoss(boss: Enemy, dt: number, now: number) {
    const root = boss.rig.root;
    root.rotation.y = Math.atan2(CAMERA_POS.x - root.position.x, CAMERA_POS.z - root.position.z);
    boss.rig.armL.rotation.set(-1.5, 0, 0.35);
    boss.rig.armR.rotation.set(-1.4, 0, -0.1);
    if (boss.rig.rifle) boss.rig.rifle.position.set(0.08, 0.6, 0.3);
    let moving = false;
    if (boss.moveTo && boss.moveFrom && boss.moveT < 1) {
      boss.moveT = Math.min(1, boss.moveT + dt / 1.7);
      const ease = boss.moveT < 0.5 ? 2 * boss.moveT * boss.moveT : 1 - Math.pow(-2 * boss.moveT + 2, 2) / 2;
      root.position.lerpVectors(boss.moveFrom, boss.moveTo, ease);
      if (boss.moveT >= 1) {
        boss.home.copy(boss.moveTo);
        boss.targetX = boss.home.x;
      }
      moving = true;
    } else if (Math.abs(root.position.x - boss.targetX) < 0.1) {
      boss.idleTimer -= dt;
      if (boss.idleTimer <= 0) {
        boss.targetX = boss.home.x + (Math.random() - 0.5) * 2 * boss.range;
        boss.idleTimer = 1.2 + Math.random() * 2;
      }
    } else {
      const step = Math.sign(boss.targetX - root.position.x) * (1.1 + boss.phase * 0.35) * dt;
      root.position.x += Math.abs(step) > Math.abs(boss.targetX - root.position.x) ? boss.targetX - root.position.x : step;
      moving = true;
    }

    // Laser lock-on cycle — hitting the boss breaks the lock
    if (dt > 0) {
      const tune = this.bossPhaseTuning(boss.phase);
      if (boss.lockT >= 0) {
        boss.lockT += dt / tune.lockDuration;
        const interval = 0.46 - boss.lockT * 0.38;
        if (now - this.lastLockBeep > interval * 1000) {
          this.lastLockBeep = now;
          audio.lockBeep(boss.lockT);
        }
        if (boss.lockT >= 1) {
          this.bossFire(boss, now);
          boss.lockT = -1;
          boss.lockCooldown = tune.cooldown;
        }
      } else if (!moving || boss.moveT >= 1) {
        boss.lockCooldown -= dt;
        if (boss.lockCooldown <= 0) boss.lockT = 0;
      }
    }
    return moving;
  }

  private updateBossLaser(time: number) {
    const boss = this.enemies.find((e) => e.kind === "boss");
    if (!boss || !boss.alive || !boss.rig.muzzle || this.killcam || this.ended) {
      if (this.bossLaser) this.bossLaser.visible = false;
      return;
    }
    const from = boss.rig.muzzle.getWorldPosition(new THREE.Vector3());
    const locking = boss.lockT >= 0;
    const wobble = locking ? (1 - boss.lockT) * 0.8 : 1.6;
    const to = CAMERA_POS.clone().add(new THREE.Vector3(Math.sin(time * 1.7) * wobble, -0.4 + Math.cos(time * 1.3) * wobble * 0.5, 0));
    const pos = this.bossLaser.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    const mat = this.bossLaser.material as THREE.LineBasicMaterial;
    mat.opacity = locking ? 0.35 + boss.lockT * 0.6 * (boss.lockT > 0.75 ? 0.6 + 0.4 * Math.sin(time * 40) : 1) : 0.14;
    this.bossLaser.visible = true;
  }

  private freeHostages() {
    for (const e of this.enemies) {
      if (e.kind === "hostage" && e.alive) {
        e.state = "freed";
        e.freedAt = performance.now();
      }
    }
  }

  private executeHostage() {
    const hostage = this.enemies.find((e) => e.kind === "hostage" && e.alive);
    if (hostage) {
      hostage.alive = false;
      this.startDeath(hostage);
      audio.enemyShot(20);
    }
    this.finish(false, "The hostage was executed");
  }

  private startDeath(enemy: Enemy) {
    enemy.state = "dead";
    enemy.deathTime = 0;
    enemy.pendingDeath = false;
    if (enemy.rig.flash) enemy.rig.flash.visible = false;
  }

  private alertEnemy(enemy: Enemy, delay: number) {
    if (!enemy.alive || enemy.state === "alert") return;
    enemy.state = "alert";
    enemy.alertDelay = delay;
    if (!this.alerted && enemy.kind !== "civilian" && enemy.kind !== "hostage") {
      this.alerted = true;
      this.cb.onAlert();
      if (this.mission.objective === "rescue" && this.enemies.some((e) => e.role === "captor" && e.alive)) {
        const window = this.mission.executeWindow ?? 14;
        this.timeLeft = Math.min(this.timeLeft, window);
        this.cb.onExecutionAlert?.(Math.ceil(this.timeLeft));
      }
    }
  }

  private alertAll() {
    for (const e of this.enemies) this.alertEnemy(e, 0.3 + Math.random() * 1.1);
  }

  private alertNear(point: THREE.Vector3, radius: number) {
    for (const e of this.enemies) {
      if (e.alive && e.rig.root.position.distanceTo(point) < radius) this.alertEnemy(e, 0.5);
    }
  }

  private checkBodyDiscovery(dead: Enemy) {
    for (const e of this.enemies) {
      if (e !== dead && e.alive && e.rig.root.position.distanceTo(dead.rig.root.position) < 9) this.alertEnemy(e, 1.2 + Math.random());
    }
  }

  // ---------------- effects ----------------
  private spawnPuff(point: THREE.Vector3, color: number, size: number) {
    for (let i = 0; i < 5; i += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(size * (0.4 + Math.random() * 0.4), 6, 5), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
      mesh.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3));
      this.scene.add(mesh);
      this.effects.push({ mesh, life: 0, max: 0.6 + Math.random() * 0.3, grow: 2.5 });
    }
  }

  private addTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: this.gun.sound === "rail" ? 0x6fe6ff : 0xffd49a, transparent: true, opacity: 0.8 }));
    line.frustumCulled = false;
    this.scene.add(line);
    this.effects.push({ mesh: line, life: 0, max: this.gun.sound === "rail" ? 0.5 : 0.14, grow: 0 });
  }

  // ---------------- killcam ----------------
  private startKillcam(enemy: Enemy, point: THREE.Vector3) {
    enemy.pendingDeath = true;
    const from = this.muzzle.getWorldPosition(new THREE.Vector3());
    const bullet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.12, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.9, roughness: 0.25, emissive: 0x3a2a08 }));
    this.scene.add(bullet);
    const trail = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, from]), new THREE.LineBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.5 }));
    trail.frustumCulled = false;
    this.scene.add(trail);
    this.gunGroup.visible = false;
    this.killcam = { from, to: point, enemy, t: 0, phase: "travel", bullet, trail, orbit: 0 };
    this.cb.onKillcam(true);
    audio.slowmo(true);
  }

  private updateKillcam(dt: number) {
    const k = this.killcam!;
    const dir = k.to.clone().sub(k.from).normalize();
    if (k.phase === "travel") {
      const distance = k.from.distanceTo(k.to);
      k.t = Math.min(1, k.t + dt / Math.min(2.2, 0.9 + distance / 60));
      const e = k.t;
      const p = k.from.clone().lerp(k.to, e);
      k.bullet.position.copy(p);
      k.bullet.lookAt(k.to);
      k.bullet.rotateZ(k.t * 40);
      (k.trail.geometry as THREE.BufferGeometry).setFromPoints([k.from.clone().lerp(k.to, Math.max(0, e - 0.25)), p]);
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const offset = side.multiplyScalar(0.18 * Math.sin(k.t * 3)).add(new THREE.Vector3(0, 0.06, 0));
      this.camera.position.copy(p).sub(dir.clone().multiplyScalar(0.45)).add(offset);
      this.camera.lookAt(k.to);
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
      if (k.t >= 1) {
        k.phase = "impact";
        k.t = 0;
        this.scene.remove(k.bullet);
        this.startDeath(k.enemy);
        this.spawnPuff(k.to, 0x8a1010, 0.5);
        audio.hit(true);
        this.shake = 0.6;
      }
    } else {
      k.t += dt;
      k.orbit += dt * 0.5;
      const center = k.enemy.rig.root.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      const back = dir.clone().multiplyScalar(-2.6);
      back.applyAxisAngle(new THREE.Vector3(0, 1, 0), k.orbit);
      this.camera.position.copy(center).add(back).add(new THREE.Vector3(0, 0.5, 0));
      this.camera.lookAt(center);
      if (k.t > 2.2) {
        this.cb.onKillcam(false);
        audio.slowmo(false);
        this.finish(true, "Objective complete");
      }
    }
  }

  private finish(success: boolean, reason: string) {
    if (this.ended) return;
    this.ended = true;
    this.releaseLock();
    if (this.bossLaser) this.bossLaser.visible = false;
    const rescued = success ? this.enemies.filter((e) => e.kind === "hostage" && e.alive).length : 0;
    const bossKilled = this.enemies.some((e) => e.kind === "boss" && !e.alive);
    this.cb.onEnd({ success, reason, health: Math.round(this.health), timeUsed: Math.round(this.elapsed), rescued, bossKilled });
  }

  // ---------------- enemy AI ----------------
  private updateEnemies(dt: number, now: number) {
    const camPos = CAMERA_POS;
    for (const e of this.enemies) {
      const root = e.rig.root;
      if (e.state === "dead") {
        e.deathTime += dt;
        const f = Math.min(1, e.deathTime / 0.8);
        const ease = f * f;
        root.rotation.x = -ease * 1.45;
        root.rotation.z = e.deathDir * ease * 0.2;
        e.rig.legL.rotation.x = -ease * 0.3;
        e.rig.armL.rotation.x = -2.4 * ease;
        e.rig.armR.rotation.x = -2.2 * ease;
        if (e.rig.rifle && f > 0.2) e.rig.rifle.visible = false;
        continue;
      }
      if (!e.alive || e.state === "escaped") continue;

      if (e.kind === "hostage") {
        // Kneeling, hands tied, trembling — or standing up with arms raised once freed
        const baseY = e.home.y;
        if (e.state === "freed") {
          const f = Math.min(1, (now - e.freedAt) / 900);
          root.position.y = baseY - 0.58 * (1 - f);
          e.rig.legL.rotation.x = 1.2 * (1 - f);
          e.rig.legR.rotation.x = 1.2 * (1 - f);
          e.rig.hips.rotation.x = 0.28 * (1 - f);
          const wave = Math.sin(now * 0.012) * 0.3;
          e.rig.armL.rotation.set(-2.8 * f + 0.55 * (1 - f), 0, 0.28 + wave * f);
          e.rig.armR.rotation.set(-2.8 * f + 0.55 * (1 - f), 0, -0.28 - wave * f);
        } else {
          root.position.y = baseY - 0.58;
          e.rig.legL.rotation.x = 1.2;
          e.rig.legR.rotation.x = 1.2;
          e.rig.hips.rotation.x = 0.28 + Math.sin(now * 0.004 + e.id) * 0.03;
          root.rotation.z = Math.sin(now * 0.03 + e.id) * (this.alerted ? 0.02 : 0.006);
        }
        root.rotation.y = Math.atan2(camPos.x - root.position.x, camPos.z - root.position.z) * 0.6;
        continue;
      }

      if (e.stagger > 0) {
        e.stagger -= dt;
        root.rotation.z = Math.sin(e.stagger * 30) * 0.12;
      } else root.rotation.z = 0;

      let moving = false;
      if (e.kind === "boss") {
        moving = this.updateBoss(e, dt, now);
      } else if (e.role === "captor" && e.state !== "alert") {
        // Captors stand guard over their hostage, glancing around
        const hostage = this.enemies.find((h) => h.kind === "hostage" && h.alive && h.rig.root.position.distanceTo(root.position) < 2.5);
        const look = hostage ? Math.atan2(hostage.rig.root.position.x - root.position.x, hostage.rig.root.position.z - root.position.z) : 0;
        root.rotation.y = look + Math.sin(now * 0.0008 + e.id * 2) * 0.9;
        e.rig.armL.rotation.set(-1.2, 0, 0.35);
        e.rig.armR.rotation.set(-0.9, 0, -0.1);
      } else if (e.kind === "vip") {
        const [a, b] = this.build.vipPath;
        const total = a.distanceTo(b);
        const speed = (total / (this.mission.timeLimit * 0.92)) * (e.state === "alert" ? 1.5 : 1);
        e.vipProgress = Math.min(1, e.vipProgress + (speed * dt) / total);
        root.position.lerpVectors(a, b, e.vipProgress);
        root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        moving = true;
        if (e.vipProgress >= 1) {
          e.state = "escaped";
          root.visible = false;
          this.finish(false, "The target escaped");
        }
      } else if (e.state === "alert" && e.kind !== "civilian") {
        e.alertDelay -= dt;
        root.rotation.y = Math.atan2(camPos.x - root.position.x, camPos.z - root.position.z);
        e.rig.armL.rotation.set(-1.5, 0, 0.35);
        e.rig.armR.rotation.set(-1.4, 0, -0.1);
        if (e.rig.rifle) e.rig.rifle.position.set(0.08, 0.6, 0.3);
        // strafe
        if (Math.abs(root.position.x - e.targetX) < 0.1) {
          e.idleTimer -= dt;
          if (e.idleTimer <= 0) {
            e.targetX = e.home.x + (Math.random() - 0.5) * 2 * e.range;
            e.idleTimer = 1 + Math.random() * 2;
          }
        } else {
          const step = Math.sign(e.targetX - root.position.x) * e.speed * 1.8 * dt;
          root.position.x += Math.abs(step) > Math.abs(e.targetX - root.position.x) ? e.targetX - root.position.x : step;
          moving = true;
        }
        if (e.alertDelay <= 0) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = this.mission.fireInterval * (0.7 + Math.random() * 0.6);
            this.enemyFire(e, now);
          }
        }
      } else if (e.state === "alert" && e.kind === "civilian") {
        // panic
        e.rig.armL.rotation.set(-2.8, 0, 0.3);
        e.rig.armR.rotation.set(-2.8, 0, -0.3);
        if (Math.abs(root.position.x - e.targetX) < 0.2) e.targetX = e.home.x + (Math.random() - 0.5) * 2 * (e.range + 2);
        const dirX = Math.sign(e.targetX - root.position.x);
        root.position.x += dirX * 2.6 * dt;
        root.rotation.y = dirX > 0 ? Math.PI / 2 : -Math.PI / 2;
        moving = true;
      } else if (e.state === "patrol") {
        const dx = e.targetX - root.position.x;
        if (Math.abs(dx) < 0.05) {
          e.state = "idle";
          e.idleTimer = 1 + Math.random() * 3;
        } else {
          const step = Math.sign(dx) * e.speed * dt;
          root.position.x += Math.abs(step) > Math.abs(dx) ? dx : step;
          root.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
          moving = true;
        }
      } else if (e.state === "idle") {
        e.idleTimer -= dt;
        root.rotation.y += (Math.atan2(camPos.x - root.position.x, camPos.z - root.position.z) * 0.5 - root.rotation.y) * dt;
        if (e.idleTimer <= 0) {
          e.state = "patrol";
          e.targetX = e.home.x + (Math.random() - 0.5) * 2 * e.range;
        }
      }

      if (moving) {
        e.walkPhase += dt * (e.state === "alert" ? 11 : 7) * Math.max(0.6, e.speed);
        const swing = Math.sin(e.walkPhase) * 0.55;
        e.rig.legL.rotation.x = swing;
        e.rig.legR.rotation.x = -swing;
        if (e.kind === "civilian" && e.state !== "alert") {
          e.rig.armL.rotation.x = -swing * 0.7;
          e.rig.armR.rotation.x = swing * 0.7;
        }
        if (e.kind === "vip") {
          e.rig.armL.rotation.x = -swing * 0.5;
          e.rig.armR.rotation.x = swing * 0.5;
        }
        e.rig.hips.position.y = 0.95 + Math.abs(Math.cos(e.walkPhase)) * 0.03;
      } else {
        e.rig.legL.rotation.x *= 0.85;
        e.rig.legR.rotation.x *= 0.85;
      }

      if (e.rig.flash && e.flashUntil && now > e.flashUntil) {
        e.rig.flash.visible = false;
        e.flashUntil = 0;
      }
    }
  }

  private enemyFire(e: Enemy, now: number) {
    const dist = e.rig.root.position.distanceTo(CAMERA_POS);
    if (e.rig.flash) {
      e.rig.flash.visible = true;
      e.flashUntil = now + 70;
    }
    audio.enemyShot(dist);
    const accuracy = this.mission.enemyAccuracy * THREE.MathUtils.clamp(1.35 - dist / 80, 0.55, 1.25) * (this.scoped ? 1.1 : 0.9);
    if (Math.random() < accuracy) {
      const armor = 1 - this.save.upgrades.armor * 0.12;
      const damage = this.mission.enemyDamage * (0.8 + Math.random() * 0.4) * (e.kind === "heavy" ? 1.3 : 1) * armor;
      this.health = Math.max(0, this.health - damage);
      this.shake = Math.min(1, this.shake + 0.5);
      audio.hurt();
      this.cb.onHealth(this.health, true);
      if (this.health <= 0) this.finish(false, "You were killed in action");
    } else if (Math.random() < 0.5) {
      window.setTimeout(() => audio.whiz(), (dist / 340) * 1000);
    }
  }

  // ---------------- loop ----------------
  private resize() {
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private updateWeather(dt: number) {
    if (!this.weather || !this.weatherVel) return;
    const kind = this.map.weather;
    const attr = this.weather.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const count = this.weatherVel.length / 3;
    const windPush = this.wind * 0.6;
    for (let i = 0; i < count; i += 1) {
      const vx = this.weatherVel[i * 3] + (kind === "dust" ? windPush * 2 : windPush * 0.4);
      const vy = this.weatherVel[i * 3 + 1];
      const vz = this.weatherVel[i * 3 + 2];
      if (kind === "rain") {
        const o = i * 6;
        for (const k of [0, 3]) {
          arr[o + k] += vx * dt;
          arr[o + k + 1] += vy * dt;
          arr[o + k + 2] += vz * dt;
        }
        if (arr[o + 1] < 0) {
          const x = (Math.random() - 0.5) * 70;
          const z = 10 - Math.random() * 80;
          arr.set([x, 26, z, x - windPush * 0.03, 25.4, z], o);
        }
      } else {
        const o = i * 3;
        const wobble = kind === "fireflies" ? Math.sin(this.swayT * 2 + i) * 0.4 : kind === "snow" ? Math.sin(this.swayT + i) * 0.3 : 0;
        arr[o] += (vx + wobble) * dt;
        arr[o + 1] += (vy + (kind === "fireflies" ? Math.cos(this.swayT * 1.5 + i) * 0.3 : 0)) * dt;
        arr[o + 2] += vz * dt;
        const maxY = kind === "dust" || kind === "mist" ? 8 : 26;
        if (arr[o + 1] < 0) arr[o + 1] = maxY;
        if (arr[o + 1] > maxY) arr[o + 1] = 0;
        if (arr[o] > 35) arr[o] = -35;
        if (arr[o] < -35) arr[o] = 35;
      }
    }
    attr.needsUpdate = true;
  }

  private updateThermal(active: boolean) {
    for (const e of this.enemies) {
      const color = !e.alive
        ? 0x000000
        : e.kind === "civilian" || e.kind === "hostage"
          ? 0x22ff66
          : e.kind === "vip"
            ? 0xffcc00
            : e.kind === "boss"
              ? 0xff00aa
              : 0xff2a1a;
      for (const m of e.rig.materials) {
        m.emissive.setHex(active ? color : 0x000000);
        m.emissiveIntensity = active ? 1.4 : 0;
      }
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    const slowmo = now < this.slowmoUntil;
    if (!slowmo && this.slowmoUntil) {
      this.slowmoUntil = 0;
      audio.slowmo(false);
    }
    const timeScale = this.killcam ? (this.killcam.phase === "travel" ? 0.04 : 0.3) : slowmo ? 0.35 : 1;
    const active = !this.paused && this.started;
    const dt = active ? rawDt * timeScale : 0;
    this.swayT += active ? rawDt : 0;

    if (active && !this.ended) {
      this.elapsed += dt;
      if (!this.killcam) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.mission.objective === "rescue") this.executeHostage();
          else this.finish(false, this.mission.objective === "vip" ? "The target escaped" : this.mission.objective === "boss" ? "The warlord escaped" : "Time expired");
        }
      }
      // reload
      if (this.reloading && now - this.reloadStart >= this.reloadDuration * 1000) {
        const load = Math.min(this.gun.magSize - this.mag, this.reserve);
        this.mag += load;
        this.reserve -= load;
        this.reloading = false;
        this.cb.onAmmo(this.mag, this.reserve, false);
      }
      // breath
      const gasping = now < this.gaspUntil;
      if (this.holding && this.scoped && !gasping) {
        this.breath -= 30 * rawDt;
        if (this.breath <= 0) {
          this.breath = 0;
          this.gaspUntil = now + 1800;
          audio.hurt();
        }
      } else {
        this.breath = Math.min(this.breathMax, this.breath + 20 * rawDt);
      }
      // wind gusts
      if (Math.random() < rawDt * 0.15) {
        const mag = this.map.windRange[0] + Math.random() * (this.map.windRange[1] - this.map.windRange[0]);
        this.windTarget = mag * Math.sign(this.wind || 1);
      }
      this.wind += (this.windTarget - this.wind) * rawDt * 0.5;
      // heartbeat
      if (this.health < 35 && now - this.lastHeartbeat > 900) {
        this.lastHeartbeat = now;
        audio.heartbeat();
      }
    }

    if (active && !this.ended) this.updateEnemies(dt, now);
    else if (this.killcam) this.updateEnemies(rawDt * timeScale, now);
    if (!this.paused) this.updateWeather(rawDt * (slowmo ? 0.35 : 1));
    this.build.update?.(now / 1000);
    this.updateBossLaser(now / 1000);

    const thermalActive = now < this.thermalUntil || (this.gun.thermal && this.scoped && this.scopeBlend > 0.8);
    this.updateThermal(thermalActive);

    // effects
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const fx = this.effects[i];
      fx.life += rawDt * (this.killcam ? 0.3 : 1);
      const t = fx.life / fx.max;
      const material = fx.mesh.material as THREE.Material & { opacity: number };
      material.opacity = Math.max(0, 0.8 * (1 - t));
      if (fx.grow) fx.mesh.scale.setScalar(1 + t * fx.grow);
      if (t >= 1) {
        this.scene.remove(fx.mesh);
        fx.mesh.geometry.dispose();
        material.dispose();
        this.effects.splice(i, 1);
      }
    }

    if (this.killcam) {
      this.updateKillcam(rawDt);
    } else {
      // scope + camera
      this.scopeBlend += ((this.scoped ? 1 : 0) - this.scopeBlend) * Math.min(1, rawDt * 14);
      const zoom = this.gun.zoomLevels[this.zoomIndex];
      const targetFov = this.scoped ? BASE_FOV / zoom : BASE_FOV;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, rawDt * 12);
      this.camera.updateProjectionMatrix();

      const stability = this.gun.stability * (1 + this.save.upgrades.steady * 0.15);
      let amp = this.scoped ? 0.0075 * Math.max(0.15, 1 - stability * 0.75) : 0.0015;
      const gasping = now < this.gaspUntil;
      if (this.holding && this.scoped && !gasping && this.breath > 0) amp *= 0.1;
      if (gasping) amp *= 2.4;
      if (this.health < 35) amp *= 1.5;
      const t = this.swayT;
      const swayX = amp * (Math.sin(t * 0.63) + Math.sin(t * 1.71 + 2) * 0.4 + Math.sin(t * 3.1) * 0.12);
      const swayY = amp * (Math.sin(t * 0.91 + 1) * 0.8 + Math.sin(t * 2.3) * 0.3);

      this.recoil *= Math.pow(0.0015, rawDt);
      this.recoilYaw *= Math.pow(0.002, rawDt);
      this.shake *= Math.pow(0.01, rawDt);
      const shakeX = (Math.random() - 0.5) * this.shake * 0.02;
      const shakeY = (Math.random() - 0.5) * this.shake * 0.02;
      this.camera.position.copy(CAMERA_POS);
      this.camera.rotation.set(this.pitch + swayY + this.recoil + shakeY, this.yaw + swayX + this.recoilYaw + shakeX, 0, "YXZ");

      // weapon placement (hip -> ADS)
      const b = this.scopeBlend;
      const bob = Math.sin(t * 1.4) * 0.004 * (1 - b);
      this.gunGroup.position.set(THREE.MathUtils.lerp(0.2, 0, b), THREE.MathUtils.lerp(-0.2, -0.12, b) + bob - this.recoil * 0.4, THREE.MathUtils.lerp(-0.45, -0.25, b) + this.recoil * 0.8);
      this.gunGroup.rotation.set(this.recoil * 2, 0, 0);
      this.gunGroup.visible = b < 0.92;
    }

    // telemetry + rangefinder
    this.rangeTimer -= rawDt;
    if (this.rangeTimer <= 0 && !this.killcam) {
      this.rangeTimer = 0.1;
      const origin = this.camera.getWorldPosition(new THREE.Vector3());
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.raycaster.set(origin, dir);
      this.raycaster.far = 400;
      const targets: THREE.Object3D[] = [...this.solids];
      for (const e of this.enemies) if (e.alive) targets.push(...e.rig.parts);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      this.telemetry.range = hit ? hit.distance : null;
      const id = hit?.object.userData.enemyId as number | undefined;
      this.telemetry.targetKind = id !== undefined ? this.enemies.find((e) => e.id === id)?.kind ?? null : null;
    }
    const tm = this.telemetry;
    tm.zoom = this.scoped ? this.gun.zoomLevels[this.zoomIndex] : 1;
    tm.zoomIndex = this.zoomIndex;
    tm.scoped = this.scoped && this.scopeBlend > 0.75;
    tm.breath = this.breath;
    tm.breathMax = this.breathMax;
    tm.holding = this.holding && this.scoped;
    tm.gasping = now < this.gaspUntil;
    tm.wind = this.wind;
    tm.timeLeft = this.timeLeft;
    tm.slowmo = slowmo ? (this.slowmoUntil - now) / 1000 : 0;
    tm.thermal = thermalActive ? 1 : 0;
    tm.reloadProgress = this.reloading ? Math.min(1, (now - this.reloadStart) / (this.reloadDuration * 1000)) : 0;
    tm.fireReady = Math.min(1, 1 - Math.max(0, this.nextFire - now) / (this.gun.fireDelay * 1000));
    const boss = this.enemies.find((e) => e.kind === "boss");
    tm.boss = boss
      ? { hp: Math.max(0, boss.health), max: boss.maxHealth, phase: boss.phase, lock: boss.alive ? boss.lockT : -1, moving: boss.moveT < 1 }
      : null;
    tm.hostagesAlive = this.enemies.filter((e) => e.kind === "hostage" && e.alive).length;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onMouseMove as EventListener);
    el.removeEventListener("mousedown", this.onMouseDown);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("contextmenu", this.preventContext);
    el.removeEventListener("touchstart", this.onTouchStart);
    el.removeEventListener("touchmove", this.onTouchMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.releaseLock();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m: THREE.Material & { map?: THREE.Texture | null }) => {
          // shared procedural textures are cached across missions; only per-mesh clones get freed
          if (m.map?.userData.temporary) m.map.dispose();
          m.dispose();
        });
      }
    });
    clearMapCache();
    this.renderer.dispose();
    el.remove();
  }
}
