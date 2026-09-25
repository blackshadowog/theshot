export type MusicMode = "off" | "menu" | "stealth" | "alert" | "boss";
export type ShotSound = "bolt" | "semi" | "suppressed" | "heavy" | "rail";

// i – VI – III – VII : the classic "epic minor" action progression
const PROGRESSION: Array<{ root: number; third: number }> = [
  { root: 0, third: 3 },
  { root: -4, third: 4 },
  { root: 3, third: 4 },
  { root: -2, third: 4 },
];

const BPM: Record<Exclude<MusicMode, "off">, number> = {
  menu: 100,
  stealth: 108,
  alert: 150,
  boss: 172,
};

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeDriveCurve(amount: number) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private drumBus!: GainNode;
  private pump!: GainNode;
  private drive!: WaveShaperNode;
  private sfxBus!: GainNode;
  private ambientBus!: GainNode;
  private noise!: AudioBuffer;
  private delay!: DelayNode;
  private reverbSend!: GainNode;
  private mode: MusicMode = "off";
  private root = 45;
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;
  private ambient: AudioBufferSourceNode[] = [];
  private musicVolume = 0.6;
  private sfxVolume = 0.8;

  ensure() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 8;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      this.master.connect(compressor).connect(ctx.destination);

      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 18000;
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVolume * 0.55;
      this.musicFilter.connect(this.musicBus).connect(this.master);

      this.drumBus = ctx.createGain();
      this.drumBus.gain.value = 1;
      this.drumBus.connect(this.musicFilter);

      // Sidechain "pump": synth layers duck on every kick for that EDM / trailer surge
      this.pump = ctx.createGain();
      this.pump.gain.value = 1;
      this.pump.connect(this.musicFilter);

      this.drive = ctx.createWaveShaper();
      this.drive.curve = makeDriveCurve(18);
      this.drive.oversample = "2x";
      const driveOut = ctx.createGain();
      driveOut.gain.value = 0.45;
      this.drive.connect(driveOut).connect(this.pump);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;
      this.sfxBus.connect(this.master);

      this.ambientBus = ctx.createGain();
      this.ambientBus.gain.value = this.sfxVolume * 0.5;
      this.ambientBus.connect(this.master);

      // Shared echo — used for gunshots, bells, leads
      this.delay = ctx.createDelay(1.5);
      this.delay.delayTime.value = 0.3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.34;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 1600;
      this.delay.connect(delayFilter).connect(feedback).connect(this.delay);
      delayFilter.connect(this.sfxBus);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.35;
      this.reverbSend.connect(this.delay);

      const length = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(music * 0.55, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx, t, 0.1);
    this.ambientBus.gain.setTargetAtTime(sfx * 0.5, t, 0.1);
  }

  setSlowMo(active: boolean) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(active ? 650 : 18000, this.ctx.currentTime, 0.25);
  }

  // ================================================================ MUSIC
  playMusic(mode: MusicMode, root?: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (root !== undefined) this.root = root;
    if (mode === this.mode) return;
    const prev = this.mode;
    this.mode = mode;
    if (mode === "off") {
      window.clearInterval(this.timer);
      this.timer = undefined;
      return;
    }
    // restart on the downbeat so every new section hits hard
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    if (this.timer === undefined || prev === "off") {
      window.clearInterval(this.timer);
      this.timer = window.setInterval(() => this.schedule(), 25);
    }
    if (mode === "alert" || mode === "boss") {
      this.braam();
      this.cineImpact(ctx.currentTime + 0.02);
    }
  }

  private bpm() {
    return this.mode === "off" ? 100 : BPM[this.mode];
  }

  private schedule() {
    if (!this.ctx || this.mode === "off") return;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm() / 4;
      this.step += 1;
    }
  }

  private playStep(step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROGRESSION[bar % 4];
    const r = this.root + chord.root;
    const barLen = (60 / this.bpm()) * 4;

    // ---------------------------------------------- MENU: cinematic trailer build
    if (this.mode === "menu") {
      const phase = bar % 8;
      if (s === 0) this.choir(r + 12, chord.third, t, barLen, 0.035);
      if (s === 0 && phase === 0) this.braam();
      if (s === 0 || s === 6 || (s === 10 && phase >= 4)) this.kick(t, 0.8);
      if (s === 8 && phase >= 2) this.snare(t, 0.2);
      if (phase >= 4 && (s === 4 || s === 12)) this.snare(t, 0.3);
      if (s % 2 === 0) this.bass(r - 12, t, 0.12, phase >= 4 ? 0.13 : 0.09, 520, true);
      if (s % 2 === 1 && phase >= 2) this.hat(t, 0.02);
      if (phase === 7 && s >= 12) this.tom(t, 150 - (s - 12) * 18, 0.45);
      if (phase === 7 && s === 0) this.riser(t, barLen);
      if (phase >= 4) {
        const arp = [0, chord.third, 7, 12, 7, chord.third, 12, 7];
        if (s % 2 === 0) this.pluck(r + 24 + arp[(s / 2) % 8], t, 0.035);
      }
      if (s === 10 && bar % 2 === 1) this.bell(r + 24 + 7, t);
      return;
    }

    // ---------------------------------------------- STEALTH: tense, ticking, heartbeat
    if (this.mode === "stealth") {
      if (s === 0) this.pad(r + 12, chord.third, t, barLen, 0.045);
      if (s % 2 === 0) this.bass(r - 12, t, 0.12, s % 4 === 0 ? 0.13 : 0.07, 380, false);
      if (s === 0 || s === 3) this.kick(t, s === 0 ? 0.55 : 0.32);
      this.hat(t, s % 4 === 2 ? 0.03 : 0.012);
      if (s === 12) this.rim(t);
      if (s === 8 && bar % 2 === 1) this.tick(t);
      if (s === 6 && bar % 4 === 3) this.bell(r + 24 + 7, t);
      if (bar % 8 === 7 && s === 0) this.riser(t, barLen * 0.9, 0.06);
      return;
    }

    // ---------------------------------------------- ALERT: full adrenaline action
    if (this.mode === "alert") {
      const phase = bar % 8;
      if (s === 0 && phase % 4 === 0) this.crash(t);
      if (s === 0 && phase === 0) this.braam();
      if (s === 0) this.choir(r + 12, chord.third, t, barLen, 0.03);
      // drums
      if (s % 4 === 0 || (s === 14 && bar % 2 === 1)) this.kick(t, 1);
      if (s === 4 || s === 12) {
        this.snare(t, 0.34);
        this.clap(t);
      }
      if (phase % 4 === 3 && s >= 8) this.snare(t, 0.08 + (s - 8) * 0.03);
      this.hat(t, s % 4 === 2 ? 0.06 : 0.028, s % 4 === 2);
      if (phase % 4 === 3 && s >= 12) this.tom(t, 190 - (s - 12) * 25, 0.55);
      // rolling distorted bass in octaves
      const bassPat = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 10, 7];
      this.bass(r - 12 + bassPat[s], t, 0.09, 0.14, 1000, true);
      // power-chord stabs
      if (s === 0 || s === 6 || s === 10) this.stab([r + 12, r + 19, r + 24], t, 0.16, 0.05);
      // supersaw lead arp
      const lead = [12, 15, 19, 24, 19, 15, 12, 7];
      if (phase >= 2 && s % 2 === 0) this.supersaw(r + 12 + lead[(s / 2) % 8] + (chord.third === 4 && lead[(s / 2) % 8] === 15 ? 1 : 0), t, 0.13, 0.03);
      if (phase === 7 && s === 0) this.riser(t, barLen);
      return;
    }

    // ---------------------------------------------- BOSS: 172 BPM drum & bass war-machine
    const phase = bar % 8;
    if (s === 0 && phase % 4 === 0) {
      this.crash(t);
      this.braam();
      this.cineImpact(t);
    }
    if (s === 0 && phase === 0) this.siren(t, barLen * 2);
    if (s === 0) this.choir(r + 12, chord.third, t, barLen, 0.04);
    // breakbeat
    if (s === 0 || s === 10 || (s === 7 && bar % 2 === 1)) this.kick(t, 1);
    if (s === 4 || s === 12) {
      this.snare(t, 0.4);
      this.clap(t);
    }
    if (s === 7 || s === 15) this.snare(t, 0.07);
    this.hat(t, s % 2 === 0 ? 0.045 : 0.025, s === 14);
    // taiko war drums
    if (bar % 2 === 0 && (s === 0 || s === 3 || s === 6)) this.tom(t, 95, 0.7);
    if (phase % 4 === 3 && s >= 8 && s % 2 === 0) this.tom(t, 160 - (s - 8) * 12, 0.6);
    // reese bass — detuned, wobbling, distorted
    if (s === 0 || s === 8) this.reese(r - 12, t, barLen / 2, 0.16);
    // screaming lead
    const melody = [24, 22, 19, 22, 24, 27, 26, 22];
    if (phase >= 4 && s % 2 === 0) this.supersaw(r + melody[(s / 2) % 8], t, 0.12, 0.034);
    if (phase < 4 && (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14)) this.stab([r + 12, r + 19, r + 24], t, 0.12, 0.055);
    if (phase === 7 && s === 0) this.riser(t, barLen, 0.16);
  }

  // ---------------------------------------------- music instruments
  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private duck(t: number, depth = 0.3, release = 0.2) {
    this.pump.gain.cancelScheduledValues(t);
    this.pump.gain.setValueAtTime(depth, t);
    this.pump.gain.linearRampToValueAtTime(1, t + release);
  }

  private kick(t: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    this.env(gain, t, vol, 0.003, 0.34);
    osc.connect(gain).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.4);
    // click transient
    this.noiseHit(t, vol * 0.18, "highpass", 3500, 0.012, this.drumBus);
    this.duck(t, 0.28, 60 / this.bpm() / 2);
  }

  private noiseHit(t: number, vol: number, type: BiquadFilterType, freq: number, decay: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.002, decay);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + decay + 0.05);
    return gain;
  }

  private snare(t: number, vol: number) {
    this.noiseHit(t, vol, "highpass", 1300, 0.17, this.drumBus);
    this.noiseHit(t, vol * 0.5, "bandpass", 3200, 0.1, this.drumBus);
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.08);
    const gain = ctx.createGain();
    this.env(gain, t, vol * 0.5, 0.002, 0.1);
    osc.connect(gain).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  private clap(t: number) {
    for (let i = 0; i < 3; i += 1) this.noiseHit(t + i * 0.011, 0.12, "bandpass", 1500, 0.05 + i * 0.03, this.drumBus);
  }

  private rim(t: number) {
    this.noiseHit(t, 0.08, "bandpass", 2800, 0.03, this.drumBus);
  }

  private hat(t: number, vol: number, open = false) {
    this.noiseHit(t, vol, "highpass", 8200, open ? 0.14 : 0.03, this.drumBus);
  }

  private crash(t: number) {
    this.noiseHit(t, 0.14, "highpass", 5000, 1.6, this.drumBus);
  }

  private tom(t: number, freq: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.6, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.003, 0.4);
    osc.connect(gain).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.45);
    this.noiseHit(t, vol * 0.2, "lowpass", 900, 0.12, this.drumBus);
  }

  private tick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 2200;
    const gain = ctx.createGain();
    this.env(gain, t, 0.03, 0.001, 0.03);
    osc.connect(gain).connect(this.drumBus);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  private bass(midi: number, t: number, length: number, vol: number, cutoff: number, driven: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiToFreq(midi);
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = midiToFreq(midi - 12);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(cutoff * 2.4, t);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.45, t + length);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.004, length);
    const subGain = ctx.createGain();
    this.env(subGain, t, vol * 0.8, 0.004, length);
    osc.connect(filter).connect(gain).connect(driven ? this.drive : this.pump);
    if (driven) gain.connect(this.pump);
    sub.connect(subGain).connect(this.pump);
    osc.start(t);
    sub.start(t);
    osc.stop(t + length + 0.05);
    sub.stop(t + length + 0.05);
  }

  private reese(midi: number, t: number, length: number, vol: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 4;
    filter.frequency.value = 500;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = this.bpm() / 60 * 2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 420;
    lfo.connect(lfoGain).connect(filter.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    gain.gain.setValueAtTime(vol, t + length * 0.85);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    filter.connect(gain);
    gain.connect(this.drive);
    gain.connect(this.pump);
    for (const d of [-14, 14, 0]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(midi);
      osc.detune.value = d;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
    const sub = ctx.createOscillator();
    sub.frequency.value = midiToFreq(midi - 12);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(vol * 0.9, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + length);
    sub.connect(sg).connect(this.pump);
    sub.start(t);
    sub.stop(t + length + 0.05);
    lfo.start(t);
    lfo.stop(t + length + 0.05);
  }

  private supersaw(midi: number, t: number, length: number, vol: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(5200, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + length);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.005, length);
    filter.connect(gain).connect(this.pump);
    gain.connect(this.reverbSend);
    for (const d of [-22, -9, 0, 9, 22]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(midi);
      osc.detune.value = d;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + length + 0.05);
    }
  }

  private stab(notes: number[], t: number, length: number, vol: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3800, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + length);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.003, length);
    filter.connect(gain);
    gain.connect(this.drive);
    gain.connect(this.pump);
    for (const n of notes) {
      for (const d of [-12, 12]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiToFreq(n);
        osc.detune.value = d;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + length + 0.05);
      }
    }
  }

  private pluck(midi: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = midiToFreq(midi);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.14);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.003, 0.14);
    osc.connect(filter).connect(gain).connect(this.pump);
    gain.connect(this.reverbSend);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private pad(midi: number, third: number, t: number, length: number, vol: number) {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + length * 0.3);
    gain.gain.linearRampToValueAtTime(0.0001, t + length);
    filter.connect(gain).connect(this.pump);
    for (const interval of [0, third, 7]) {
      for (const detune of [-9, 9]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = midiToFreq(midi + interval);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + length + 0.1);
      }
    }
  }

  // Formant-filtered saws — a dark "war choir" ahh
  private choir(midi: number, third: number, t: number, length: number, vol: number) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + Math.min(0.4, length * 0.25));
    gain.gain.setValueAtTime(vol, t + length * 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, t + length);
    gain.connect(this.pump);
    gain.connect(this.reverbSend);
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 720;
    f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 1150;
    f2.Q.value = 6;
    f1.connect(gain);
    f2.connect(gain);
    for (const interval of [0, third, 7, 12]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(midi + interval);
      osc.detune.value = (Math.random() - 0.5) * 18;
      osc.connect(f1);
      osc.connect(f2);
      osc.start(t);
      osc.stop(t + length + 0.1);
    }
  }

  private bell(midi: number, t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiToFreq(midi);
    const gain = ctx.createGain();
    this.env(gain, t, 0.05, 0.005, 1.6);
    osc.connect(gain).connect(this.musicFilter);
    gain.connect(this.delay);
    osc.start(t);
    osc.stop(t + 1.7);
  }

  private riser(t: number, length: number, peak = 0.13) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(7000, t + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + length);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.05);
    src.connect(filter).connect(gain).connect(this.musicFilter);
    src.start(t);
    src.stop(t + length + 0.1);
    // pitch-rising tone underneath
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + length);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(peak * 0.25, t + length);
    og.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.05);
    osc.connect(og).connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + length + 0.1);
  }

  private siren(t: number, length: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    osc.frequency.value = 620;
    lfo.connect(lfoGain).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.022, t + 0.3);
    gain.gain.setValueAtTime(0.022, t + length * 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(this.musicFilter);
    gain.connect(this.delay);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + length + 0.1);
    lfo.stop(t + length + 0.1);
  }

  private cineImpact(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const gain = ctx.createGain();
    this.env(gain, t, 0.6, 0.005, 1.3);
    osc.connect(gain).connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + 1.4);
    this.noiseHit(t, 0.3, "lowpass", 1200, 0.9, this.musicFilter);
  }

  braam() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
    filter.frequency.exponentialRampToValueAtTime(140, t + 2.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.38, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    filter.connect(gain);
    gain.connect(this.musicBus);
    const shaped = ctx.createGain();
    shaped.gain.value = 0.35;
    gain.connect(shaped).connect(this.drive);
    for (const [n, d] of [[this.root - 24, -14], [this.root - 12, 9], [this.root - 5, 0], [this.root - 24, 16], [this.root, -6]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToFreq(n);
      osc.detune.value = d;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 2.9);
    }
  }

  // ================================================================ AMBIENCE
  startAmbient(kind: "wind" | "rain" | "calm") {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopAmbient();
    const layers: Array<[BiquadFilterType, number, number]> =
      kind === "rain" ? [["highpass", 2500, 0.18], ["lowpass", 500, 0.12]] : kind === "wind" ? [["bandpass", 420, 0.22]] : [["lowpass", 300, 0.1]];
    for (const [type, freq, vol] of layers) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      if (kind === "wind") {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.12;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain).connect(filter.frequency);
        lfo.start();
      }
      src.connect(filter).connect(gain).connect(this.ambientBus);
      src.start();
      this.ambient.push(src);
    }
  }

  stopAmbient() {
    for (const src of this.ambient) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    }
    this.ambient = [];
  }

  // ================================================================ SFX
  shot(kind: ShotSound) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (kind === "suppressed") {
      this.noiseHit(t, 0.35, "bandpass", 1800, 0.08, this.sfxBus);
      this.thump(t, 0.25, 180, 60, 0.12);
      return;
    }
    if (kind === "rail") {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
      const gain = ctx.createGain();
      this.env(gain, t, 0.22, 0.004, 0.25);
      osc.connect(gain).connect(this.sfxBus);
      gain.connect(this.delay);
      osc.start(t);
      osc.stop(t + 0.3);
      this.noiseHit(t, 0.5, "lowpass", 3000, 0.3, this.sfxBus);
      this.thump(t, 0.7, 120, 30, 0.4);
      return;
    }
    const heavy = kind === "heavy";
    const crack = this.noiseHit(t, heavy ? 1 : 0.8, "lowpass", heavy ? 2600 : 4200, heavy ? 0.5 : 0.28, this.sfxBus);
    crack.connect(this.delay);
    this.thump(t, heavy ? 1 : 0.7, heavy ? 110 : 160, 35, heavy ? 0.55 : 0.3);
    if (kind === "bolt") this.bolt(t + 0.45);
  }

  private thump(t: number, vol: number, from: number, to: number, decay: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + decay);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.002, decay);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  private click(t: number, freq: number, vol = 0.15) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.03);
    const gain = ctx.createGain();
    this.env(gain, t, vol, 0.001, 0.04);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.06);
    this.noiseHit(t, vol * 0.8, "highpass", 3000, 0.03, this.sfxBus);
  }

  bolt(t?: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const s = t ?? ctx.currentTime;
    this.click(s, 900);
    this.click(s + 0.14, 700);
    this.click(s + 0.32, 1100);
    this.click(s + 0.44, 800);
  }

  reload(duration: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.click(t + 0.05, 600, 0.18);
    this.noiseHit(t + 0.1, 0.1, "bandpass", 900, 0.15, this.sfxBus);
    this.click(t + duration * 0.55, 500, 0.2);
    this.click(t + duration * 0.85, 1000, 0.18);
    this.click(t + duration * 0.95, 750, 0.18);
  }

  dryFire() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.click(ctx.currentTime, 1500, 0.12);
  }

  hit(headshot: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.06;
    this.noiseHit(t, 0.25, "bandpass", 600, 0.08, this.sfxBus);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = headshot ? 1320 : 880;
    const gain = ctx.createGain();
    this.env(gain, t, headshot ? 0.14 : 0.08, 0.003, headshot ? 0.35 : 0.15);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.4);
    if (headshot) {
      const o2 = ctx.createOscillator();
      o2.frequency.value = 1980;
      const g2 = ctx.createGain();
      this.env(g2, t + 0.05, 0.07, 0.003, 0.3);
      o2.connect(g2).connect(this.sfxBus);
      o2.start(t + 0.05);
      o2.stop(t + 0.4);
    }
  }

  impact() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noiseHit(ctx.currentTime + 0.08, 0.12, "bandpass", 2400, 0.06, this.sfxBus);
  }

  enemyShot(distance: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + distance / 340;
    const vol = Math.max(0.12, 0.5 - distance / 150);
    this.noiseHit(t, vol, "bandpass", 1500, 0.09, this.sfxBus).connect(this.delay);
    this.thump(t, vol * 0.6, 120, 50, 0.2);
  }

  whiz() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 8;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.2);
    const gain = ctx.createGain();
    this.env(gain, t, 0.3, 0.02, 0.18);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.25);
  }

  hurt() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.thump(t, 0.9, 90, 40, 0.3);
    this.noiseHit(t, 0.35, "lowpass", 800, 0.2, this.sfxBus);
  }

  heartbeat() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.thump(t, 0.5, 70, 40, 0.15);
    this.thump(t + 0.22, 0.4, 65, 38, 0.15);
  }

  // Rising targeting beep for the boss laser lock
  lockBeep(progress: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 900 + progress * 1100;
    const gain = ctx.createGain();
    this.env(gain, t, 0.05 + progress * 0.05, 0.002, 0.06);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  alarm() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i += 1) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(620, t + i * 0.32);
      osc.frequency.linearRampToValueAtTime(980, t + i * 0.32 + 0.24);
      const gain = ctx.createGain();
      this.env(gain, t + i * 0.32, 0.07, 0.01, 0.26);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t + i * 0.32);
      osc.stop(t + i * 0.32 + 0.3);
    }
  }

  zoom() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.click(ctx.currentTime, 2400, 0.06);
  }

  scope(inward: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noiseHit(ctx.currentTime, 0.08, "bandpass", inward ? 1200 : 800, 0.1, this.sfxBus);
  }

  slowmo(active: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(active ? 500 : 80, t);
    osc.frequency.exponentialRampToValueAtTime(active ? 60 : 500, t + 0.6);
    const gain = ctx.createGain();
    this.env(gain, t, 0.3, 0.05, 0.6);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.7);
    this.setSlowMo(active);
  }

  ui() {
    const ctx = this.ensure();
    if (!ctx) return;
    this.click(ctx.currentTime, 1800, 0.05);
  }

  hover() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 2600;
    const gain = this.ctx.createGain();
    this.env(gain, t, 0.015, 0.001, 0.03);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  coin() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [1318, 1760].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      this.env(gain, t + i * 0.07, 0.1, 0.003, 0.2);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.25);
    });
  }

  purchase() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const gain = ctx.createGain();
      this.env(gain, t + i * 0.06, 0.1, 0.003, 0.25);
      osc.connect(gain).connect(this.sfxBus);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    });
    this.click(t, 700, 0.15);
  }

  error() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 110;
    const gain = ctx.createGain();
    this.env(gain, t, 0.08, 0.005, 0.2);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  stinger(win: boolean) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = win ? [0, 7, 12, 16, 19, 24] : [0, -1, -5, -12];
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = win ? "sawtooth" : "sawtooth";
      osc.frequency.value = midiToFreq(this.root + 12 + n);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = win ? 3400 : 900;
      const gain = ctx.createGain();
      this.env(gain, t + i * 0.1, win ? 0.09 : 0.12, 0.01, 1.4);
      osc.connect(filter).connect(gain).connect(this.sfxBus);
      gain.connect(this.delay);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 1.5);
    });
    this.thump(t, 0.9, 80, 30, 1.1);
    if (win) this.noiseHit(t, 0.12, "highpass", 5000, 1.8, this.sfxBus);
  }
}

export const audio = new AudioEngine();
