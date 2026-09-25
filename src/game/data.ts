export type MapId = "marsh" | "desert" | "snow" | "city" | "harbor";
export type WeatherKind = "fireflies" | "dust" | "snow" | "rain" | "mist";
export type Objective = "eliminate" | "vip" | "rescue" | "boss";
export type Difficulty = "normal" | "hard" | "boss";
export type TimeOfDay = "day" | "dusk" | "night";

export interface TimePreset {
  id: TimeOfDay;
  name: string;
  hindiName: string;
  clock: string;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  exposure: number;
  windowGlow: number;
  lampIntensity: number;
  starOpacity: number;
  cloudOpacity: number;
  cloudColor: number;
  celestialColor: number;
  celestialSize: number;
  isNight: boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  region: string;
  description: string;
  image: string;
  sky: number;
  fog: number;
  fogDensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPos: [number, number, number];
  accent: number;
  exposure: number;
  weather: WeatherKind;
  windRange: [number, number];
  musicRoot: number;
  timeOfDay: string;
  ground: GroundKind;
  groundTile: number;
  camoBase: number;
}

export type GroundKind = "marsh" | "sand" | "snow" | "asphalt" | "concrete";

export interface Mission {
  id: string;
  index: number;
  mapId: MapId;
  title: string;
  brief: string;
  objective: Objective;
  difficulty: Difficulty;
  defaultTime: TimeOfDay;
  hostages?: number;
  executeWindow?: number;
  bossName?: string;
  bossTitle?: string;
  bossHealth?: number;
  hostiles: number;
  heavies: number;
  civilians: number;
  moveSpeed: number;
  enemyAccuracy: number;
  enemyDamage: number;
  fireInterval: number;
  timeLimit: number;
  reward: number;
}

export interface GunModel {
  body: number;
  accent: number;
  metal: number;
  barrel: number;
  stock: "classic" | "skeleton" | "bullpup" | "heavy" | "future" | "thumbhole" | "lmg";
  scopeLen: number;
  suppressor: boolean;
  bipod: boolean;
  muzzleBrake: boolean;
  wood?: boolean;
  cased?: boolean;
}

export interface GunDef {
  id: string;
  name: string;
  tag: string;
  kind: string;
  description: string;
  price: number;
  damage: number;
  magSize: number;
  reserve: number;
  fireDelay: number;
  reloadTime: number;
  zoomLevels: number[];
  stability: number;
  penetration: number;
  recoil: number;
  suppressed: boolean;
  thermal: boolean;
  sound: "bolt" | "semi" | "suppressed" | "heavy" | "rail";
  model: GunModel;
}

export interface ItemDef {
  id: "medkit" | "adrenaline" | "thermal" | "ammo";
  name: string;
  key: string;
  description: string;
  price: number;
  color: string;
}

export interface UpgradeDef {
  id: "armor" | "steady" | "reload" | "lungs" | "bounty";
  name: string;
  description: string;
  effect: string;
  prices: number[];
}

