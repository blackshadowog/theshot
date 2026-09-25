import { useState } from "react";
import { audio } from "../game/audio";
import type { Settings } from "../game/save";

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onReset?: () => void;
  compact?: boolean;
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="setting-row">
      <span className="setting-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }} />
      <span className="setting-value">{format(value)}</span>
    </label>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="setting-row toggle-row" onClick={() => { audio.ui(); onChange(!value); }} aria-pressed={value}>
      <span className="setting-label">{label}<small>{hint}</small></span>
      <span className={`toggle${value ? " on" : ""}`}><i /></span>
    </button>
  );
}

export default function SettingsPanel({ settings, onChange, onReset, compact = false }: Props) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={`settings-panel${compact ? " compact" : ""}`}>
      <div className="settings-group">
        <div className="card-label">AUDIO</div>
        <Slider label="Music" value={settings.music} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onChange({ music: v })} />
        <Slider label="Effects" value={settings.sfx} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onChange({ sfx: v })} />
      </div>
      <div className="settings-group">
        <div className="card-label">CONTROLS</div>
        <Slider label="Sensitivity" value={settings.sensitivity} min={0.3} max={2.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => onChange({ sensitivity: v })} />
        <Toggle label="Invert Y axis" hint="Flip vertical look" value={settings.invertY} onChange={(v) => onChange({ invertY: v })} />
      </div>
      <div className="settings-group">
        <div className="card-label">PRESENTATION</div>
        <Toggle label="Bullet kill-cam" hint="Cinematic slow-motion on the final shot" value={settings.killcam} onChange={(v) => onChange({ killcam: v })} />
        {!compact && <Toggle label="High quality" hint="Shadows, antialiasing, dense weather (applies next mission)" value={settings.quality === "high"} onChange={(v) => onChange({ quality: v ? "high" : "low" })} />}
      </div>
      {!compact && (
        <div className="settings-group">
          <div className="card-label">CONTROLS REFERENCE</div>
          <div className="keys-grid">
            <span><kbd>Mouse</kbd> Aim</span>
            <span><kbd>LMB</kbd> / <kbd>Space</kbd> Fire</span>
            <span><kbd>RMB</kbd> / <kbd>Q</kbd> Scope</span>
            <span><kbd>Wheel</kbd> / <kbd>Z</kbd> Zoom level</span>
            <span><kbd>Shift</kbd> Hold breath</span>
            <span><kbd>R</kbd> Reload</span>
            <span><kbd>1–4</kbd> Use gear</span>
            <span><kbd>Esc</kbd> Pause</span>
          </div>
        </div>
      )}
      {onReset && (
        <div className="settings-group danger">
          <div className="card-label">DATA</div>
          {confirm ? (
            <div className="confirm-row">
              <span>Erase all progress, coins and rifles?</span>
              <button type="button" className="danger-btn" onClick={() => { onReset(); setConfirm(false); }}>Erase</button>
              <button type="button" className="chip" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="danger-btn" onClick={() => { audio.ui(); setConfirm(true); }}>Reset progress</button>
          )}
        </div>
      )}
    </div>
  );
}
