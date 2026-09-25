import { useState } from "react";
import { audio } from "../game/audio";
import { GUNS, ITEMS, UPGRADES, getGun, type GunDef } from "../game/data";
import type { SaveData } from "../game/save";
import GunPreview from "./GunPreview";
import { CoinBadge, Icon } from "./Icons";

interface Props {
  save: SaveData;
  onBack: () => void;
  onBuyGun: (id: string) => boolean;
  onEquip: (id: string) => void;
  onBuyItem: (id: (typeof ITEMS)[number]["id"]) => boolean;
  onBuyUpgrade: (id: (typeof UPGRADES)[number]["id"]) => boolean;
}

type Tab = "rifles" | "gear" | "upgrades";

function statRows(g: GunDef) {
  return [
    { label: "Damage", value: g.damage, pct: g.damage / 320, fmt: `${g.damage}` },
    { label: "Max zoom", value: g.zoomLevels[g.zoomLevels.length - 1], pct: g.zoomLevels[g.zoomLevels.length - 1] / 16, fmt: `${g.zoomLevels.join(" / ")}×` },
    { label: "Stability", value: g.stability, pct: g.stability, fmt: `${Math.round(g.stability * 100)}` },
    { label: "Fire rate", value: 1 / g.fireDelay, pct: 1 / g.fireDelay / 3.4, fmt: `${(60 / g.fireDelay).toFixed(0)} rpm` },
    { label: "Magazine", value: g.magSize, pct: g.magSize / 10, fmt: `${g.magSize} + ${g.reserve}` },
    { label: "Reload", value: 1 / g.reloadTime, pct: 2.2 / g.reloadTime / 1.05, fmt: `${g.reloadTime.toFixed(1)}s` },
    { label: "Penetration", value: g.penetration, pct: g.penetration / 6, fmt: `${g.penetration} target${g.penetration > 1 ? "s" : ""}` },
  ];
}

