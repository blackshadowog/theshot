type IconName =
  | "coin"
  | "crosshair"
  | "back"
  | "lock"
  | "star"
  | "play"
  | "cart"
  | "gear"
  | "heart"
  | "wind"
  | "clock"
  | "target"
  | "skull"
  | "check"
  | "bolt"
  | "map"
  | "shield"
  | "pause"
  | "reload"
  | "scope"
  | "eye"
  | "user";

const PATHS: Record<IconName, string> = {
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10M9.5 9.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.5-2.5 1.8-2.5.8-2.5 1.8 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7",
  crosshair: "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM12 2v5M12 17v5M2 12h5M17 12h5",
  back: "M15 5l-7 7 7 7",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z",
  play: "M8 5.5v13l10.5-6.5z",
  cart: "M3 4h2.5l2.2 11h10.6l2-8H6.5M9.5 19.5h.01M17 19.5h.01",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.3 3h-4l-.4 2.4A7.5 7.5 0 0 0 7.7 6.7l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z",
  wind: "M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8",
  clock: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  skull: "M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5V19h9v-3c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3ZM9 11h.01M15 11h.01M10.5 19v2M13.5 19v2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  bolt: "M13 2.5 5 13.5h6l-1 8 8-11h-6z",
  map: "M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14",
  shield: "M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z",
  pause: "M9 5v14M15 5v14",
  reload: "M20 7v5h-5M4 17v-5h5M5.5 9a7 7 0 0 1 12.3-1.5L20 10M18.5 15a7 7 0 0 1-12.3 1.5L4 14",
  scope: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0-2v4m0 12v4M2 12h4m12 0h4m-10 0h4",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4.5 20.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
};

export function Icon({ name, className = "", filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`icon ${className}`} aria-hidden="true" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function CoinBadge({ coins, large = false }: { coins: number; large?: boolean }) {
  return (
    <div className={`coin-badge${large ? " large" : ""}`}>
      <span className="coin-disc">
        <Icon name="coin" />
      </span>
      <span className="coin-value">{coins >= Number.MAX_SAFE_INTEGER ? "∞" : coins.toLocaleString()}</span>
    </div>
  );
}

export function Stars({ count, size = "sm" }: { count: number; size?: "sm" | "lg" }) {
  return (
    <div className={`stars stars-${size}`} aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? "on" : ""} style={{ animationDelay: `${i * 0.18}s` }}>
          <Icon name="star" filled={i < count} />
        </span>
      ))}
    </div>
  );
}