export const MAPS: MapDef[] = [
  {
    id: "marsh",
    name: "Stillwater Marsh",
    region: "Lowlands · Grid 07",
    description: "Fog-choked wetlands, a rotting watchtower and a patrol that thinks nobody is watching.",
    image: "./images/map-marsh.jpg",
    sky: 0x0f1a1a,
    fog: 0x16231f,
    fogDensity: 0.018,
    hemiSky: 0xa9c4bb,
    hemiGround: 0x1d231c,
    hemiIntensity: 1.3,
    sunColor: 0xb6d4d2,
    sunIntensity: 2.1,
    sunPos: [-14, 20, 6],
    accent: 0xe0a961,
    exposure: 1.2,
    weather: "fireflies",
    windRange: [0.5, 2.5],
    musicRoot: 45,
    timeOfDay: "02:40 · Moonlit",
    ground: "marsh",
    groundTile: 22,
    camoBase: 0x4a5340,
  },
  {
    id: "desert",
    name: "Dune Sector",
    region: "Al-Rashid Basin · Grid 12",
    description: "A sun-bleached village where every rooftop is a firing position. Watch the heat haze.",
    image: "./images/map-desert.jpg",
    sky: 0xd99a62,
    fog: 0xcf9a68,
    fogDensity: 0.011,
    hemiSky: 0xffd9a8,
    hemiGround: 0x6b4b2c,
    hemiIntensity: 1.4,
    sunColor: 0xffc27a,
    sunIntensity: 3.2,
    sunPos: [18, 14, -30],
    accent: 0xff9a4a,
    exposure: 1.05,
    weather: "dust",
    windRange: [2, 5],
    musicRoot: 50,
    timeOfDay: "18:10 · Golden hour",
    ground: "sand",
    groundTile: 18,
    camoBase: 0x9b8662,
  },
  {
    id: "snow",
    name: "Frostbite Pass",
    region: "Northern Ridge · Grid 19",
    description: "A radar outpost hidden in the pines. Cold air, falling snow, and very long sightlines.",
    image: "./images/map-snow.jpg",
    sky: 0xaebccb,
    fog: 0xc3cfdb,
    fogDensity: 0.016,
    hemiSky: 0xe6f0ff,
    hemiGround: 0x8090a0,
    hemiIntensity: 1.5,
    sunColor: 0xe9f1ff,
    sunIntensity: 2.2,
    sunPos: [-10, 22, -8],
    accent: 0x8fc7ff,
    exposure: 0.95,
    weather: "snow",
    windRange: [1.5, 4.5],
    musicRoot: 43,
    timeOfDay: "07:25 · Overcast",
    ground: "snow",
    groundTile: 14,
    camoBase: 0xcdd4da,
  },
  {
    id: "city",
    name: "Neon District",
    region: "Kowloon Heights · Grid 24",
    description: "Rain-slick streets, neon glare and hostiles on every rooftop. Mind the civilians.",
    image: "./images/map-city.jpg",
    sky: 0x0b0a16,
    fog: 0x141229,
    fogDensity: 0.02,
    hemiSky: 0x7f79c9,
    hemiGround: 0x15121f,
    hemiIntensity: 1.1,
    sunColor: 0x9cb6ff,
    sunIntensity: 1.3,
    sunPos: [10, 24, 6],
    accent: 0xff3fa4,
    exposure: 1.3,
    weather: "rain",
    windRange: [1, 3.5],
    musicRoot: 47,
    timeOfDay: "23:55 · Heavy rain",
    ground: "asphalt",
    groundTile: 26,
    camoBase: 0x2a2a30,
  },
  {
    id: "harbor",
    name: "Blackwater Harbor",
    region: "Port Varga · Grid 31",
    description: "Containers stacked like a maze, cranes overhead and a cargo ship full of secrets.",
    image: "./images/map-harbor.jpg",
    sky: 0x5a4a6a,
    fog: 0x7a5e70,
    fogDensity: 0.013,
    hemiSky: 0xf2b8a0,
    hemiGround: 0x2a2a3a,
    hemiIntensity: 1.35,
    sunColor: 0xffa27a,
    sunIntensity: 2.6,
    sunPos: [-20, 10, -40],
    accent: 0xff8a5c,
    exposure: 1.1,
    weather: "mist",
    windRange: [3, 6],
    musicRoot: 41,
    timeOfDay: "19:40 · Dusk",
    ground: "concrete",
    groundTile: 16,
    camoBase: 0x2f3a4a,
  },
];

type ScriptEntry = Omit<Mission, "id" | "index" | "reward" | "difficulty"> & { difficulty?: Difficulty };

