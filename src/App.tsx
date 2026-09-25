import { useCallback, useEffect, useState } from "react";
import Armory from "./components/Armory";
import GameView, { type MissionResult } from "./components/GameView";
import { CoinBadge, Icon } from "./components/Icons";
import MainMenu from "./components/MainMenu";
import MissionSelect from "./components/MissionSelect";
import SettingsPanel from "./components/SettingsPanel";
import AuthScreen from "./components/AuthScreen";
import AdminPortal from "./components/AdminPortal";
import { audio } from "./game/audio";
import { GUNS, ITEMS, MISSIONS, UPGRADES, type TimeOfDay } from "./game/data";
import { createDefaultSave, type SaveData, type Settings } from "./game/save";
import { clearSession, loadAccountSave, persistAccountSave, readSession, resetAccountSave, type AuthSession } from "./game/auth";

type Screen = "login" | "menu" | "missions" | "armory" | "settings" | "game" | "admin";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [save, setSave] = useState<SaveData>(() => {
    const current = readSession();
    return current ? loadAccountSave(current) : createDefaultSave();
  });
  const [screen, setScreen] = useState<Screen>(() => {
    const current = readSession();
    return current ? (current.admin ? "admin" : "menu") : "login";
  });
  const [missionIndex, setMissionIndex] = useState(0);
  const [chosenTime, setChosenTime] = useState<TimeOfDay | undefined>(undefined);
  const [runKey, setRunKey] = useState(0);
  const [returnTo, setReturnTo] = useState<Screen>("menu");

  useEffect(() => {
    if (session) persistAccountSave(save, session);
  }, [save, session]);

  useEffect(() => {
    audio.setVolumes(save.settings.music, save.settings.sfx);
  }, [save.settings.music, save.settings.sfx]);

  const update = useCallback((fn: (s: SaveData) => SaveData) => setSave((s) => fn(s)), []);

  const go = (next: Screen) => {
    if (next === "armory" || next === "settings") setReturnTo(screen === "game" ? "missions" : screen === "armory" || screen === "settings" ? returnTo : screen);
    setScreen(next);
    if (next !== "game") audio.playMusic("menu", 45);
  };

  const onAuthenticated = (nextSession: AuthSession) => {
    audio.ensure();
    const nextSave = loadAccountSave(nextSession);
    setSession(nextSession);
    setSave(nextSave);
    audio.setVolumes(nextSave.settings.music, nextSave.settings.sfx);
    audio.playMusic("menu", 45);
    audio.purchase();
    setScreen(nextSession.admin ? "admin" : "menu");
  };

  const logout = () => {
    clearSession();
    setSession(null);
    setSave(createDefaultSave());
    setScreen("login");
    audio.playMusic("off");
  };

  const deploy = (index: number, tod?: TimeOfDay) => {
    setMissionIndex(index);
    setChosenTime(tod ?? MISSIONS[index].defaultTime);
    setRunKey((k) => k + 1);
    setScreen("game");
  };

  const onComplete = useCallback(
    (r: MissionResult) => {
      update((s) => {
        const mission = MISSIONS[r.missionIndex];
        const prevStars = s.stars[mission.id] ?? 0;
        return {
          ...s,
          coins: session?.admin ? Number.MAX_SAFE_INTEGER : s.coins + r.coins,
          unlocked: r.success ? Math.max(s.unlocked, Math.min(MISSIONS.length - 1, r.missionIndex + 1)) : s.unlocked,
          stars: r.success ? { ...s.stars, [mission.id]: Math.max(prevStars, r.stars) } : s.stars,
          best: { ...s.best, [mission.id]: Math.max(s.best[mission.id] ?? 0, r.score) },
          stats: {
            kills: s.stats.kills + r.kills,
            headshots: s.stats.headshots + r.headshots,
            shots: s.stats.shots + r.shots,
            hits: s.stats.hits + r.hits,
            longest: Math.max(s.stats.longest, r.longest),
            missions: s.stats.missions + (r.success ? 1 : 0),
            earned: s.stats.earned + r.coins,
            civilians: s.stats.civilians + r.civilians,
          },
        };
      });
      if (r.coins > 0) window.setTimeout(() => audio.coin(), 900);
    },
    [session?.admin, update],
  );

  const consumeItem = useCallback(
    (id: (typeof ITEMS)[number]["id"]) => {
      if (save.items[id] <= 0) return false;
      update((s) => ({ ...s, items: { ...s.items, [id]: Math.max(0, s.items[id] - 1) } }));
      return true;
    },
    [save.items, update],
  );

  const buyGun = (id: string) => {
    const gun = GUNS.find((g) => g.id === id);
    if (!gun || save.coins < gun.price || save.ownedGuns.includes(id)) return false;
    update((s) => ({ ...s, coins: session?.admin ? Number.MAX_SAFE_INTEGER : s.coins - gun.price, ownedGuns: [...s.ownedGuns, id], equipped: id }));
    return true;
  };

  const buyItem = (id: (typeof ITEMS)[number]["id"]) => {
    const item = ITEMS.find((i) => i.id === id)!;
    if (save.coins < item.price) return false;
    update((s) => ({ ...s, coins: session?.admin ? Number.MAX_SAFE_INTEGER : s.coins - item.price, items: { ...s.items, [id]: s.items[id] + 1 } }));
    return true;
  };

  const buyUpgrade = (id: (typeof UPGRADES)[number]["id"]) => {
    const up = UPGRADES.find((u) => u.id === id)!;
    const level = save.upgrades[id];
    if (level >= up.prices.length || save.coins < up.prices[level]) return false;
    update((s) => ({ ...s, coins: session?.admin ? Number.MAX_SAFE_INTEGER : s.coins - up.prices[level], upgrades: { ...s.upgrades, [id]: level + 1 } }));
    return true;
  };

  const equip = (id: string) => update((s) => ({ ...s, equipped: id }));
  const changeSettings = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  if (!session || screen === "login") return <AuthScreen onAuthenticated={onAuthenticated} />;

  return (
    <div className="app-root">
      {screen === "menu" && (
        <MainMenu
          save={save}
          email={session.email}
          onNavigate={(s) => go(s)}
          onContinue={() => deploy(Math.min(save.unlocked, MISSIONS.length - 1))}
          onLogout={logout}
        />
      )}
      {screen === "missions" && (
        <MissionSelect
          save={save}
          initialMission={Math.min(save.unlocked, MISSIONS.length - 1)}
          onBack={() => go("menu")}
          onDeploy={deploy}
          onEquip={equip}
          onArmory={() => go("armory")}
        />
      )}
      {screen === "armory" && (
        <Armory save={save} onBack={() => go(returnTo === "armory" ? "menu" : returnTo)} onBuyGun={buyGun} onEquip={equip} onBuyItem={buyItem} onBuyUpgrade={buyUpgrade} />
      )}
      {screen === "settings" && (
        <div className="screen sub-screen settings-screen">
          <div className="armory-bg" />
          <header className="sub-header">
            <button type="button" className="back-btn" onClick={() => { audio.ui(); go("menu"); }}>
              <Icon name="back" /> MENU
            </button>
            <div className="sub-title">
              <span>CONFIGURATION</span>
              <h2>Settings</h2>
            </div>
            <CoinBadge coins={save.coins} />
          </header>
          <div className="settings-wrap">
            <SettingsPanel settings={save.settings} onChange={changeSettings} onReset={() => setSave(session ? resetAccountSave(session) : createDefaultSave())} />
          </div>
        </div>
      )}
      {screen === "admin" && session.admin && (
        <AdminPortal
          email={session.email}
          save={save}
          onDeploy={deploy}
          onArmory={() => { setReturnTo("admin"); setScreen("armory"); }}
          onLogout={logout}
        />
      )}
      {screen === "game" && (
        <GameView
          key={runKey}
          save={save}
          missionIndex={missionIndex}
          initialTimeOfDay={chosenTime}
          onExit={(to) => {
            if (session.admin) {
              if (to === "armory") {
                setReturnTo("admin");
                setScreen("armory");
              } else {
                setScreen("admin");
              }
              return;
            }
            go(to);
          }}
          onRetry={() => setRunKey((k) => k + 1)}
          onNext={() => deploy(Math.min(missionIndex + 1, MISSIONS.length - 1))}
          onComplete={onComplete}
          onConsumeItem={consumeItem}
          onSettings={changeSettings}
        />
      )}
    </div>
  );
}
