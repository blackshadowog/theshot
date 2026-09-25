import { useState } from "react";
import { audio } from "../game/audio";
import { ITEMS, MAPS, MISSIONS, getGun, getMap, type MapId, type TimeOfDay } from "../game/data";
import type { SaveData } from "../game/save";
import { CoinBadge, Icon, Stars } from "./Icons";

interface Props {
  save: SaveData;
  initialMission: number;
  onBack: () => void;
  onDeploy: (missionIndex: number, tod: TimeOfDay) => void;
  onEquip: (gunId: string) => void;
  onArmory: () => void;
}

export default function MissionSelect({ save, initialMission, onBack, onDeploy, onEquip, onArmory }: Props) {
  const [missionIdx, setMissionIdx] = useState(Math.min(initialMission, save.unlocked));
  const mission = MISSIONS[missionIdx];
  const [mapId, setMapId] = useState<MapId>(mission.mapId);
  const map = getMap(mapId);
  const mapMissions = MISSIONS.filter((m) => m.mapId === mapId);
  const selected = mission.mapId === mapId ? mission : mapMissions.find((m) => m.index <= save.unlocked) ?? mapMissions[0];
  const activeTime: TimeOfDay = selected.defaultTime;
  const locked = selected.index > save.unlocked;
  const gun = getGun(save.equipped);

  const selectMap = (id: MapId) => {
    audio.ui();
    setMapId(id);
    const first = MISSIONS.filter((m) => m.mapId === id);
    const pick = [...first].reverse().find((m) => m.index <= save.unlocked) ?? first[0];
    setMissionIdx(pick.index);
  };

  return (
    <div className="screen sub-screen">
      <div className="sub-bg" style={{ backgroundImage: `url(${map.image})` }} key={map.id} />
      <div className="sub-shade" />
      <header className="sub-header">
        <button type="button" className="back-btn" onClick={() => { audio.ui(); onBack(); }}>
          <Icon name="back" /> MENU
        </button>
        <div className="sub-title">
          <span>THEATRE SELECT</span>
          <h2>Operations</h2>
        </div>
        <CoinBadge coins={save.coins} />
      </header>

      <div className="ops-layout">
        <aside className="map-list">
          {MAPS.map((m, i) => {
            const missions = MISSIONS.filter((x) => x.mapId === m.id);
            const mapLocked = missions[0].index > save.unlocked;
            const stars = missions.reduce((sum, x) => sum + (save.stars[x.id] ?? 0), 0);
            return (
              <button
                key={m.id}
                type="button"
                className={`map-card${m.id === mapId ? " active" : ""}${mapLocked ? " locked" : ""}`}
                onClick={() => selectMap(m.id)}
                onMouseEnter={() => audio.hover()}
              >
                <span className="map-thumb" style={{ backgroundImage: `url(${m.image})` }} />
                <span className="map-card-body">
                  <small>THEATRE 0{i + 1}</small>
                  <strong>{m.name}</strong>
                  <em>{mapLocked ? <><Icon name="lock" /> Locked</> : `${stars}/${missions.length * 3} ★`}</em>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="map-detail">
          <div className="map-hero" style={{ backgroundImage: `url(${map.image})` }}>
            <div className="map-hero-shade" />
            <div className="map-hero-copy">
              <div className="eyebrow">{map.region.toUpperCase()}</div>
              <h3>{map.name}</h3>
              <p>{map.description}</p>
              <div className="map-conditions">
                <span><Icon name="clock" /> {selected.defaultTime === "day" ? "DIN · DAY" : selected.defaultTime === "dusk" ? "SHAAM · DUSK" : "RAAT · NIGHT"} · RANDOM OP ASSIGNMENT</span>
                <span><Icon name="wind" /> {map.windRange[0]}–{map.windRange[1]} m/s</span>
                <span><Icon name="eye" /> {map.weather === "fireflies" ? "Low visibility" : map.weather === "rain" ? "Rain" : map.weather === "snow" ? "Snowfall" : map.weather === "dust" ? "Dust haze" : "Sea mist"}</span>
              </div>
            </div>
          </div>
          <div className="mission-rows">
            {mapMissions.map((m) => {
              const mLocked = m.index > save.unlocked;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`mission-row diff-${m.difficulty}${m.id === selected.id ? " active" : ""}${mLocked ? " locked" : ""}`}
                  onClick={() => { audio.ui(); setMissionIdx(m.index); }}
                  onMouseEnter={() => audio.hover()}
                >
                  <span className="mission-num">{String(m.index + 1).padStart(2, "0")}</span>
                  <span className="mission-row-body">
                    <strong>
                      {m.title}
                      <i className={`tod-pill tod-${m.defaultTime}`}>
                        {m.defaultTime === "day" ? "☀ DIN" : m.defaultTime === "dusk" ? "◐ SHAAM" : "☾ RAAT"}
                      </i>
                    </strong>
                    <small>
                      {m.difficulty !== "normal" && <span className={`diff-badge ${m.difficulty}`}>{m.difficulty === "boss" ? "☠ BOSS" : "▲ HARD"}</span>}
                      {m.objective === "vip" ? "HIGH-VALUE TARGET" : m.objective === "rescue" ? `HOSTAGE RESCUE · ${m.hostages} captive${(m.hostages ?? 1) > 1 ? "s" : ""}` : m.objective === "boss" ? `BOSS · ${m.bossName}` : "ELIMINATION"}
                      {m.objective !== "boss" && ` · ${m.objective === "rescue" ? (m.hostages ?? 1) * 2 + m.hostiles : m.hostiles} hostiles`}
                      {m.civilians ? ` · ${m.civilians} civilians` : ""}
                    </small>
                  </span>
                  {mLocked ? <span className="row-lock"><Icon name="lock" /></span> : <Stars count={save.stars[m.id] ?? 0} />}
                  <span className="row-reward"><Icon name="coin" /> {m.reward}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="brief-panel">
          <div className="card-label">OPERATION {String(selected.index + 1).padStart(2, "0")}</div>
          <h3>{selected.title}</h3>
          <p className="brief-text">{selected.brief}</p>
          {selected.difficulty !== "normal" && (
            <div className={`diff-banner ${selected.difficulty}`}>
              {selected.difficulty === "boss" ? `☠ BOSS FIGHT · ${selected.bossName} · ${selected.bossHealth} HP` : "▲ HARD OPERATION · sharper enemies · +35% pay"}
            </div>
          )}
          <div className={`objective-tag ${selected.objective}`}>
            <Icon name={selected.objective === "vip" ? "target" : selected.objective === "rescue" ? "shield" : "skull"} />
            {selected.objective === "vip"
              ? "Eliminate the VIP before he escapes"
              : selected.objective === "rescue"
                ? `Kill every captor · save ${selected.hostages} hostage${(selected.hostages ?? 1) > 1 ? "s" : ""}`
                : selected.objective === "boss"
                  ? `Defeat ${selected.bossName}, ${selected.bossTitle}`
                  : "Eliminate all hostiles"}
          </div>
          <div className="intel-grid">
            <div><span>Hostiles</span><strong>{selected.objective === "rescue" ? (selected.hostages ?? 1) * 2 + selected.hostiles : selected.hostiles}</strong></div>
            <div><span>{selected.objective === "rescue" ? "Hostages" : "Armoured"}</span><strong>{selected.objective === "rescue" ? selected.hostages : selected.heavies}</strong></div>
            <div><span>Civilians</span><strong className={selected.civilians ? "warn" : ""}>{selected.civilians}</strong></div>
            <div><span>Time</span><strong>{Math.floor(selected.timeLimit / 60)}:{String(selected.timeLimit % 60).padStart(2, "0")}</strong></div>
          </div>
          <div className="star-criteria">
            <div><Icon name="star" filled /> Complete the operation</div>
            <div><Icon name="star" filled /> Finish with 70%+ accuracy</div>
            <div><Icon name="star" filled /> Finish with 70+ health</div>
          </div>

          <div className="scene-assignment">
            <span className={`tod-pill tod-${activeTime}`}>
              {activeTime === "day" ? "☀ DIN · DAY" : activeTime === "dusk" ? "◐ SHAAM · DUSK" : "☾ RAAT · NIGHT"}
            </span>
            <small>RANDOMLY ASSIGNED FOR THIS OPERATION</small>
          </div>

          <div className="card-label">LOADOUT</div>
          <div className="loadout-chips">
            {save.ownedGuns.map((id) => {
              const g = getGun(id);
              return (
                <button key={id} type="button" className={`chip${id === save.equipped ? " active" : ""}`} onClick={() => { audio.ui(); onEquip(id); }}>
                  {g.name}
                </button>
              );
            })}
            <button type="button" className="chip ghost" onClick={() => { audio.ui(); onArmory(); }}>+ Armory</button>
          </div>
          <div className="gear-strip">
            {ITEMS.map((item) => (
              <span key={item.id} title={item.name} style={{ color: item.color }}>
                <b>{item.key}</b> {save.items[item.id]}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="deploy-btn"
            disabled={locked}
            onClick={() => {
              if (locked) return audio.error();
              audio.purchase();
              onDeploy(selected.index, activeTime);
            }}
          >
            {locked ? <><Icon name="lock" /> Complete previous op</> : <>Deploy with {gun.name} <span>→</span></>}
          </button>
        </aside>
      </div>
    </div>
  );
}
