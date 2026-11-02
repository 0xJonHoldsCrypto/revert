export class ChipSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.08;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  blip(freq = 440, dur = 0.06, type: OscillatorType = "square") {
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(this.master!);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  hit() {
    this.blip(180 + Math.random() * 40, 0.05, "square");
  }

  levelUp() {
    this.blip(523, 0.08);
    setTimeout(() => this.blip(659, 0.08), 70);
    setTimeout(() => this.blip(784, 0.12), 140);
  }

  dash() {
    this.blip(320, 0.04, "triangle");
  }
}

export type MusicRegion = "wasteland" | "cex" | "defi" | "apt";

export class MusicDirector {
  private synth = new ChipSynth();
  private region: MusicRegion = "wasteland";
  private interval: number | null = null;
  private step = 0;

  readonly patterns: Record<MusicRegion, number[]> = {
    wasteland: [196, 0, 220, 0, 247, 220, 196, 0],
    cex: [262, 294, 330, 294, 262, 247, 262, 0],
    defi: [330, 370, 415, 370, 330, 294, 330, 0],
    apt: [185, 196, 207, 196, 185, 174, 185, 0],
  };

  resume() {
    this.synth.resume();
  }

  regionForPosition(x: number, y: number): MusicRegion {
    if (x < 1600 && y < 1600) return "wasteland";
    if (x >= 3200) return "cex";
    if (y >= 3200) return "defi";
    if (x >= 1600 && y >= 1600 && x < 3200 && y < 3200) return "apt";
    return "wasteland";
  }

  updateRegion(x: number, y: number) {
    const next = this.regionForPosition(x, y);
    if (next === this.region) return;
    const prev = this.region;
    this.region = next;
    this.crossfade(prev, next);
  }

  private crossfade(_from: MusicRegion, _to: MusicRegion) {
    this.synth.blip(440, 0.03, "triangle");
  }

  start() {
    if (this.interval !== null) return;
    this.interval = window.setInterval(() => {
      const pat = this.patterns[this.region];
      const freq = pat[this.step % pat.length]!;
      if (freq > 0) this.synth.blip(freq, 0.07, "square");
      this.step++;
    }, 160);
  }

  stop() {
    if (this.interval !== null) window.clearInterval(this.interval);
    this.interval = null;
    this.step = 0;
  }
}
