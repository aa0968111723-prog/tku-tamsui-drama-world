/** Lightweight WebAudio SFX — unlocks on first gesture. */

type SfxKind =
  | "hit"
  | "slash"
  | "hurt"
  | "pickup"
  | "levelup"
  | "ui"
  | "boss"
  | "dash"
  | "heal"
  | "win"
  | "step";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  muted = false;

  ensure() {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
  }

  unlock() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slide = 0,
    delay = 0,
  ) {
    if (this.muted || !this.unlocked || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 1200) {
    if (this.muted || !this.unlocked || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t0);
  }

  play(kind: SfxKind) {
    this.unlock();
    switch (kind) {
      case "slash":
        this.noise(0.08, 0.12, 2800);
        this.tone(520, 0.08, "square", 0.05, -200);
        break;
      case "hit":
        this.tone(180, 0.1, "sawtooth", 0.08, -80);
        this.noise(0.06, 0.1, 900);
        break;
      case "hurt":
        this.tone(140, 0.18, "triangle", 0.09, -60);
        this.tone(90, 0.2, "sine", 0.06, -30, 0.02);
        break;
      case "pickup":
        this.tone(660, 0.08, "sine", 0.07, 120);
        this.tone(880, 0.1, "sine", 0.05, 0, 0.06);
        break;
      case "levelup":
        this.tone(392, 0.1, "square", 0.06);
        this.tone(523, 0.1, "square", 0.06, 0, 0.1);
        this.tone(659, 0.16, "square", 0.07, 0, 0.2);
        break;
      case "ui":
        this.tone(700, 0.05, "sine", 0.04);
        break;
      case "boss":
        this.tone(80, 0.35, "sawtooth", 0.1, -20);
        this.noise(0.25, 0.14, 400);
        break;
      case "dash":
        this.noise(0.1, 0.1, 2200);
        this.tone(300, 0.08, "triangle", 0.05, 200);
        break;
      case "heal":
        this.tone(440, 0.1, "sine", 0.06, 80);
        this.tone(660, 0.14, "sine", 0.05, 0, 0.08);
        break;
      case "win":
        this.tone(523, 0.12, "square", 0.06);
        this.tone(659, 0.12, "square", 0.06, 0, 0.12);
        this.tone(784, 0.22, "square", 0.07, 0, 0.24);
        break;
      case "step":
        this.noise(0.04, 0.03, 600);
        break;
    }
  }
}

export const audio = new GameAudio();
