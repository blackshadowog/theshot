import { useState, type FormEvent } from "react";
import { audio } from "../game/audio";
import { authenticate, type AuthMode, type AuthSession } from "../game/auth";
import { Icon } from "./Icons";

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await authenticate(email, password, mode);
      if (!result.ok) {
        setError(result.error);
        audio.error();
        return;
      }
      audio.ensure();
      audio.setVolumes(0.6, 0.8);
      audio.playMusic("menu", 45);
      audio.purchase();
      onAuthenticated(result.session);
    } catch {
      setError("Could not access local account storage. Check your browser settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen auth-screen">
      <div className="auth-art" />
      <div className="auth-vignette" />
      <div className="scanlines" />
      <header className="auth-brand">
        <span className="brand-mark"><Icon name="crosshair" /></span>
        <div><strong>DUSKLINE</strong><small>SNIPER OPERATIONS</small></div>
      </header>

      <section className="auth-layout">
        <div className="auth-copy">
          <div className="eyebrow"><span className="pulse-dot" /> LONG-RANGE OPERATIONS · 5 THEATRES</div>
          <h1>Remember<br /><em>every shot.</em></h1>
          <p>Your campaign, weapons, mission stars and credits are saved to this browser profile.</p>
          <div className="auth-features">
            <span><Icon name="crosshair" /> 25 OPERATIONS</span>
            <span><Icon name="map" /> 5 THEATRES</span>
            <span><Icon name="skull" /> BOSS FIGHTS</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-form-head">
            <span className="card-label">OPERATIVE ACCESS</span>
            <h2>{mode === "signin" ? "Welcome back." : "Create your file."}</h2>
            <p>{mode === "signin" ? "Sign in to resume your campaign." : "A new profile saves progress on this device."}</p>
          </div>

          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>SIGN IN</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>CREATE ACCOUNT</button>
          </div>

          <label className="auth-field">
            <span>EMAIL ADDRESS</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="operative@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span>PASSWORD</span>
            <div className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Icon name="eye" />
              </button>
            </div>
          </label>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? "CHECKING CREDENTIALS..." : mode === "signin" ? "ENTER FIELD HQ" : "CREATE LOCAL PROFILE"}</span>
            <Icon name="play" />
          </button>

          <div className="local-notice"><Icon name="shield" /><span>LOCAL GAME PROFILE · Progress is stored in this browser only. This prototype has no server-side security or cross-device sync.</span></div>
        </form>
      </section>

      <footer className="auth-footer"><span>CLASSIFIED · LEVEL 04 CLEARANCE</span><span>SECURE CONNECTION NOT REQUIRED · OFFLINE READY</span></footer>
    </main>
  );
}