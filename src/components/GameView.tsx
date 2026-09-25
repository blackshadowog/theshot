import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../game/audio";
import { ITEMS, MISSIONS, getGun, getMap, type ItemDef, type TimeOfDay } from "../game/data";
import { SniperEngine, type EndInfo, type KillInfo } from "../game/engine";
import type { SaveData, Settings } from "../game/save";
import { CoinBadge, Icon, Stars } from "./Icons";
import SettingsPanel from "./SettingsPanel";

export interface MissionResult {
  missionIndex: number;
  success: boolean;
  reason: string;
  kills: number;
  headshots: number;
  shots: number;
  hits: number;
  longest: number;
  score: number;
  stars: number;
  coins: number;
  health: number;
  timeUsed: number;
  civilians: number;
  breakdown: Array<[string, number]>;
}

interface Props {
  save: SaveData;
  missionIndex: number;
  initialTimeOfDay?: TimeOfDay;
  onExit: (to: "menu" | "armory" | "missions") => void;
  onRetry: () => void;
  onNext: () => void;
  onComplete: (result: MissionResult) => void;
  onConsumeItem: (id: ItemDef["id"]) => boolean;
  onSettings: (patch: Partial<Settings>) => void;
}

type Phase = "briefing" | "countdown" | "playing" | "paused" | "ended";
interface FeedEntry { id: number; text: string; score: number; tone: "head" | "body" | "civ" | "armor" }
interface Banner { id: number; text: string; sub?: string; tone: "gold" | "red" | "blue" }

