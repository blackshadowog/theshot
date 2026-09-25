import { useMemo, useState } from "react";
import { audio } from "../game/audio";
import { MISSIONS, TIME_OPTIONS, getMap, type TimeOfDay } from "../game/data";
import type { SaveData } from "../game/save";
import { CoinBadge, Icon } from "./Icons";

interface Props {
  email: string;
  save: SaveData;
  onDeploy: (missionIndex: number, tod: TimeOfDay) => void;
  onArmory: () => void;
  onLogout: () => void;
}

type Filter = "all" | "boss" | "rescue" | "hard";

export default function AdminPortal({ email, save, onDeploy, onArmory, onLogout }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const mission = MISSIONS[selected];
  const map = getMap(mission.mapId);
  const allMaps = new Set(MISSIONS.map((item) => item.mapId)).size;
  const bosses = MISSIONS.filter((item) => item.objective === "boss").length;
  const rescues = MISSIONS.filter((item) => item.objective === "rescue").length;
  const filtered = useMemo(() => MISSIONS.filter((item) => {
    const matchesFilter = filter === "all" || filter === "boss" && item.objective === "boss" || filter === "rescue" && item.objective === "rescue" || filter === "hard" && item.difficulty !== "normal";
    const query = search.trim().toLowerCase();
    return matchesFilter && (!query || `${item.title} ${item.bossName ?? ""} ${getMap(item.mapId).name}`.toLowerCase().includes(query));
  }), [filter, search]);

  return (
    <main className="screen admin-screen">
      <div className="admin-bg" />
      <header className="admin-topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="crosshair" /></span>
          <div><div className="brand-name">DUSKLINE</div><div className="brand-sub">COMMAND AUTHORITY</div></div>
        </div>
        <div className="admin-status"><span className="admin-live-dot" /> ADMIN SESSION ACTIVE <i>·</i> ALL OPERATIONS AUTHORIZED</div>
        <div className="admin-user">
          <CoinBadge coins={save.coins} />
          <span className="admin-user-email">{email}</span>
          <button type="button" className="admin-logout" onClick={() => { audio.ui(); onLogout(); }}>SIGN OUT <Icon name="back" /></button>
        </div>
      </header>

      <section className="admin-heading">
        <div>
          <div className="eyebrow"><span className="pulse-dot" /> ROOT ACCESS · CLEARANCE UNLIMITED</div>
          <h1>Command <em>portal.</em></h1>
          <p>All theatres unlocked. Requisitions unlimited. Choose any operation and deploy directly.</p>
        </div>
        <div className="admin-authority"><Icon name="shield" /><span>FULL<br />AUTHORITY</span></div>
      </section>

      <section className="admin-stats">
        <div><span>OPERATIONS</span><strong>{MISSIONS.length}<small> / {MISSIONS.length} UNLOCKED</small></strong></div>
        <div><span>THEATRES</span><strong>{allMaps}<small> ACTIVE</small></strong></div>
        <div><span>BOSS TARGETS</span><strong>{bosses}<small> CONFIRMED</small></strong></div>
        <div><span>RESCUE CONTRACTS</span><strong>{rescues}<small> AVAILABLE</small></strong></div>
        <div><span>REQUISITIONS</span><strong className="unlimited-value">∞<small> UNLIMITED</small></strong></div>
      </section>

      <section className="admin-workspace">
        <div className="admin-mission-browser">
          <div className="admin-browser-head">
            <div>
              <div className="card-label">OPERATIONS DATABASE</div>
              <strong>{filtered.length} OPERATIONS</strong>
            </div>
            <label className="admin-search"><Icon name="eye" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search operations" /></label>
          </div>
          <div className="admin-filters">
            {(["all", "boss", "rescue", "hard"] as Filter[]).map((item) => (
              <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => { audio.ui(); setFilter(item); }}>
                {item === "all" ? "ALL OPS" : item === "boss" ? "☠ BOSSES" : item === "rescue" ? "RESCUE" : "▲ HARD"}
              </button>
            ))}
          </div>
          <div className="admin-mission-list">
            {filtered.map((item) => {
              const location = getMap(item.mapId);
              return (
                <button key={item.id} type="button" className={`admin-mission-row ${item.difficulty}${item.index === selected ? " selected" : ""}`} onClick={() => { audio.ui(); setSelected(item.index); }}>
                  <span className="admin-op-number">{String(item.index + 1).padStart(2, "0")}</span>
                  <span className="admin-op-map" style={{ backgroundImage: `url(${location.image})` }} />
                  <span className="admin-op-copy">
                    <strong>{item.title}</strong>
                    <small>{location.name.toUpperCase()} <i>·</i> {item.objective === "boss" ? `BOSS: ${item.bossName}` : item.objective === "rescue" ? `RESCUE · ${item.hostages} HOSTAGES` : item.objective === "vip" ? "HIGH-VALUE TARGET" : `${item.hostiles} HOSTILES`}</small>
                  </span>
                  <span className={`tod-pill tod-${item.defaultTime}`}>{item.defaultTime === "day" ? "☀ DIN" : item.defaultTime === "dusk" ? "◐ SHAAM" : "☾ RAAT"}</span>
                  <span className="admin-op-difficulty">{item.difficulty === "boss" ? "☠ BOSS" : item.difficulty === "hard" ? "▲ HARD" : "STANDARD"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="admin-mission-detail">
          <div className="admin-detail-image" style={{ backgroundImage: `url(${map.image})` }}>
            <span className={`admin-detail-diff ${mission.difficulty}`}>{mission.difficulty === "boss" ? "☠ BOSS OPERATION" : mission.difficulty === "hard" ? "▲ HARD OPERATION" : "STANDARD OPERATION"}</span>
            <div className="admin-detail-time">{TIME_OPTIONS.find((option) => option.id === mission.defaultTime)?.label} · RANDOM ASSIGNMENT</div>
          </div>
          <div className="admin-detail-content">
            <div className="card-label">OPERATION {String(mission.index + 1).padStart(2, "0")} · {map.region.toUpperCase()}</div>
            <h2>{mission.title}</h2>
            <p>{mission.brief}</p>
            {mission.objective === "boss" && <div className="admin-boss-info"><Icon name="skull" /><span>{mission.bossName} · {mission.bossTitle}</span><strong>{mission.bossHealth} HP</strong></div>}
            {mission.objective === "rescue" && <div className="admin-rescue-info"><Icon name="shield" /><span>{mission.hostages} hostage{(mission.hostages ?? 1) > 1 ? "s" : ""} · {mission.executeWindow}s execution clock</span></div>}
            <div className="admin-mission-facts">
              <span><small>HOSTILES</small><strong>{mission.hostiles}</strong></span>
              <span><small>HEAVIES</small><strong>{mission.heavies}</strong></span>
              <span><small>CONTRACT</small><strong>{mission.reward.toLocaleString()} <i>CR</i></strong></span>
            </div>
            <div className="admin-detail-actions">
              <button type="button" className="admin-deploy" onClick={() => { audio.purchase(); onDeploy(mission.index, mission.defaultTime); }}><Icon name="play" /> DEPLOY ANY OPERATION <span>→</span></button>
              <button type="button" className="admin-armory-link" onClick={() => { audio.ui(); onArmory(); }}><Icon name="cart" /> OPEN ARMORY · EVERYTHING AVAILABLE</button>
            </div>
            <div className="admin-local-warning"><Icon name="shield" /> LOCAL DEMO AUTHORITY · profile and privileges are stored in this browser.</div>
          </div>
        </aside>
      </section>
    </main>
  );
}