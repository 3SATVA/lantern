function midi(note: number): number {
  return 220 * 2 ** (note / 12);
}

export class AudioBus {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private timer = 0;
  private step = 0;
  private scale = [0, 3, 5, 7, 10];
  private vibe: "title" | "explore" | "boss" = "title";

  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(ctx.destination);
      this.music = ctx.createGain();
      this.music.gain.value = 0.35;
      this.music.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.22;
  }

  update(dt: number, scale: number[], vibe: "title" | "explore" | "boss"): void {
    if (!this.ctx || !this.music) return;
    this.scale = scale;
    if (vibe !== this.vibe) {
      this.vibe = vibe;
      this.step = 0;
    }
    this.timer -= dt;
    const beat = vibe === "boss" ? 0.16 : vibe === "title" ? 0.34 : 0.26;
    if (this.timer > 0) return;
    this.timer += beat;
    const s = this.step % 16;
    const degree = this.scale[s % this.scale.length];
    const bass = this.scale[Math.floor(s / 2) % this.scale.length];
    if (s % 2 === 0) this.tone(midi(bass - 12), beat * 0.9, "square", 0.05, this.music);
    if (vibe !== "title" || s % 4 === 0) {
      const jump = vibe === "boss" && s % 4 === 3 ? 12 : 0;
      this.tone(midi(degree + 12 + jump), beat * 0.55, "square", 0.04, this.music);
    }
    if (vibe === "boss" && s % 2 === 0) this.noise(0.04, 0.03, this.music);
    if (vibe === "explore" && s === 0) this.tone(midi(degree + 24), 0.18, "triangle", 0.03, this.music);
    this.step++;
  }

  sfx(kind: string): void {
    if (!this.ctx || !this.master || this.muted) return;
    const out = this.master;
    switch (kind) {
      case "bolt":
        this.tone(640, 0.08, "square", 0.06, out, 220);
        break;
      case "whip":
        this.noise(0.09, 0.07, out);
        this.tone(180, 0.1, "sawtooth", 0.04, out, -80);
        break;
      case "nova":
        this.tone(420, 0.16, "square", 0.06, out, -200);
        break;
      case "mote":
        this.tone(520, 0.12, "triangle", 0.05, out, 80);
        break;
      case "lance":
        this.tone(880, 0.09, "square", 0.05, out, -400);
        break;
      case "hit":
        this.noise(0.05, 0.05, out);
        this.tone(220, 0.06, "square", 0.04, out, -100);
        break;
      case "hurt":
        this.tone(110, 0.16, "sawtooth", 0.07, out, -40);
        break;
      case "coin":
        this.tone(880, 0.06, "square", 0.05, out);
        this.tone(1320, 0.08, "square", 0.04, out);
        break;
      case "buy":
        this.tone(523, 0.08, "square", 0.05, out);
        this.tone(659, 0.1, "square", 0.05, out);
        break;
      case "deny":
        this.tone(90, 0.12, "square", 0.05, out);
        break;
      case "boss":
        this.tone(70, 0.4, "sawtooth", 0.08, out, 30);
        break;
      case "core":
        this.tone(440, 0.2, "triangle", 0.06, out, 220);
        this.tone(660, 0.3, "triangle", 0.05, out);
        break;
      case "ui":
        this.tone(500, 0.04, "square", 0.04, out);
        break;
      case "die":
        this.tone(300, 0.3, "sawtooth", 0.06, out, -220);
        break;
      default:
        break;
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    dest: AudioNode,
    slide = 0,
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const n = 2 * Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, Math.max(1, n), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
  }
}
