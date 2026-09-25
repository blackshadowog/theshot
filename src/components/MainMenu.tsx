import { audio } from "../game/audio";
import { GUNS, MISSIONS, getGun, getMap } from "../game/data";
import type { SaveData } from "../game/save";
import { CoinBadge, Icon } from "./Icons";

interface Props {
  save: SaveData;
  email: string;
  onNavigate: (screen: "missions" | "armory" | "settings") => void;
  onContinue: () => void;
  onLogout: () => void;
}

export default function MainMenu({ save, email, onNavigate, onContinue, onLogout }: Props) {
  const next = MISSIONS[Math.min(save.unlocked, MISSIONS.length - 1)];
  const gun = getGun(save.equipped);
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const accuracy = save.stats.shots ? Math.round((save.stats.hits / save.stats.shots) * 100) : 0;
  const items: Array<{ label: string; sub: string; icon: "play" | "map" | "cart" | "gear"; action: () => void; primary?: boolean }> = [
    { label: save.stats.missions ? "Continue" : "Begin Campaign", sub: `Op ${String(next.index + 1).padStart(2, "0")} · ${next.title}`, icon: "play", action: onContinue, primary: true },
    { label: "Operations", sub: `${Math.min(save.unlocked + 1, MISSIONS.length)}/${MISSIONS.length} unlocked · 5 theatres`, icon: "map", action: () => onNavigate("missions") },
    { label: "Armory", sub: `${save.ownedGuns.length}/${GUNS.length} rifles · gear · upgrades`, icon: "cart", action: () => onNavigate("armory") },
    { label: "Settings", sub: "Audio · controls · graphics", icon: "gear", action: () => onNavigate("settings") },
  ];

  return (
    <div className="screen menu-screen">
      <div className="menu-bg" style={{ backgroundImage: "url(./images/menu-bg.jpg)" }} />
      <div className="menu-shade" />
      <div className="scanlines" />
      <div className="ember-field" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.73) % 9}s`, animationDuration: `${7 + (i % 5) * 2}s` }} />
        ))}
      </div>

      <header className="menu-top">
        <div className="brand-lockup">
          <span className="brand-mark"><Icon name="crosshair" /></span>
          <div>
            <div className="brand-name">DUSKLINE</div>
            <div className="brand-sub">SNIPER OPERATIONS</div>
          </div>
        </div>
        <div className="menu-top-right">
          <div className="operative-chip">
            <Icon name="user" />
            <span>{email.split("@")[0].slice(0, 15).toUpperCase()}</span>
            <i>{totalStars} ★</i>
          </div>
          <CoinBadge coins={save.coins} />
          <button type="button" className="menu-signout" onClick={() => { audio.ui(); onLogout(); }}>SIGN OUT</button>
        </div>
      </header>

      <div className="menu-body">
      <main className="menu-main">
        <div className="menu-title-block">
          <div className="eyebrow"><span className="pulse-dot" /> {MISSIONS.length} OPERATIONS · 5 BOSSES · HOSTAGE RESCUES</div>
          <h1 className="menu-title">
            One shot.
            <br />
            <em>No second chances.</em>
          </h1>
          <p className="menu-lede">Five war-torn theatres. Warlord boss duels, hostage rescues against the clock, armoured heavies, and wind that won't forgive a lazy aim.</p>
        </div>

        <nav className="menu-nav" aria-label="Main menu">
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              className={`menu-item${item.primary ? " primary" : ""}`}
              onMouseEnter={() => audio.hover()}
              onClick={() => {
                audio.ui();
                item.action();
              }}
              style={{ animationDelay: `${0.15 + i * 0.07}s` }}
            >
              <span className="menu-item-index">0{i + 1}</span>
              <span className="menu-item-icon"><Icon name={item.icon} /></span>
              <span className="menu-item-text">
                <strong>{item.label}</strong>
                <small>{item.sub}</small>
              </span>
              <span className="menu-item-arrow">→</span>
            </button>
          ))}
        </nav>
      </main>

      <aside className="menu-side">
        <div className="side-card loadout-card">
          <div className="card-label">EQUIPPED RIFLE</div>
          <div className="loadout-name">{gun.name}</div>
          <div className="loadout-kind">{gun.kind} · {gun.zoomLevels[gun.zoomLevels.length - 1]}× optic</div>
          <div className="mini-stats">
            <div><span>DMG</span><b style={{ width: `${Math.min(100, (gun.damage / 320) * 100)}%` }} /></div>
            <div><span>STB</span><b style={{ width: `${gun.stability * 100}%` }} /></div>
            <div><span>ROF</span><b style={{ width: `${Math.min(100, (1 / gun.fireDelay / 3.4) * 100)}%` }} /></div>
          </div>
          <button type="button" className="text-link" onClick={() => { audio.ui(); onNavigate("armory"); }}>Change loadout →</button>
        </div>
        <div className="side-card record-card">
          <div className="card-label">SERVICE RECORD</div>
          <div className="record-grid">
            <div><strong>{save.stats.kills}</strong><span>Confirmed</span></div>
            <div><strong>{save.stats.headshots}</strong><span>Headshots</span></div>
            <div><strong>{accuracy}%</strong><span>Accuracy</span></div>
            <div><strong>{Math.round(save.stats.longest)}m</strong><span>Longest</span></div>
          </div>
        </div>
      </aside>
      </div>

      <footer className="menu-ticker">
        <span className="ticker-label">INTEL</span>
        <div className="ticker-track">
          <div className="ticker-content">
            {[...MISSIONS.slice(0, 6), ...MISSIONS.slice(0, 6)].map((m, i) => (
              <span key={i}>
                ◆ {getMap(m.mapId).name.toUpperCase()} — {m.brief}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