const MISSION_SCRIPT: ScriptEntry[] = [
  { mapId: "marsh", title: "First Light", brief: "Thin out the patrol before it reaches the crossing.", objective: "eliminate", defaultTime: "dusk", hostiles: 3, heavies: 0, civilians: 0, moveSpeed: 0.55, enemyAccuracy: 0.22, enemyDamage: 8, fireInterval: 3.4, timeLimit: 150 },
  { mapId: "marsh", title: "The Reedline", brief: "Clear the eastern bank under midday haze. A sentry watches from the tower.", objective: "eliminate", defaultTime: "day", hostiles: 5, heavies: 0, civilians: 0, moveSpeed: 0.65, enemyAccuracy: 0.26, enemyDamage: 9, fireInterval: 3.1, timeLimit: 160 },
  { mapId: "marsh", title: "Ferryman", brief: "A smuggler lieutenant is crossing the marsh at midnight. Stop him before the treeline.", objective: "vip", defaultTime: "night", hostiles: 4, heavies: 1, civilians: 0, moveSpeed: 0.7, enemyAccuracy: 0.28, enemyDamage: 10, fireInterval: 3, timeLimit: 70 },
  { mapId: "marsh", title: "Lifeline", brief: "Rebels are holding a journalist at the ferry dock. Silence her captors before they panic.", objective: "rescue", defaultTime: "dusk", hostages: 1, executeWindow: 16, hostiles: 2, heavies: 0, civilians: 0, moveSpeed: 0.6, enemyAccuracy: 0.26, enemyDamage: 9, fireInterval: 3.1, timeLimit: 150 },
  { mapId: "marsh", title: "The Heron", brief: "A marsh warlord with a laser-guided .50 has our squad pinned. Break his lock, then break him.", objective: "boss", defaultTime: "night", bossName: "THE HERON", bossTitle: "Marsh Warlord", bossHealth: 900, hostiles: 3, heavies: 1, civilians: 0, moveSpeed: 0.7, enemyAccuracy: 0.28, enemyDamage: 10, fireInterval: 3, timeLimit: 240 },
  { mapId: "desert", title: "Sandglass", brief: "Rooftop spotters are directing mortar fire under the blazing desert sun.", objective: "eliminate", defaultTime: "day", hostiles: 6, heavies: 1, civilians: 2, moveSpeed: 0.75, enemyAccuracy: 0.3, enemyDamage: 10, fireInterval: 2.9, timeLimit: 170 },
  { mapId: "desert", title: "Market Day", brief: "Hostiles are hiding among evening bazaar traders. Identify before you fire.", objective: "eliminate", defaultTime: "dusk", hostiles: 6, heavies: 1, civilians: 4, moveSpeed: 0.8, enemyAccuracy: 0.32, enemyDamage: 11, fireInterval: 2.8, timeLimit: 170 },
  { mapId: "desert", title: "The Broker", brief: "An arms broker is leaving a midnight meeting. Take him before his convoy moves.", objective: "vip", defaultTime: "night", hostiles: 5, heavies: 2, civilians: 2, moveSpeed: 0.85, enemyAccuracy: 0.34, enemyDamage: 12, fireInterval: 2.7, timeLimit: 65 },
  { mapId: "desert", title: "Aid Workers", brief: "Two aid workers are on their knees in the village square. Every captor must fall before they notice.", objective: "rescue", defaultTime: "day", hostages: 2, executeWindow: 15, hostiles: 3, heavies: 1, civilians: 0, moveSpeed: 0.8, enemyAccuracy: 0.32, enemyDamage: 11, fireInterval: 2.8, timeLimit: 170 },
  { mapId: "desert", title: "Sandstorm Sultan", brief: "Al-Qadir runs the basin from behind a scope. He is armoured, relentless and he never misses twice.", objective: "boss", defaultTime: "dusk", bossName: "AL-QADIR", bossTitle: "Sandstorm Sultan", bossHealth: 1100, hostiles: 4, heavies: 1, civilians: 0, moveSpeed: 0.85, enemyAccuracy: 0.34, enemyDamage: 12, fireInterval: 2.7, timeLimit: 240 },
  { mapId: "snow", title: "Whiteout", brief: "Neutralise the perimeter guards around the radar dome in crisp alpine daylight.", objective: "eliminate", defaultTime: "day", hostiles: 7, heavies: 2, civilians: 0, moveSpeed: 0.85, enemyAccuracy: 0.34, enemyDamage: 12, fireInterval: 2.7, timeLimit: 180 },
  { mapId: "snow", title: "Cold Signal", brief: "Engineers are repairing the comms mast at sunset. Keep it offline.", objective: "eliminate", defaultTime: "dusk", hostiles: 8, heavies: 2, civilians: 1, moveSpeed: 0.9, enemyAccuracy: 0.36, enemyDamage: 13, fireInterval: 2.6, timeLimit: 180 },
  { mapId: "snow", title: "Glacier King", brief: "The base commander is fleeing to the helipad under the northern moon.", objective: "vip", difficulty: "hard", defaultTime: "night", hostiles: 6, heavies: 3, civilians: 0, moveSpeed: 0.95, enemyAccuracy: 0.38, enemyDamage: 13, fireInterval: 2.5, timeLimit: 60 },
  { mapId: "snow", title: "Cold Extraction", brief: "Two captured scientists are held beside the radar dome. Their guards have orders to shoot at the first alarm.", objective: "rescue", difficulty: "hard", defaultTime: "night", hostages: 2, executeWindow: 14, hostiles: 3, heavies: 1, civilians: 0, moveSpeed: 0.9, enemyAccuracy: 0.36, enemyDamage: 13, fireInterval: 2.6, timeLimit: 180 },
  { mapId: "snow", title: "White Wolf", brief: "Volkov, a Spetsnaz ghost with a thermal scope, hunts the pass. Out-shoot the man who trained snipers.", objective: "boss", defaultTime: "dusk", bossName: "VOLKOV", bossTitle: "The White Wolf", bossHealth: 1300, hostiles: 4, heavies: 2, civilians: 0, moveSpeed: 0.95, enemyAccuracy: 0.38, enemyDamage: 13, fireInterval: 2.5, timeLimit: 240 },
  { mapId: "city", title: "Neon Rain", brief: "Gang lookouts hold the rooftops in the dead of night. Mind the civilians below.", objective: "eliminate", defaultTime: "night", hostiles: 8, heavies: 2, civilians: 5, moveSpeed: 0.95, enemyAccuracy: 0.38, enemyDamage: 13, fireInterval: 2.5, timeLimit: 190 },
  { mapId: "city", title: "Glass Tower", brief: "A kill team is preparing an evening ambush across the downtown skyline.", objective: "eliminate", difficulty: "hard", defaultTime: "dusk", hostiles: 9, heavies: 3, civilians: 4, moveSpeed: 1, enemyAccuracy: 0.4, enemyDamage: 14, fireInterval: 2.4, timeLimit: 190 },
  { mapId: "city", title: "Dragon's Wake", brief: "The syndicate boss steps out into daylight for thirty seconds. Make them count.", objective: "vip", difficulty: "hard", defaultTime: "day", hostiles: 7, heavies: 3, civilians: 5, moveSpeed: 1.05, enemyAccuracy: 0.42, enemyDamage: 14, fireInterval: 2.3, timeLimit: 55 },
  { mapId: "city", title: "Blackout", brief: "Three hostages, six captors, one power cut. The moment they hear a shot, the clock starts.", objective: "rescue", difficulty: "hard", defaultTime: "night", hostages: 3, executeWindow: 13, hostiles: 3, heavies: 1, civilians: 0, moveSpeed: 1, enemyAccuracy: 0.4, enemyDamage: 14, fireInterval: 2.4, timeLimit: 190 },
  { mapId: "city", title: "Dragon Head", brief: "Kaito Mori enforces the syndicate with a rail-scoped rifle and a private army. End the dynasty.", objective: "boss", defaultTime: "night", bossName: "KAITO MORI", bossTitle: "Syndicate Enforcer", bossHealth: 1500, hostiles: 5, heavies: 2, civilians: 0, moveSpeed: 1.05, enemyAccuracy: 0.42, enemyDamage: 14, fireInterval: 2.3, timeLimit: 260 },
  { mapId: "harbor", title: "Dead Cargo", brief: "Clear the container yard in the afternoon glare so the recovery team can move in.", objective: "eliminate", defaultTime: "day", hostiles: 9, heavies: 3, civilians: 2, moveSpeed: 1.05, enemyAccuracy: 0.42, enemyDamage: 15, fireInterval: 2.3, timeLimit: 200 },
  { mapId: "harbor", title: "Iron Tide", brief: "Heavy resistance on the docks at crimson dusk. Armoured targets confirmed.", objective: "eliminate", difficulty: "hard", defaultTime: "dusk", hostiles: 10, heavies: 4, civilians: 2, moveSpeed: 1.1, enemyAccuracy: 0.44, enemyDamage: 16, fireInterval: 2.2, timeLimit: 200 },
  { mapId: "harbor", title: "Human Cargo", brief: "Trafficked prisoners are being loaded onto the ship. Their guards will shoot them if you're spotted.", objective: "rescue", difficulty: "hard", defaultTime: "dusk", hostages: 3, executeWindow: 12, hostiles: 4, heavies: 2, civilians: 0, moveSpeed: 1.1, enemyAccuracy: 0.44, enemyDamage: 16, fireInterval: 2.2, timeLimit: 200 },
  { mapId: "harbor", title: "Last Light", brief: "His lieutenant boards the ship tonight. One shot under the harbour moon.", objective: "vip", difficulty: "hard", defaultTime: "night", hostiles: 8, heavies: 4, civilians: 1, moveSpeed: 1.15, enemyAccuracy: 0.46, enemyDamage: 16, fireInterval: 2.1, timeLimit: 50 },
  { mapId: "harbor", title: "The Architect", brief: "The man behind every war you've fought. Armoured, surrounded and waiting for you. Final operation.", objective: "boss", defaultTime: "night", bossName: "THE ARCHITECT", bossTitle: "Final Target", bossHealth: 1800, hostiles: 6, heavies: 3, civilians: 0, moveSpeed: 1.15, enemyAccuracy: 0.46, enemyDamage: 16, fireInterval: 2.1, timeLimit: 280 },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const SCENE_TIMES: TimeOfDay[] = ["day", "dusk", "night"];
function randomSceneForOperation(index: number, title: string): TimeOfDay {
  // Seeded pseudo-random assignment: visually varied but identical on retries.
  let seed = (index + 17) >>> 0;
  for (let i = 0; i < title.length; i += 1) {
    seed ^= title.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  seed = (Math.imul(seed ^ (seed >>> 16), 2246822519) >>> 0);
  return SCENE_TIMES[seed % SCENE_TIMES.length];
}

export const MISSIONS: Mission[] = MISSION_SCRIPT.map((mission, index) => {
  const difficulty: Difficulty = mission.objective === "boss" ? "boss" : mission.difficulty ?? "normal";
  const hard = difficulty === "hard";
  const base = 250 + index * 90 + (mission.objective === "vip" ? 200 : 0) + (mission.objective === "rescue" ? 300 : 0) + (mission.objective === "boss" ? 700 : 0);
  return {
    ...mission,
    defaultTime: randomSceneForOperation(index, mission.title),
    difficulty,
    enemyAccuracy: hard ? mission.enemyAccuracy * 1.15 : mission.enemyAccuracy,
    fireInterval: hard ? mission.fireInterval * 0.85 : mission.fireInterval,
    id: slug(mission.title),
    index,
    reward: Math.round(base * (hard ? 1.35 : 1)),
  };
});

export const GUNS: GunDef[] = [
  {
    id: "warden",
    name: "M24 Warden",
    tag: "STARTER",
    kind: "Bolt-action",
    description: "Reliable, forgiving and accurate. The rifle every marksman learns on.",
    price: 0,
    damage: 100,
    magSize: 5,
    reserve: 20,
    fireDelay: 1.15,
    reloadTime: 2.2,
    zoomLevels: [2, 4, 6],
    stability: 0.55,
    penetration: 1,
    recoil: 0.05,
    suppressed: false,
    thermal: false,
    sound: "bolt",
    model: { body: 0x4b4a36, accent: 0x8a6f45, metal: 0x23272a, barrel: 1.1, stock: "classic", scopeLen: 0.44, suppressor: false, bipod: false, muzzleBrake: false, wood: true },
  },
  {
    id: "tundra",
    name: "Tundra LRS",
    tag: "MARKSMAN",
    kind: "Bolt-action .308",
    description: "Lighter and steadier than the Warden, with a warmer, more consistent bore.",
    price: 900,
    damage: 108,
    magSize: 5,
    reserve: 25,
    fireDelay: 1.1,
    reloadTime: 2.1,
    zoomLevels: [2, 4, 8],
    stability: 0.62,
    penetration: 1,
    recoil: 0.045,
    suppressed: false,
    thermal: false,
    sound: "bolt",
    model: { body: 0x3d4a3a, accent: 0x6b7a52, metal: 0x1f2326, barrel: 1.18, stock: "classic", scopeLen: 0.48, suppressor: false, bipod: false, muzzleBrake: true, wood: true },
  },
  {
    id: "hornet",
    name: "SR-25 Hornet",
    tag: "SEMI-AUTO",
    kind: "Designated marksman",
    description: "Fast follow-up shots and a deep magazine. Body shots need two rounds on most targets.",
    price: 1800,
    damage: 80,
    magSize: 10,
    reserve: 40,
    fireDelay: 0.3,
    reloadTime: 2.5,
    zoomLevels: [2, 4, 8],
    stability: 0.45,
    penetration: 1,
    recoil: 0.035,
    suppressed: false,
    thermal: false,
    sound: "semi",
    model: { body: 0x2a2d2c, accent: 0x5f6b58, metal: 0x1b1e20, barrel: 0.95, stock: "skeleton", scopeLen: 0.38, suppressor: false, bipod: false, muzzleBrake: true },
  },
  {
    id: "ghost",
    name: "VSS Ghost",
    tag: "SUPPRESSED",
    kind: "Integrated suppressor",
    description: "Whisper-quiet. Kills do not alert distant hostiles — only those who see the body.",
    price: 3200,
    damage: 100,
    magSize: 10,
    reserve: 30,
    fireDelay: 0.45,
    reloadTime: 2.3,
    zoomLevels: [2, 4, 6],
    stability: 0.68,
    penetration: 1,
    recoil: 0.025,
    suppressed: true,
    thermal: false,
    sound: "suppressed",
    model: { body: 0x39332b, accent: 0x6d5236, metal: 0x1d1f21, barrel: 0.7, stock: "classic", scopeLen: 0.34, suppressor: true, bipod: false, muzzleBrake: false, wood: true },
  },
  {
    id: "vandal",
    name: "Vandal DMR",
    tag: "BATTLE RIFLE",
    kind: "Semi-auto .308",
    description: "Heavier round than the Hornet with almost the same rate of fire. Punches through two bodies.",
    price: 4200,
    damage: 120,
    magSize: 12,
    reserve: 48,
    fireDelay: 0.34,
    reloadTime: 2.4,
    zoomLevels: [2, 5, 9],
    stability: 0.6,
    penetration: 2,
    recoil: 0.042,
    suppressed: false,
    thermal: false,
    sound: "semi",
    model: { body: 0x3b3f34, accent: 0x6b6f52, metal: 0x1d2022, barrel: 1.05, stock: "skeleton", scopeLen: 0.44, suppressor: false, bipod: false, muzzleBrake: true },
  },
  {
    id: "kestrel",
    name: "AWM Kestrel",
    tag: "MAGNUM",
    kind: "Long-range bolt",
    description: "A .338 Lapua beast. Punches through armour and the man standing behind it.",
    price: 5200,
    damage: 160,
    magSize: 5,
    reserve: 25,
    fireDelay: 1.3,
    reloadTime: 2.7,
    zoomLevels: [3, 6, 10],
    stability: 0.82,
    penetration: 2,
    recoil: 0.07,
    suppressed: false,
    thermal: false,
    sound: "bolt",
    model: { body: 0x5d6a3f, accent: 0x2b2f24, metal: 0x1f2224, barrel: 1.25, stock: "bullpup", scopeLen: 0.5, suppressor: false, bipod: true, muzzleBrake: true },
  },
  {
    id: "specter",
    name: "Specter-S",
    tag: "GHOST OPS",
    kind: "Suppressed DMR",
    description: "A silenced battle rifle with a 14-round magazine — surgical work at any distance.",
    price: 6400,
    damage: 125,
    magSize: 14,
    reserve: 42,
    fireDelay: 0.4,
    reloadTime: 2.6,
    zoomLevels: [2, 5, 10],
    stability: 0.74,
    penetration: 2,
    recoil: 0.03,
    suppressed: true,
    thermal: false,
    sound: "suppressed",
    model: { body: 0x24282a, accent: 0x3f5a5a, metal: 0x191c1e, barrel: 0.9, stock: "skeleton", scopeLen: 0.46, suppressor: true, bipod: false, muzzleBrake: false },
  },
  {
    id: "wyvern",
    name: "Wyvern .408",
    tag: "EXTREME RANGE",
    kind: "Bolt-action .408",
    description: "Built for one shot at extreme distance. Thumbhole stock and a 12× optic.",
    price: 7200,
    damage: 200,
    magSize: 4,
    reserve: 20,
    fireDelay: 1.45,
    reloadTime: 2.9,
    zoomLevels: [4, 8, 12],
    stability: 0.74,
    penetration: 3,
    recoil: 0.09,
    suppressed: false,
    thermal: false,
    sound: "bolt",
    model: { body: 0x2f3a3a, accent: 0x596b5f, metal: 0x191c1d, barrel: 1.35, stock: "thumbhole", scopeLen: 0.58, suppressor: false, bipod: true, muzzleBrake: true },
  },
  {
    id: "titan",
    name: "M82 Titan",
    tag: "ANTI-MATERIEL",
    kind: ".50 BMG semi-auto",
    description: "Absurd power. Anything it touches goes down, along with the next three things behind it.",
    price: 9000,
    damage: 260,
    magSize: 8,
    reserve: 24,
    fireDelay: 0.75,
    reloadTime: 3.2,
    zoomLevels: [4, 8, 14],
    stability: 0.6,
    penetration: 4,
    recoil: 0.11,
    suppressed: false,
    thermal: false,
    sound: "heavy",
    model: { body: 0x2c2f33, accent: 0x5a5e62, metal: 0x16181a, barrel: 1.4, stock: "heavy", scopeLen: 0.56, suppressor: false, bipod: true, muzzleBrake: true },
  },
  {
    id: "kraken",
    name: "Kraken AMR",
    tag: "SIEGE",
    kind: "Bolt anti-materiel",
    description: "A drum-fed monster with a belt of .50 calibre hate. Five targets, one bullet.",
    price: 12000,
    damage: 300,
    magSize: 5,
    reserve: 20,
    fireDelay: 1.6,
    reloadTime: 3.4,
    zoomLevels: [5, 10, 16],
    stability: 0.55,
    penetration: 5,
    recoil: 0.14,
    suppressed: false,
    thermal: false,
    sound: "heavy",
    model: { body: 0x4a4a3a, accent: 0x2c2c22, metal: 0x151718, barrel: 1.5, stock: "lmg", scopeLen: 0.62, suppressor: false, bipod: true, muzzleBrake: true, cased: true },
  },
  {
    id: "nova",
    name: "NOVA Rail-X",
    tag: "PROTOTYPE",
    kind: "Electromagnetic rail",
    description: "Experimental coil rifle with built-in thermal optics. Pierces everything in a line.",
    price: 15000,
    damage: 320,
    magSize: 4,
    reserve: 20,
    fireDelay: 0.9,
    reloadTime: 2.4,
    zoomLevels: [4, 8, 16],
    stability: 0.9,
    penetration: 6,
    recoil: 0.06,
    suppressed: false,
    thermal: true,
    sound: "rail",
    model: { body: 0xd8dde3, accent: 0x31d5ff, metal: 0x20252c, barrel: 1.2, stock: "future", scopeLen: 0.52, suppressor: false, bipod: false, muzzleBrake: false },
  },
  {
    id: "aurora",
    name: "Aurora MK-V",
    tag: "BLACK BUDGET",
    kind: "Coil-assisted bolt",
    description: "An impossible prototype: 20× glass, four hundred metres of penetration, almost no sway.",
    price: 20000,
    damage: 400,
    magSize: 4,
    reserve: 16,
    fireDelay: 1.0,
    reloadTime: 2.2,
    zoomLevels: [6, 12, 20],
    stability: 0.95,
    penetration: 6,
    recoil: 0.05,
    suppressed: false,
    thermal: true,
    sound: "rail",
    model: { body: 0x2a2f38, accent: 0x7cf3d0, metal: 0x1a1e24, barrel: 1.25, stock: "future", scopeLen: 0.6, suppressor: false, bipod: false, muzzleBrake: false, cased: true },
  },
];

export const ITEMS: ItemDef[] = [
  { id: "medkit", name: "Field Medkit", key: "1", description: "Restores 50 health instantly.", price: 150, color: "#e25b5b" },
  { id: "adrenaline", name: "Adrenaline Shot", key: "2", description: "Slows time to 35% for 6 seconds.", price: 260, color: "#f2c14e" },
  { id: "thermal", name: "Thermal Charge", key: "3", description: "Reveals hostiles (red) and civilians (green) for 9 seconds.", price: 220, color: "#ff7a3d" },
  { id: "ammo", name: "Ammo Crate", key: "4", description: "Adds two full magazines to your reserve.", price: 90, color: "#9ecf7a" },
];

export const UPGRADES: UpgradeDef[] = [
  { id: "armor", name: "Ceramic Plating", description: "Reduces incoming damage.", effect: "-12% damage per level", prices: [600, 1400, 2800] },
  { id: "steady", name: "Steady Hands", description: "Reduces scope sway on every rifle.", effect: "-15% sway per level", prices: [500, 1200, 2500] },
  { id: "reload", name: "Speed Loader", description: "Faster magazine changes.", effect: "-12% reload per level", prices: [450, 1100, 2300] },
  { id: "lungs", name: "Iron Lungs", description: "Hold your breath for longer.", effect: "+30% breath per level", prices: [400, 1000, 2100] },
  { id: "bounty", name: "Contract Bonus", description: "Earn more coins from every mission.", effect: "+15% coins per level", prices: [800, 1800, 3600] },
];

export function getMap(id: MapId) {
  return MAPS.find((map) => map.id === id) ?? MAPS[0];
}

export function getGun(id: string) {
  return GUNS.find((gun) => gun.id === id) ?? GUNS[0];
}

export const TIME_OPTIONS: Array<{ id: TimeOfDay; label: string; sub: string }> = [
  { id: "day", label: "DIN · DAY", sub: "13:15 · Clear Sun" },
  { id: "dusk", label: "SHAAM · DUSK", sub: "18:40 · Golden Sunset" },
  { id: "night", label: "RAAT · NIGHT", sub: "01:30 · Moon & Stars" },
];

export function getTimePreset(map: MapDef, tod: TimeOfDay): TimePreset {
  if (tod === "day") {
    const isSnow = map.id === "snow";
    const isDesert = map.id === "desert";
    return {
      id: "day",
      name: "Day",
      hindiName: "DIN · DAY",
      clock: "13:15",
      skyTop: isDesert ? 0x2c6db0 : isSnow ? 0x4b7cb5 : 0x3272b8,
      skyHorizon: isDesert ? 0xe8cfb0 : isSnow ? 0xdde8f4 : 0xbfd9ec,
      fog: isDesert ? 0xdcc09c : isSnow ? 0xcfdbe6 : 0xaac2d4,
      fogDensity: map.fogDensity * 0.65,
      hemiSky: 0xebf4ff,
      hemiGround: isDesert ? 0x8a6d4b : isSnow ? 0x9aaaba : 0x4b5848,
      hemiIntensity: 1.55,
      sunColor: isDesert ? 0xfff0d2 : 0xfff8e8,
      sunIntensity: 3.4,
      sunPos: [22, 34, -24],
      exposure: isSnow ? 0.96 : 1.12,
      windowGlow: 0.04,
      lampIntensity: 0,
      starOpacity: 0,
      cloudOpacity: 0.72,
      cloudColor: 0xffffff,
      celestialColor: 0xfffbe6,
      celestialSize: 7.5,
      isNight: false,
    };
  }

  if (tod === "dusk") {
    return {
      id: "dusk",
      name: "Dusk",
      hindiName: "SHAAM · DUSK",
      clock: "18:45",
      skyTop: map.id === "city" ? 0x1a1538 : 0x282142,
      skyHorizon: map.id === "snow" ? 0xd9846c : 0xf0834e,
      fog: map.id === "snow" ? 0x8e6b74 : map.id === "marsh" ? 0x5c3e36 : 0x915548,
      fogDensity: map.fogDensity * 0.9,
      hemiSky: 0xffb380,
      hemiGround: 0x332428,
      hemiIntensity: 1.35,
      sunColor: 0xff8a47,
      sunIntensity: 2.8,
      sunPos: [-32, 11, -55],
      exposure: 1.15,
      windowGlow: 0.65,
      lampIntensity: 9,
      starOpacity: 0.35,
      cloudOpacity: 0.62,
      cloudColor: 0xff9f6b,
      celestialColor: 0xffb169,
      celestialSize: 10.5,
      isNight: false,
    };
  }

  // RAAT (Night)
  return {
    id: "night",
    name: "Night",
    hindiName: "RAAT · NIGHT",
    clock: "01:30",
    skyTop: 0x03060c,
    skyHorizon: map.id === "city" ? 0x18132e : map.id === "marsh" ? 0x0e1c1c : 0x0d1828,
    fog: map.id === "city" ? 0x100e22 : map.id === "marsh" ? 0x0e1918 : 0x0d1522,
    fogDensity: map.fogDensity * 1.12,
    hemiSky: 0x7b98c4,
    hemiGround: 0x11151c,
    hemiIntensity: 1.05,
    sunColor: 0x9ec0f5,
    sunIntensity: 1.65,
    sunPos: [-18, 24, -20],
    exposure: 1.24,
    windowGlow: 1.25,
    lampIntensity: 16,
    starOpacity: 0.95,
    cloudOpacity: 0.2,
    cloudColor: 0x3b4d6b,
    celestialColor: 0xe6edf8,
    celestialSize: 6.8,
    isNight: true,
  };
}