export default function Armory({ save, onBack, onBuyGun, onEquip, onBuyItem, onBuyUpgrade }: Props) {
  const [tab, setTab] = useState<Tab>("rifles");
  const [gunId, setGunId] = useState(save.equipped);
  const [flash, setFlash] = useState<string | null>(null);
  const gun = getGun(gunId);
  const equipped = getGun(save.equipped);
  const owned = save.ownedGuns.includes(gun.id);
  const canAfford = save.coins >= gun.price;
  const compare = statRows(equipped);

  const notify = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 1600);
  };

  return (
    <div className="screen sub-screen armory-screen">
      <div className="armory-bg" />
      <header className="sub-header">
        <button type="button" className="back-btn" onClick={() => { audio.ui(); onBack(); }}>
          <Icon name="back" /> BACK
        </button>
        <div className="sub-title">
          <span>REQUISITIONS</span>
          <h2>Armory</h2>
        </div>
        <CoinBadge coins={save.coins} />
      </header>

      <div className="tabs" role="tablist">
        {(["rifles", "gear", "upgrades"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" className={`tab${tab === t ? " active" : ""}`} onClick={() => { audio.ui(); setTab(t); }}>
            {t === "rifles" ? "Rifles" : t === "gear" ? "Field Gear" : "Upgrades"}
          </button>
        ))}
      </div>

      {flash && <div className="shop-flash">{flash}</div>}

      {tab === "rifles" && (
        <div className="armory-layout">
          <aside className="gun-list">
            {GUNS.map((g) => {
              const isOwned = save.ownedGuns.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`gun-row${g.id === gunId ? " active" : ""}`}
                  onClick={() => { audio.ui(); setGunId(g.id); }}
                  onMouseEnter={() => audio.hover()}
                >
                  <span className="gun-row-tag">{g.tag}</span>
                  <strong>{g.name}</strong>
                  <small>{g.kind}</small>
                  <span className="gun-row-state">
                    {g.id === save.equipped ? <em className="equipped"><Icon name="check" /> Equipped</em> : isOwned ? <em>Owned</em> : <em className="price"><Icon name="coin" /> {g.price.toLocaleString()}</em>}
                  </span>
                </button>
              );
            })}
          </aside>

          <section className="gun-stage">
            <div className="gun-stage-head">
              <span className="gun-tag-big">{gun.tag}</span>
              <h3>{gun.name}</h3>
              <p>{gun.description}</p>
            </div>
            <GunPreview gun={gun} />
            <div className="gun-traits">
              {gun.suppressed && <span><Icon name="eye" /> Suppressed</span>}
              {gun.thermal && <span><Icon name="bolt" /> Built-in thermal</span>}
              {gun.penetration > 1 && <span><Icon name="target" /> Pierces {gun.penetration}</span>}
              {gun.damage >= 200 && <span><Icon name="shield" /> One-shots armour</span>}
              <span><Icon name="scope" /> {gun.zoomLevels.length}-stage optic</span>
            </div>
            <div className="drag-hint">Drag to rotate</div>
          </section>

          <aside className="gun-stats">
            <div className="card-label">SPECIFICATIONS {gun.id !== equipped.id && <i>vs {equipped.name}</i>}</div>
            {statRows(gun).map((row, i) => {
              const base = compare[i];
              const delta = row.value - base.value;
              return (
                <div key={row.label} className="stat-row">
                  <div className="stat-top">
                    <span>{row.label}</span>
                    <strong>{row.fmt}</strong>
                  </div>
                  <div className="stat-bar">
                    <b style={{ width: `${Math.min(100, row.pct * 100)}%` }} />
                    {gun.id !== equipped.id && <i style={{ left: `${Math.min(100, base.pct * 100)}%` }} />}
                  </div>
                  {gun.id !== equipped.id && Math.abs(delta) > 0.001 && <span className={`delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? "▲" : "▼"}</span>}
                </div>
              );
            })}
            <div className="gun-actions">
              {owned ? (
                <button type="button" className="deploy-btn" disabled={gun.id === save.equipped} onClick={() => { audio.purchase(); onEquip(gun.id); notify(`${gun.name} equipped`); }}>
                  {gun.id === save.equipped ? <><Icon name="check" /> Equipped</> : <>Equip rifle <span>→</span></>}
                </button>
              ) : (
                <button
                  type="button"
                  className={`deploy-btn buy${canAfford ? "" : " poor"}`}
                  onClick={() => {
                    if (onBuyGun(gun.id)) {
                      audio.purchase();
                      notify(`${gun.name} acquired`);
                    } else {
                      audio.error();
                      notify(`Need ${(gun.price - save.coins).toLocaleString()} more coins`);
                    }
                  }}
                >
                  <Icon name="coin" /> Buy for {gun.price.toLocaleString()}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {tab === "gear" && (
        <div className="card-grid">
          {ITEMS.map((item) => (
            <div key={item.id} className="shop-card" style={{ ["--accent" as string]: item.color }}>
              <div className="shop-card-top">
                <span className="item-key">KEY {item.key}</span>
                <span className="item-count">×{save.items[item.id]}</span>
              </div>
              <div className="item-glyph"><Icon name={item.id === "medkit" ? "heart" : item.id === "adrenaline" ? "bolt" : item.id === "thermal" ? "eye" : "reload"} /></div>
              <h4>{item.name}</h4>
              <p>{item.description}</p>
              <button
                type="button"
                className="buy-btn"
                onClick={() => {
                  if (onBuyItem(item.id)) {
                    audio.coin();
                    notify(`+1 ${item.name}`);
                  } else {
                    audio.error();
                    notify("Not enough coins");
                  }
                }}
              >
                <Icon name="coin" /> {item.price}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "upgrades" && (
        <div className="upgrade-list">
          {UPGRADES.map((u) => {
            const level = save.upgrades[u.id];
            const maxed = level >= u.prices.length;
            const price = maxed ? 0 : u.prices[level];
            return (
              <div key={u.id} className="upgrade-row">
                <div className="upgrade-icon"><Icon name={u.id === "armor" ? "shield" : u.id === "steady" ? "crosshair" : u.id === "reload" ? "reload" : u.id === "lungs" ? "wind" : "coin"} /></div>
                <div className="upgrade-body">
                  <h4>{u.name}</h4>
                  <p>{u.description} <em>{u.effect}</em></p>
                </div>
                <div className="pips">
                  {u.prices.map((_, i) => <span key={i} className={i < level ? "on" : ""} />)}
                </div>
                <button
                  type="button"
                  className="buy-btn"
                  disabled={maxed}
                  onClick={() => {
                    if (onBuyUpgrade(u.id)) {
                      audio.purchase();
                      notify(`${u.name} → level ${level + 1}`);
                    } else {
                      audio.error();
                      notify("Not enough coins");
                    }
                  }}
                >
                  {maxed ? "MAXED" : <><Icon name="coin" /> {price.toLocaleString()}</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