export default function GameView({ save, missionIndex, initialTimeOfDay, onExit, onRetry, onNext, onComplete, onConsumeItem, onSettings }: Props) {
  const mission = MISSIONS[missionIndex];
  const map = getMap(mission.mapId);
  const gun = getGun(save.equipped);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SniperEngine | null>(null);
  const [phase, setPhase] = useState<Phase>("briefing");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(initialTimeOfDay ?? mission.defaultTime);
  const phaseRef = useRef<Phase>("briefing");
  phaseRef.current = phase;
  const [count, setCount] = useState(3);
  const [ammo, setAmmo] = useState({ mag: gun.magSize, reserve: gun.reserve, reloading: false });
  const [health, setHealth] = useState(100);
  const [objective, setObjective] = useState({ remaining: mission.hostiles, total: mission.hostiles });
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: string; id: number } | null>(null);
  const [hitMarker, setHitMarker] = useState<{ id: number; head: boolean } | null>(null);
  const [damageKey, setDamageKey] = useState(0);
  const [alerted, setAlerted] = useState(false);
  const [killcam, setKillcam] = useState(false);
  const [scoped, setScoped] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [thermal, setThermal] = useState(false);
  const [slowmo, setSlowmo] = useState(false);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const stats = useRef({ kills: 0, headshots: 0, shots: 0, hits: 0, longest: 0, score: 0, civilians: 0 });
  const feedId = useRef(0);
  const pausedAt = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  const rangeRef = useRef<HTMLSpanElement>(null);
  const scopeRangeRef = useRef<HTMLSpanElement>(null);
  const breathRef = useRef<HTMLDivElement>(null);
  const windRef = useRef<HTMLSpanElement>(null);
  const windArrowRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const reloadRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const breathLabelRef = useRef<HTMLSpanElement>(null);
  const bossFillRef = useRef<HTMLDivElement>(null);
  const bossHpRef = useRef<HTMLSpanElement>(null);
  const bossPhaseRef = useRef<HTMLSpanElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const hostagesRef = useRef<HTMLSpanElement>(null);

  const pushFeed = useCallback((text: string, s: number, tone: FeedEntry["tone"]) => {
    const id = ++feedId.current;
    setFeed((f) => [{ id, text, score: s, tone }, ...f].slice(0, 5));
    window.setTimeout(() => setFeed((f) => f.filter((e) => e.id !== id)), 4200);
  }, []);

  const showBanner = useCallback((text: string, sub: string | undefined, tone: Banner["tone"]) => {
    const id = Date.now() + Math.random();
    setBanner({ id, text, sub, tone });
    window.setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), 1500);
  }, []);

  const showToast = useCallback((text: string, tone = "info") => {
    const id = Date.now();
    setToast({ text, tone, id });
    window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 1800);
  }, []);

  const finishMission = useCallback(
    (info: EndInfo) => {
      const s = stats.current;
      const accuracy = s.shots ? s.hits / s.shots : 0;
      let stars = 0;
      if (info.success) {
        stars = 1 + (accuracy >= 0.7 ? 1 : 0) + (info.health >= 70 ? 1 : 0);
      }
      const bounty = 1 + saveRef.current.upgrades.bounty * 0.15;
      const breakdown: Array<[string, number]> = [];
      if (info.success) {
        breakdown.push(["Contract reward", Math.round(mission.reward * (0.6 + stars * 0.2))]);
        breakdown.push([`Confirmed kills ×${s.kills}`, s.kills * 25]);
        breakdown.push([`Headshots ×${s.headshots}`, s.headshots * 20]);
        if (s.longest > 50) breakdown.push(["Long-range bonus", Math.round((s.longest - 50) * 2)]);
        if (info.rescued > 0) breakdown.push([`Hostages rescued ×${info.rescued}`, info.rescued * 180]);
        if (info.bossKilled) breakdown.push([`Bounty · ${mission.bossName ?? "Warlord"}`, 900 + mission.index * 40]);
        if (mission.difficulty === "hard") breakdown.push(["Hard operation bonus", 250]);
      } else {
        breakdown.push([`Kills ×${s.kills} (partial pay)`, s.kills * 10]);
        breakdown.push([`Headshots ×${s.headshots}`, s.headshots * 5]);
      }
      if (bounty > 1) {
        const sub = breakdown.reduce((a, [, v]) => a + v, 0);
        breakdown.push([`Contract bonus +${Math.round((bounty - 1) * 100)}%`, Math.round(sub * (bounty - 1))]);
      }
      const coins = breakdown.reduce((a, [, v]) => a + v, 0);
      const res: MissionResult = {
        missionIndex,
        success: info.success,
        reason: info.reason,
        kills: s.kills,
        headshots: s.headshots,
        shots: s.shots,
        hits: s.hits,
        longest: s.longest,
        score: s.score,
        stars,
        coins,
        health: info.health,
        timeUsed: info.timeUsed,
        civilians: s.civilians,
        breakdown,
      };
      window.setTimeout(
        () => {
          audio.playMusic("off");
          audio.stinger(info.success);
          window.setTimeout(() => audio.playMusic("menu", map.musicRoot), 2600);
          setResult(res);
          setPhase("ended");
          onComplete(res);
        },
        info.success ? 300 : 1300,
      );
    },
    [map.musicRoot, mission, missionIndex, onComplete],
  );

  // create engine
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: SniperEngine;
    try {
      engine = new SniperEngine(host, map, mission, gun, saveRef.current, {
        onAmmo: (mag, reserve, reloading) => setAmmo({ mag, reserve, reloading }),
        onHealth: (hp, damaged) => {
          setHealth(hp);
          if (damaged) setDamageKey((k) => k + 1);
        },
        onShot: (hits) => {
          stats.current.shots += 1;
          if (hits > 0) stats.current.hits += 1;
        },
        onKill: (info: KillInfo) => {
          const s = stats.current;
          s.score += info.score;
          setScore(s.score);
          if (info.kind === "civilian") {
            s.civilians += 1;
            pushFeed("CIVILIAN CASUALTY", info.score, "civ");
            showBanner("CIVILIAN DOWN", "Mission compromised", "red");
            return;
          }
          s.kills += 1;
          if (info.headshot) s.headshots += 1;
          s.longest = Math.max(s.longest, info.distance);
          setHitMarker({ id: Date.now(), head: info.headshot });
          if (info.kind === "hostage") {
            pushFeed("HOSTAGE KILLED", info.score, "civ");
            showBanner("HOSTAGE DOWN", "Mission failed", "red");
            return;
          }
          if (info.kind === "boss") {
            showBanner(`${mission.bossName ?? "WARLORD"} ELIMINATED`, `${Math.round(info.distance)}m · bounty claimed`, "gold");
          }
          const label = `${info.kind === "boss" ? "BOSS DOWN" : info.kind === "vip" ? "VIP ELIMINATED" : info.kind === "heavy" ? "HEAVY DOWN" : info.headshot ? "HEADSHOT" : "KILL"} · ${Math.round(info.distance)}m`;
          pushFeed(label, info.score, info.headshot ? "head" : "body");
          if (info.multi > 1) showBanner(info.multi === 2 ? "DOUBLE KILL" : "COLLATERAL", `${info.multi} targets · one bullet`, "gold");
          else if (info.distance > 55) showBanner("LONG SHOT", `${Math.round(info.distance)} metres`, "blue");
          else if (info.headshot) showBanner("HEADSHOT", `+${info.score}`, "gold");
        },
        onArmorHit: (distance) => {
          setHitMarker({ id: Date.now(), head: false });
          pushFeed(`ARMOUR HIT · ${Math.round(distance)}m`, 0, "armor");
        },
        onAlert: () => {
          setAlerted(true);
          audio.playMusic(mission.objective === "boss" ? "boss" : "alert", map.musicRoot);
          if (mission.objective !== "rescue") showBanner("POSITION COMPROMISED", "Hostiles are returning fire", "red");
        },
        onExecutionAlert: (seconds) => {
          audio.alarm();
          showBanner("EXECUTION IMMINENT", `Kill every captor · ${seconds}s`, "red");
        },
        onBossHit: (damage, headshot, brokeLock) => {
          setHitMarker({ id: Date.now(), head: headshot });
          pushFeed(`${headshot ? "VISOR HIT" : "ARMOUR HIT"} · −${damage}`, 0, headshot ? "head" : "armor");
          if (brokeLock) showBanner("LOCK BROKEN", headshot ? "Weak point struck" : "He's repositioning", "blue");
        },
        onBossPhase: (phase) => {
          showBanner(`PHASE ${phase}`, phase === 3 ? "He's desperate — heavies inbound" : "Reinforcements inbound", "red");
        },
        onBossShot: () => {
          pushFeed(`${mission.bossName ?? "BOSS"} HIT YOU`, 0, "civ");
        },
        onObjective: (remaining, total) => setObjective({ remaining, total }),
        onToast: (message, tone) => showToast(message, tone),
        onKillcam: (active) => setKillcam(active),
        onEnd: (info) => finishMission(info),
        onLockLost: () => {
          if (phaseRef.current === "playing") {
            pausedAt.current = performance.now();
            engine.setPaused(true);
            setPhase("paused");
          }
        },
        onTimeOfDay: (tod) => setTimeOfDay(tod),
      }, initialTimeOfDay ?? mission.defaultTime);
    } catch {
      showToast("WebGL is unavailable in this browser", "warn");
      return;
    }
    engineRef.current = engine;
    audio.startAmbient(map.weather === "rain" ? "rain" : map.weather === "fireflies" ? "calm" : "wind");

    let raf = 0;
    let lastScoped = false;
    let lastZoom = 0;
    let lastThermal = false;
    let lastSlow = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = engine.getTelemetry();
      if (t.scoped !== lastScoped) {
        lastScoped = t.scoped;
        setScoped(t.scoped);
      }
      if (t.zoomIndex !== lastZoom) {
        lastZoom = t.zoomIndex;
        setZoomIdx(t.zoomIndex);
      }
      const th = t.thermal > 0;
      if (th !== lastThermal) {
        lastThermal = th;
        setThermal(th);
      }
      const sl = t.slowmo > 0;
      if (sl !== lastSlow) {
        lastSlow = sl;
        setSlowmo(sl);
      }
      const rangeText = t.range === null ? "----" : `${t.range.toFixed(1)}`;
      if (rangeRef.current) rangeRef.current.textContent = rangeText;
      if (scopeRangeRef.current) scopeRangeRef.current.textContent = rangeText;
      if (breathRef.current) {
        breathRef.current.style.width = `${(t.breath / t.breathMax) * 100}%`;
        breathRef.current.dataset.state = t.gasping ? "gasp" : t.holding ? "hold" : "idle";
      }
      if (breathLabelRef.current) breathLabelRef.current.textContent = t.gasping ? "RECOVERING" : t.holding ? "HOLDING" : "SHIFT · HOLD BREATH";
      if (windRef.current) windRef.current.textContent = Math.abs(t.wind).toFixed(1);
      if (windArrowRef.current) windArrowRef.current.style.transform = `scaleX(${t.wind >= 0 ? 1 : -1})`;
      if (timerRef.current) {
        const s = Math.max(0, Math.ceil(t.timeLeft));
        timerRef.current.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        timerRef.current.dataset.low = s <= 20 ? "1" : "0";
      }
      if (reloadRef.current) reloadRef.current.style.setProperty("--p", `${t.reloadProgress * 100}`);
      if (readyRef.current) readyRef.current.style.transform = `scaleX(${t.fireReady})`;
      if (targetRef.current) {
        const k = t.thermal ? t.targetKind : null;
        targetRef.current.textContent =
          k === "civilian" ? "CIVILIAN — HOLD FIRE" : k === "hostage" ? "HOSTAGE — HOLD FIRE" : k === "vip" ? "HIGH-VALUE TARGET" : k === "boss" ? "BOSS — AIM FOR THE VISOR" : k ? "HOSTILE" : "";
        targetRef.current.dataset.kind = k ?? "";
      }
      const b = t.boss;
      if (b) {
        if (bossFillRef.current) bossFillRef.current.style.width = `${(b.hp / b.max) * 100}%`;
        if (bossHpRef.current) bossHpRef.current.textContent = `${Math.ceil(b.hp)} / ${b.max}`;
        if (bossPhaseRef.current) bossPhaseRef.current.textContent = `PHASE ${b.phase}`;
      }
      if (lockRef.current) {
        const active = !!b && b.lock >= 0;
        lockRef.current.dataset.active = active ? "1" : "0";
        lockRef.current.style.setProperty("--lock", String(active ? b!.lock : 0));
      }
      if (hostagesRef.current) hostagesRef.current.textContent = String(t.hostagesAlive);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
      audio.stopAmbient();
      audio.setSlowMo(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setSettings(save.settings);
  }, [save.settings]);

  const deploy = () => {
    audio.ensure();
    audio.ui();
    engineRef.current?.requestLock();
    setPhase("countdown");
    setCount(3);
    audio.playMusic(mission.objective === "boss" ? "boss" : "stealth", map.musicRoot);
    let c = 3;
    const iv = window.setInterval(() => {
      c -= 1;
      if (c <= 0) {
        window.clearInterval(iv);
        setPhase("playing");
        engineRef.current?.start();
        audio.zoom();
      } else {
        setCount(c);
        audio.zoom();
      }
    }, 700);
  };

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    pausedAt.current = performance.now();
    engineRef.current?.setPaused(true);
    setPhase("paused");
    audio.ui();
  }, []);

  const resume = useCallback(() => {
    engineRef.current?.requestLock();
    engineRef.current?.setPaused(false);
    setShowSettings(false);
    setPhase("playing");
    audio.ui();
  }, []);

  const useItem = useCallback(
    (id: ItemDef["id"]) => {
      const engine = engineRef.current;
      if (!engine || phaseRef.current !== "playing") return;
      if (id === "medkit" && engine.getHealth() >= 100) return showToast("Health already full");
      if (!onConsumeItem(id)) {
        audio.error();
        return showToast("None left — buy more in the Armory", "warn");
      }
      if (id === "medkit") {
        engine.heal(50);
        audio.coin();
        showToast("+50 HEALTH", "good");
      } else if (id === "adrenaline") {
        engine.activateSlowmo(6);
        showToast("ADRENALINE — TIME SLOWED", "good");
      } else if (id === "thermal") {
        engine.activateThermal(9);
        audio.zoom();
        showToast("THERMAL ACTIVE", "good");
      } else {
        engine.addAmmo(gun.magSize * 2);
        audio.bolt();
        showToast(`+${gun.magSize * 2} ROUNDS`, "good");
      }
    },
    [gun.magSize, onConsumeItem, showToast],
  );

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        if (phaseRef.current === "playing") pause();
        else if (phaseRef.current === "paused" && performance.now() - pausedAt.current > 400) resume();
        return;
      }
      if (phaseRef.current === "briefing" && (e.code === "Enter" || e.code === "Space")) {
        e.preventDefault();
        deploy();
        return;
      }
      if (phaseRef.current !== "playing") return;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") engine.setHoldBreath(true);
      if (e.repeat) return;
      switch (e.code) {
        case "Space":
        case "KeyF":
          e.preventDefault();
          engine.fire();
          break;
        case "KeyR":
          engine.reload();
          break;
        case "KeyQ":
        case "KeyE":
          engine.toggleScope();
          break;
        case "KeyZ":
          engine.cycleZoom();
          break;
        case "Digit1":
          useItem("medkit");
          break;
        case "Digit2":
          useItem("adrenaline");
          break;
        case "Digit3":
          useItem("thermal");
          break;
        case "Digit4":
          useItem("ammo");
          break;
        default:
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") engineRef.current?.setHoldBreath(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause, resume, useItem]);

  const accuracy = stats.current.shots ? Math.round((stats.current.hits / stats.current.shots) * 100) : 0;
  const zoomValue = gun.zoomLevels[zoomIdx];
  const hudVisible = phase === "playing" && !killcam;

  return (
    <div className={`screen game-screen${thermal ? " thermal" : ""}${slowmo ? " slowmo" : ""}`}>
      <div ref={hostRef} className="game-host" style={{ filter: health < 35 && phase === "playing" ? `saturate(${0.35 + health / 60})` : undefined }} />

      <div className="vignette" />
      <div className="damage-vignette" style={{ opacity: phase === "playing" ? Math.max(0, (60 - health) / 80) : 0 }} />
      {damageKey > 0 && <div key={damageKey} className="damage-flash" />}
      {slowmo && <div className="slowmo-overlay" />}
      {thermal && <div className="thermal-overlay" />}
      {mission.objective === "boss" && (phase === "playing" || phase === "paused") && !killcam && (
        <div ref={lockRef} className="lock-warning" data-active="0" aria-live="polite">
          <div className="lock-edge" />
          <div className="lock-panel">
            <strong>⚠ SNIPER LOCK</strong>
            <span>Hit {mission.bossName} to break it</span>
            <div className="lock-track"><b /></div>
          </div>
        </div>
      )}

      {/* SCOPE */}
      {scoped && hudVisible && (
        <div className="scope-overlay" key={`scope-${zoomIdx}`}>
          <div className="scope-mask" />
          <div className="scope-lens">
            <svg className="reticle" viewBox="-100 -100 200 200" aria-hidden="true">
              <line x1="-100" y1="0" x2="-6" y2="0" />
              <line x1="6" y1="0" x2="100" y2="0" />
              <line x1="0" y1="-100" x2="0" y2="-6" />
              <line x1="0" y1="6" x2="0" y2="100" />
              <line x1="-100" y1="0" x2="-55" y2="0" className="thick" />
              <line x1="55" y1="0" x2="100" y2="0" className="thick" />
              <line x1="0" y1="55" x2="0" y2="100" className="thick" />
              {[-40, -30, -20, -10, 10, 20, 30, 40].map((v) => (
                <g key={v}>
                  <circle cx={v} cy="0" r="1.1" />
                  <circle cx="0" cy={v} r="1.1" />
                </g>
              ))}
              {[10, 20, 30, 40].map((v) => (
                <g key={`h${v}`}>
                  <line x1={-4 + (v / 10) * 0} y1={v} x2={4} y2={v} className="tick" />
                  <text x="7" y={v + 2}>{v / 10}</text>
                </g>
              ))}
              <circle cx="0" cy="0" r="0.9" className="dot" />
            </svg>
            <div className="lens-glare" />
          </div>
          <div className="scope-readouts">
            <div className="scope-left">
              <div className="sr-label">RANGE</div>
              <div className="sr-value"><span ref={scopeRangeRef}>----</span><small>m</small></div>
              <div className="sr-label">WIND</div>
              <div className="sr-value wind"><span ref={windArrowRef} className="wind-arrow">➜</span><span ref={windRef}>0.0</span><small>m/s</small></div>
            </div>
            <div className="scope-right">
              <div className="sr-label">MAGNIFICATION</div>
              <div className="sr-value">{zoomValue.toFixed(1)}<small>×</small></div>
              <div className="zoom-steps">
                {gun.zoomLevels.map((z, i) => <span key={z} className={i === zoomIdx ? "on" : ""}>{z}×</span>)}
              </div>
              <div className="sr-hint">WHEEL / Z</div>
            </div>
            <div className="scope-bottom">
              <span ref={breathLabelRef} className="breath-label">SHIFT · HOLD BREATH</span>
              <div className="breath-track"><div ref={breathRef} className="breath-fill" /></div>
              <span ref={targetRef} className="target-id" />
            </div>
          </div>
        </div>
      )}

      {/* HIP CROSSHAIR */}
      {hudVisible && !scoped && (
        <div className="crosshair" aria-hidden="true">
          <span className="ch t" /><span className="ch b" /><span className="ch l" /><span className="ch r" /><span className="ch-dot" />
        </div>
      )}
      {hitMarker && hudVisible && (
        <div key={hitMarker.id} className={`hit-marker${hitMarker.head ? " head" : ""}`} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      )}

      {/* HUD */}
      {(phase === "playing" || phase === "paused") && !killcam && (
        <div className="hud">
          <div className="hud-top">
            <div className="hud-mission">
              <span className="eyebrow">OP {String(mission.index + 1).padStart(2, "0")} · {map.name.toUpperCase()}</span>
              <strong>{mission.title}</strong>
              <span className={`hud-tod-btn tod-${timeOfDay}`} title="Scene randomly assigned to this operation">
                {timeOfDay === "day" ? "☀ DIN · DAY" : timeOfDay === "dusk" ? "◐ SHAAM · DUSK" : "☾ RAAT · NIGHT"}
                <i>RANDOM SCENE</i>
              </span>
            </div>
            {mission.objective === "boss" ? (
              <div className="boss-bar">
                <div className="boss-bar-head">
                  <span className="boss-skull"><Icon name="skull" /></span>
                  <div>
                    <strong>{mission.bossName}</strong>
                    <small>{mission.bossTitle}</small>
                  </div>
                  <span ref={bossPhaseRef} className="boss-phase">PHASE 1</span>
                </div>
                <div className="boss-track">
                  <div ref={bossFillRef} className="boss-fill" />
                  <i style={{ left: "33%" }} />
                  <i style={{ left: "66%" }} />
                </div>
                <div className="boss-foot">
                  <span ref={bossHpRef}>—</span>
                  <span>VISOR = WEAK POINT · HIT HIM TO BREAK THE LOCK</span>
                </div>
              </div>
            ) : (
              <div className={`hud-objective${alerted ? " alerted" : ""}`}>
                <div className="obj-label">
                  <Icon name={mission.objective === "vip" ? "target" : mission.objective === "rescue" ? "shield" : "skull"} />
                  {mission.objective === "vip" ? (objective.remaining ? "VIP ESCAPING" : "VIP DOWN") : mission.objective === "rescue" ? "CAPTORS" : "HOSTILES"}
                </div>
                {mission.objective === "vip" ? (
                  <div className="obj-count">{objective.remaining ? "ACTIVE" : "✓"}</div>
                ) : (
                  <div className="obj-count">{objective.total - objective.remaining}<i>/</i>{objective.total}</div>
                )}
                <div className="obj-pips">
                  {Array.from({ length: objective.total }, (_, i) => <span key={i} className={i < objective.total - objective.remaining ? "on" : ""} />)}
                </div>
                {mission.objective === "rescue" && (
                  <div className="hostage-state">HOSTAGES SAFE · <span ref={hostagesRef}>{mission.hostages}</span>/{mission.hostages}</div>
                )}
                <div className={`stealth-state${alerted ? " hot" : ""}`}>
                  {alerted ? (mission.objective === "rescue" ? "● EXECUTION COUNTDOWN" : "● ALERT") : "○ UNDETECTED"}
                </div>
              </div>
            )}
            <div className="hud-timer">
              <span className="eyebrow">TIME</span>
              <span ref={timerRef} className="timer-value">0:00</span>
              <span className="hud-score">{score.toLocaleString()} PTS</span>
            </div>
          </div>

          <div className="kill-feed">
            {feed.map((f) => (
              <div key={f.id} className={`feed-row ${f.tone}`}>
                <span>{f.text}</span>
                {f.score !== 0 && <b>{f.score > 0 ? "+" : ""}{f.score}</b>}
              </div>
            ))}
          </div>

          <div className="hud-bottom">
            <div className="hud-health">
              <div className="hb-top"><Icon name="heart" /> <span>{Math.round(health)}</span></div>
              <div className="health-bar"><b style={{ width: `${health}%` }} className={health < 35 ? "low" : ""} /></div>
              <div className="items-row">
                {ITEMS.map((item) => (
                  <button key={item.id} type="button" className="item-slot" onClick={() => useItem(item.id)} style={{ ["--accent" as string]: item.color }} disabled={!save.items[item.id]}>
                    <kbd>{item.key}</kbd>
                    <Icon name={item.id === "medkit" ? "heart" : item.id === "adrenaline" ? "bolt" : item.id === "thermal" ? "eye" : "reload"} />
                    <span>{save.items[item.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="hud-center-info">
              {!scoped && (
                <>
                  <span><Icon name="wind" /> <span ref={windRef}>0.0</span> m/s <span ref={windArrowRef} className="wind-arrow">➜</span></span>
                  <span><Icon name="crosshair" /> <span ref={rangeRef}>----</span> m</span>
                </>
              )}
            </div>

            <div className={`hud-ammo${ammo.reloading ? " reloading" : ""}${ammo.mag === 0 ? " empty" : ""}`}>
              <div className="ammo-gun">{gun.name}</div>
              <div className="ammo-count">
                {String(ammo.mag).padStart(2, "0")}
                <span>/ {ammo.reserve}</span>
              </div>
              <div className="ammo-rounds">
                {Array.from({ length: gun.magSize }, (_, i) => <i key={i} className={i < ammo.mag ? "on" : ""} />)}
              </div>
              <div className="ready-track"><div ref={readyRef} className="ready-fill" /></div>
              {ammo.reloading && (
                <div className="reload-ring" ref={reloadRef}>RELOADING</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* touch controls */}
      {phase === "playing" && !killcam && (
        <div className="touch-controls">
          <button type="button" className="touch-btn fire" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.fire(); }}>FIRE</button>
          <button type="button" className="touch-btn scope" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.toggleScope(); }}><Icon name="scope" /></button>
          <button type="button" className="touch-btn zoom" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.cycleZoom(); }}>{zoomValue}×</button>
          <button type="button" className="touch-btn reload" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.reload(); }}><Icon name="reload" /></button>
          <button type="button" className="touch-btn breath" onTouchStart={() => engineRef.current?.setHoldBreath(true)} onTouchEnd={() => engineRef.current?.setHoldBreath(false)}>HOLD</button>
          <button type="button" className="touch-btn pause" onClick={pause}><Icon name="pause" /></button>
        </div>
      )}

      {banner && hudVisible && (
        <div key={banner.id} className={`center-banner ${banner.tone}`}>
          <strong>{banner.text}</strong>
          {banner.sub && <span>{banner.sub}</span>}
        </div>
      )}
      {toast && hudVisible && <div key={toast.id} className={`game-toast ${toast.tone}`}>{toast.text}</div>}

      {killcam && (
        <div className="killcam-frame">
          <div className="letterbox top" />
          <div className="letterbox bottom" />
          <div className="killcam-label"><span className="rec-dot" /> BULLET CAM · {Math.round(stats.current.longest)}m</div>
        </div>
      )}

      {/* BRIEFING */}
      {phase === "briefing" && (
        <div className="overlay briefing">
          <div className="briefing-card">
            <div className="briefing-image" style={{ backgroundImage: `url(${map.image})` }}>
              <span className="classified">CLASSIFIED · EYES ONLY</span>
            </div>
            <div className="briefing-body">
              <div className="briefing-scroll">
              <div className="eyebrow">
                OPERATION {String(mission.index + 1).padStart(2, "0")} · {map.region.toUpperCase()}
                {mission.difficulty !== "normal" && <span className={`diff-badge ${mission.difficulty}`}>{mission.difficulty === "boss" ? "☠ BOSS" : "▲ HARD"}</span>}
              </div>
              <h2>{mission.title}</h2>
              <p>{mission.brief}</p>
              <div className={`objective-tag ${mission.objective}`}>
                <Icon name={mission.objective === "vip" ? "target" : mission.objective === "rescue" ? "shield" : "skull"} />
                {mission.objective === "vip"
                  ? "Eliminate the VIP (red beret) before he reaches the far side"
                  : mission.objective === "rescue"
                    ? `Kill all ${(mission.hostages ?? 1) * 2} captors and bring ${mission.hostages} hostage${(mission.hostages ?? 1) > 1 ? "s" : ""} home alive`
                    : mission.objective === "boss"
                      ? `Take down ${mission.bossName} — ${mission.bossTitle}`
                      : `Eliminate all ${mission.hostiles} hostiles`}
              </div>
              <div className="intel-grid">
                <div><span>Hostiles</span><strong>{mission.hostiles}</strong></div>
                <div><span>Armoured</span><strong>{mission.heavies}</strong></div>
                <div><span>Civilians</span><strong className={mission.civilians ? "warn" : ""}>{mission.civilians}</strong></div>
                <div><span>Time</span><strong>{Math.floor(mission.timeLimit / 60)}:{String(mission.timeLimit % 60).padStart(2, "0")}</strong></div>
              </div>
              <ul className="briefing-tips">
                {mission.objective === "rescue" && (
                  <>
                    <li className="warn">Hostages wear orange and kneel beside their captors. Hitting one fails the mission.</li>
                    <li className="warn">The moment you're detected, captors start a {mission.executeWindow}s execution countdown. Use a suppressor or take them out fast.</li>
                  </>
                )}
                {mission.objective === "boss" && (
                  <>
                    <li className="warn">His red laser tightens as he locks on. Land any hit before it goes solid, or take a heavy round.</li>
                    <li>His armour soaks body shots. The glowing visor takes 2.6× damage. Every third of his health brings reinforcements.</li>
                  </>
                )}
                {mission.civilians > 0 && <li className="warn">Civilians wear bright clothes and carry no weapon. Shooting one fails the mission.</li>}
                {mission.heavies > 0 && <li>Armoured heavies take two body shots — aim for the head, or bring a magnum.</li>}
                <li>Wind pushes your bullet sideways. Aim into the wind using the scope's mil-dots.</li>
                <li>{gun.suppressed ? "Your suppressor keeps distant hostiles unaware — only nearby enemies notice bodies." : "Your first shot gives away your position. Make it count."}</li>
              </ul>
              <div className={`scene-assignment briefing-scene tod-${timeOfDay}`}>
                <span>{timeOfDay === "day" ? "☀ DIN · DAY" : timeOfDay === "dusk" ? "◐ SHAAM · DUSK" : "☾ RAAT · NIGHT"}</span>
                <small>RANDOMLY ASSIGNED FOR THIS OPERATION</small>
              </div>
              <div className="briefing-controls">
                <span><kbd>RMB</kbd> scope</span><span><kbd>Wheel</kbd> zoom</span><span><kbd>Shift</kbd> breathe</span><span><kbd>1-4</kbd> gear</span>
              </div>
              </div>
              <div className="briefing-actions">
                <button type="button" className="chip" onClick={() => { audio.ui(); onExit("missions"); }}>Abort</button>
                <button type="button" className="deploy-btn" onClick={deploy}>Deploy · {gun.name} <span>→</span></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="overlay countdown">
          <div key={count} className="count-num">{count}</div>
          <div className="count-label">GET IN POSITION</div>
        </div>
      )}

      {/* PAUSE */}
      {phase === "paused" && (
        <div className="overlay pause">
          <div className="pause-card">
            <div className="eyebrow">OPERATION PAUSED</div>
            <h2>Hold position.</h2>
            {showSettings ? (
              <>
                <SettingsPanel settings={save.settings} onChange={onSettings} compact />
                <button type="button" className="chip" onClick={() => setShowSettings(false)}>← Back</button>
              </>
            ) : (
              <div className="pause-actions">
                <button type="button" className="deploy-btn" onClick={resume}>Resume <span>→</span></button>
                <button type="button" className="pause-btn" onClick={() => { audio.ui(); onRetry(); }}><Icon name="reload" /> Restart operation</button>
                <button type="button" className="pause-btn" onClick={() => { audio.ui(); setShowSettings(true); }}><Icon name="gear" /> Settings</button>
                <button type="button" className="pause-btn" onClick={() => { audio.ui(); onExit("menu"); }}><Icon name="back" /> Quit to menu</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {phase === "ended" && result && (
        <div className={`overlay results ${result.success ? "win" : "lose"}`}>
          <div className="results-card">
            <div className="eyebrow">{result.success ? "OPERATION COMPLETE" : "OPERATION FAILED"}</div>
            <h2>{result.success ? mission.title : result.reason}</h2>
            {result.success ? <Stars count={result.stars} size="lg" /> : <p className="fail-reason">Regroup, re-arm and try again.</p>}
            <div className="results-stats">
              <div><span>Kills</span><strong>{result.kills}</strong></div>
              <div><span>Headshots</span><strong>{result.headshots}</strong></div>
              <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
              <div><span>Longest</span><strong>{Math.round(result.longest)}m</strong></div>
              <div><span>Health</span><strong>{result.health}</strong></div>
              <div><span>Score</span><strong>{result.score.toLocaleString()}</strong></div>
            </div>
            <div className="breakdown">
              {result.breakdown.map(([label, v], i) => (
                <div key={label} style={{ animationDelay: `${0.3 + i * 0.12}s` }}>
                  <span>{label}</span>
                  <b>+{v}</b>
                </div>
              ))}
              <div className="breakdown-total">
                <span>COINS EARNED</span>
                <CoinBadge coins={result.coins} large />
              </div>
            </div>
            <div className="results-actions">
              <button type="button" className="chip" onClick={() => { audio.ui(); onExit("menu"); }}>Menu</button>
              <button type="button" className="chip" onClick={() => { audio.ui(); onExit("armory"); }}><Icon name="cart" /> Armory</button>
              <button type="button" className={result.success ? "chip" : "deploy-btn"} onClick={() => { audio.ui(); onRetry(); }}>Retry</button>
              {result.success && missionIndex < MISSIONS.length - 1 && (
                <button type="button" className="deploy-btn" onClick={() => { audio.ui(); onNext(); }}>Next operation <span>→</span></button>
              )}
              {result.success && missionIndex === MISSIONS.length - 1 && (
                <button type="button" className="deploy-btn" onClick={() => { audio.ui(); onExit("missions"); }}>Campaign complete <span>★</span></button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
