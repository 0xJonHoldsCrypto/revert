import * as save from "../save";
import { noteFrequency, parsePattern, TRACKS, type MusicTrackId } from "./music";

export type SfxId =
  | "hit" | "crit" | "kill" | "coin" | "xp" | "hurt" | "dash" | "levelUp" | "cardSelect" | "chest" | "jackpot"
  | "evolve" | "bossSpawn" | "bossDeath" | "enemyShot" | "nearMiss" | "ui" | "blip" | "pager" | "type" | "alarm"
  | "txConfirmed" | "liquidation" | "gasSpike" | "rugPull" | "thud" | "skitter" | "whoosh" | "sting" | "riser"
  | "glitch" | "suck" | "impact" | "snore" | "death" | "pulse" | "ascend" | "surge" | "overclock" | "overclockEnd";

type Category = "combat" | "pickup" | "free";

const CATEGORY: Partial<Record<SfxId, Category>> = {
  hit: "combat", crit: "combat", kill: "combat", enemyShot: "combat", pulse: "combat",
  xp: "pickup", coin: "pickup", type: "pickup", blip: "pickup",
};
const MIN_GAP: Record<Category, number> = { combat: 1 / 5, pickup: 1 / 9, free: 0 };
const FROZEN_ALLOWED = new Set<SfxId>(["ui", "cardSelect", "levelUp", "jackpot", "evolve", "ascend", "surge"]);
const MUSIC_TRIM = 0.55;
const FROZEN_MUSIC_SHARE = 0.3;
const LEVEL_JINGLE_GAP_SEC = 1.5;
const LOOKAHEAD_SEC = 0.3;
const SCHEDULE_MS = 30;
const CROSSFADE_BARS = 2;
const MASTER_GAIN = 0.9;

type ActiveTrack = {
  id: MusicTrackId;
  bus: GainNode;
  lead: string[];
  arp: string[];
  bass: string[];
  drums: string[];
  step: number;
  nextTime: number;
  stepSec: number;
  loop: boolean;
  stopped: boolean;
  stopAt: number;
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private uiBus: GainNode | null = null;
  private lastLevelJingle = -10;
  private noise: AudioBuffer | null = null;
  private tracks: ActiveTrack[] = [];
  private timer: number | null = null;
  private lastPlayed: Record<Category, number> = { combat: -1, pickup: -1, free: -1 };
  private xpCombo = 0;
  private xpComboAt = 0;
  private wantedTrack: MusicTrackId | null = null;
  muted = false;
  onMuteChange: ((muted: boolean) => void) | null = null;
  silenced = false;
  private frozen = false;
  private intensity = false;
  musicVolume = 1;
  sfxVolume = 1;

  constructor() {
    const { muted, music, sfx } = save.get().settings;
    this.muted = muted;
    this.musicVolume = music;
    this.sfxVolume = sfx;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    if (this.wantedTrack && !this.tracks.some((t) => t.id === this.wantedTrack && !t.stopped)) this.setMusic(this.wantedTrack, true);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolumes();
    this.persist();
    this.onMuteChange?.(this.muted);
  }

  duck(on: boolean) {
    if (this.frozen === on) return;
    this.frozen = on;
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const music = this.musicVolume * MUSIC_TRIM * (on ? FROZEN_MUSIC_SHARE : 1);
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setTargetAtTime(music, now, 0.25);
    this.sfxBus.gain.cancelScheduledValues(now);
    this.sfxBus.gain.setTargetAtTime(on ? 0 : this.sfxVolume, now, on ? 0.008 : 0.03);
  }

  setWindowActive(active: boolean) {
    if (!this.ctx) return;
    if (active && this.ctx.state === "suspended") void this.ctx.resume();
    if (!active && this.ctx.state === "running") void this.ctx.suspend();
  }

  private persist() {
    save.patch((d) => {
      d.settings.muted = this.muted;
      d.settings.music = this.musicVolume;
      d.settings.sfx = this.sfxVolume;
    });
  }

  setMusicVolume(value: number) {
    this.musicVolume = Math.min(1, Math.max(0, value));
    if (this.ctx && this.musicBus) {
      const share = this.frozen ? FROZEN_MUSIC_SHARE : 1;
      this.musicBus.gain.setTargetAtTime(this.musicVolume * MUSIC_TRIM * share, this.ctx.currentTime, 0.03);
    }
    this.persist();
  }

  setSfxVolume(value: number) {
    this.sfxVolume = Math.min(1, Math.max(0, value));
    if (this.ctx && this.sfxBus && this.uiBus) {
      this.sfxBus.gain.setTargetAtTime(this.frozen ? 0 : this.sfxVolume, this.ctx.currentTime, 0.03);
      this.uiBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.03);
    }
    this.persist();
  }

  private applyVolumes() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.02);
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(comp);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * MUSIC_TRIM * (this.frozen ? FROZEN_MUSIC_SHARE : 1);
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.frozen ? 0 : this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = this.sfxVolume;
    this.uiBus.connect(this.master);
    const length = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_MS);
    return ctx;
  }

  setMusic(id: MusicTrackId | null, immediate = false) {
    if (this.wantedTrack === id && !immediate) return;
    this.wantedTrack = id;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    let startAt = now + 0.03;
    let fade = 0.25;
    const current = this.tracks.find((t) => !t.stopped && Number.isFinite(t.nextTime));
    if (current && !immediate) {
      const barSteps = 16;
      const remaining = barSteps - (current.step % barSteps);
      startAt = Math.max(now + 0.02, current.nextTime + remaining * current.stepSec);
      fade = CROSSFADE_BARS * barSteps * current.stepSec * 0.5;
    }
    for (const t of this.tracks) {
      if (t.stopped) continue;
      t.stopped = true;
      t.stopAt = startAt + fade * 1.5;
      t.bus.gain.setTargetAtTime(0, immediate ? now : Math.max(now, startAt - fade * 0.3), fade * 0.3);
      const bus = t.bus;
      window.setTimeout(() => bus.disconnect(), (t.stopAt - now) * 1000 + 300);
    }
    if (!id) return;
    const def = TRACKS[id];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, startAt);
    bus.gain.linearRampToValueAtTime(1, startAt + Math.min(fade, 0.6));
    bus.connect(this.musicBus!);
    this.tracks.push({
      id,
      bus,
      lead: parsePattern(def.lead),
      arp: parsePattern(def.arp),
      bass: parsePattern(def.bass),
      drums: parsePattern(def.drums),
      step: 0,
      nextTime: startAt,
      stepSec: 60 / def.bpm / 4,
      loop: def.loop,
      stopped: false,
      stopAt: Infinity,
    });
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD_SEC;
    this.tracks = this.tracks.filter((t) => now < t.stopAt);
    for (const t of this.tracks) {
      while (t.nextTime < horizon) {
        const longest = Math.max(t.lead.length, t.arp.length, t.bass.length, t.drums.length);
        if (!t.loop && t.step >= longest) {
          t.nextTime = Infinity;
          break;
        }
        if (t.nextTime >= now) this.playStep(t);
        t.step++;
        t.nextTime += t.stepSec;
      }
    }
  }

  private playStep(t: ActiveTrack) {
    const at = t.nextTime;
    const lead = t.lead[t.step % t.lead.length];
    if (lead && lead !== ".") this.tone(t.bus, noteFrequency(lead), at, t.stepSec * 1.7, "square", 0.085, 0.25, 0.012);
    const arp = t.arp[t.step % t.arp.length];
    if (arp && arp !== ".") this.tone(t.bus, noteFrequency(arp), at, t.stepSec * 0.8, "triangle", 0.06, -0.25, 0);
    const bass = t.bass[t.step % t.bass.length];
    if (bass && bass !== ".") this.tone(t.bus, noteFrequency(bass), at, t.stepSec * 1.3, "sawtooth", 0.11, 0, 0, 480);
    const drum = t.drums[t.step % t.drums.length];
    if (drum === "k") this.kick(t.bus, at);
    if (drum === "s") this.noiseHit(t.bus, at, 0.1, 0.13, 1900, "bandpass");
    if (drum === "h") this.noiseHit(t.bus, at, 0.028, 0.045, 7200, "highpass");
    if (this.intensity) {
      if (t.step % 4 === 0 && drum !== "k") this.kick(t.bus, at);
      if (t.step % 2 === 1 && drum !== "h") this.noiseHit(t.bus, at, 0.028, 0.05, 7600, "highpass");
      const note = arp && arp !== "." ? arp : bass && bass !== "." ? bass : null;
      if (note && t.step % 2 === 0) this.tone(t.bus, noteFrequency(note) * 2, at, t.stepSec * 0.6, "square", 0.035, 0.3, 0);
    }
  }

  private tone(out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, gain: number, pan: number, vibrato: number, lowpass = 0) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (vibrato > 0) osc.detune.setValueAtTime(vibrato * 800, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let tail: AudioNode = osc;
    if (lowpass > 0) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      osc.connect(f);
      tail = f;
    }
    tail.connect(g);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    g.connect(panner);
    panner.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private kick(out: AudioNode, at: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.26, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + 0.18);
  }

  private noiseHit(out: AudioNode, at: number, dur: number, gain: number, freq: number, type: BiquadFilterType, sweepTo = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, at);
    if (sweepTo > 0) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(at, Math.random() * 0.8);
    src.stop(at + dur + 0.02);
  }

  private sweep(at: number, from: number, to: number, dur: number, type: OscillatorType, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(this.activeBus());
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private activeBus(): GainNode {
    return this.frozen ? this.uiBus! : this.sfxBus!;
  }

  private seq(at: number, notes: number[], gap: number, dur: number, type: OscillatorType, gain: number) {
    notes.forEach((f, i) => this.tone(this.activeBus(), f, at + i * gap, dur, type, gain, 0, 0));
  }

  play(id: SfxId) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.sfxBus || this.silenced) return;
    if (this.frozen && !FROZEN_ALLOWED.has(id)) return;
    const now = ctx.currentTime;
    const category = CATEGORY[id] ?? "free";
    if (category !== "free") {
      if (now - this.lastPlayed[category] < MIN_GAP[category]) return;
      this.lastPlayed[category] = now;
    }
    if (id === "levelUp") {
      if (now - this.lastLevelJingle < LEVEL_JINGLE_GAP_SEC) return;
      this.lastLevelJingle = now;
    }
    const bus = this.activeBus();
    switch (id) {
      case "hit": this.noiseHit(bus, now, 0.04, 0.05, 2600 + Math.random() * 900, "bandpass"); this.sweep(now, 300, 140, 0.05, "square", 0.025); break;
      case "crit": this.sweep(now, 1100, 300, 0.09, "square", 0.1); this.noiseHit(bus, now, 0.07, 0.14, 3800, "highpass"); break;
      case "kill": this.sweep(now, 520, 90, 0.1, "square", 0.045); this.noiseHit(bus, now, 0.09, 0.055, 1200, "bandpass"); break;
      case "coin": this.seq(now, [1320, 1760], 0.05, 0.1, "square", 0.03); break;
      case "xp": {
        this.xpCombo = now - this.xpComboAt < 0.6 ? Math.min(this.xpCombo + 1, 12) : 0;
        this.xpComboAt = now;
        this.tone(bus, 880 * Math.pow(2, this.xpCombo / 12), now, 0.07, "triangle", 0.05, 0, 0);
        break;
      }
      case "hurt": this.sweep(now, 240, 60, 0.2, "sawtooth", 0.2); this.noiseHit(bus, now, 0.14, 0.18, 900, "lowpass"); break;
      case "dash": this.noiseHit(bus, now, 0.18, 0.14, 900, "bandpass", 4200); break;
      case "levelUp": this.seq(now, [523, 659, 784, 1047, 1319], 0.065, 0.2, "square", 0.075); break;
      case "cardSelect": this.seq(now, [660, 990], 0.05, 0.12, "square", 0.08); break;
      case "chest": this.seq(now, [392, 494, 587, 784], 0.07, 0.2, "triangle", 0.14); break;
      case "jackpot": this.seq(now, [784, 988, 1175, 1568, 1976, 2349], 0.06, 0.26, "square", 0.08); break;
      case "evolve": this.sweep(now, 200, 1800, 0.5, "sawtooth", 0.09); this.seq(now + 0.5, [1047, 1319, 1568, 2093], 0.07, 0.3, "square", 0.08); break;
      case "bossSpawn": this.sweep(now, 180, 30, 0.7, "sawtooth", 0.3); this.noiseHit(bus, now, 0.5, 0.3, 500, "lowpass"); break;
      case "bossDeath": this.sweep(now, 700, 25, 1.1, "sawtooth", 0.26); this.noiseHit(bus, now, 1.2, 0.34, 2200, "lowpass", 90); break;
      case "enemyShot": this.sweep(now, 820, 360, 0.09, "square", 0.025); break;
      case "nearMiss": this.noiseHit(bus, now, 0.12, 0.06, 5000, "highpass"); break;
      case "ui": this.tone(bus, 740, now, 0.05, "square", 0.06, 0, 0); break;
      case "blip": this.tone(bus, 520 + Math.random() * 80, now, 0.03, "square", 0.04, 0, 0); break;
      case "pager": for (let i = 0; i < 4; i++) this.tone(bus, 2200, now + i * 0.11, 0.07, "square", 0.08, 0, 0); this.sweep(now, 90, 80, 0.46, "sawtooth", 0.14); break;
      case "type": this.noiseHit(bus, now, 0.02, 0.08, 3400, "bandpass"); break;
      case "alarm": for (let i = 0; i < 3; i++) this.sweep(now + i * 0.3, 900, 550, 0.27, "square", 0.045); break;
      case "txConfirmed": this.seq(now, [988, 1319], 0.08, 0.24, "triangle", 0.14); break;
      case "liquidation": this.seq(now, [622, 523, 415, 311], 0.08, 0.18, "sawtooth", 0.09); break;
      case "gasSpike": this.sweep(now, 110, 1500, 0.6, "sawtooth", 0.08); break;
      case "rugPull": this.noiseHit(bus, now, 0.35, 0.18, 2600, "bandpass", 180); this.sweep(now, 500, 60, 0.35, "square", 0.08); break;
      case "thud": this.sweep(now, 170, 30, 0.3, "sine", 0.55); this.noiseHit(bus, now, 0.2, 0.3, 700, "lowpass"); break;
      case "skitter": for (let i = 0; i < 6; i++) this.noiseHit(bus, now + i * 0.055, 0.03, 0.12, 2400, "bandpass"); break;
      case "whoosh": this.noiseHit(bus, now, 0.32, 0.2, 500, "bandpass", 5200); break;
      case "sting": this.seq(now, [233, 247], 0.02, 0.55, "sawtooth", 0.13); this.noiseHit(bus, now, 0.2, 0.16, 3000, "highpass"); break;
      case "riser": this.sweep(now, 90, 1300, 1.2, "sawtooth", 0.1); this.noiseHit(bus, now, 1.2, 0.16, 300, "bandpass", 7000); break;
      case "glitch": for (let i = 0; i < 9; i++) this.tone(bus, 180 + Math.random() * 2400, now + i * 0.035, 0.03, "square", 0.08, Math.random() * 2 - 1, 0); break;
      case "suck": this.sweep(now, 1300, 70, 1.1, "sawtooth", 0.12); this.noiseHit(bus, now, 1.1, 0.26, 6000, "bandpass", 220); break;
      case "impact": this.sweep(now, 130, 28, 0.42, "sine", 0.6); this.noiseHit(bus, now, 0.25, 0.42, 2600, "lowpass", 200); break;
      case "snore": this.sweep(now, 80, 130, 0.5, "sawtooth", 0.08); this.sweep(now + 0.55, 150, 70, 0.4, "triangle", 0.1); break;
      case "death": this.sweep(now, 480, 36, 0.9, "square", 0.2); this.noiseHit(bus, now, 0.5, 0.3, 1200, "lowpass"); break;
      case "pulse": this.sweep(now, 80, 240, 0.16, "sine", 0.1); this.noiseHit(bus, now, 0.16, 0.035, 700, "bandpass"); break;
      case "ascend":
        this.sweep(now, 70, 40, 0.5, "sine", 0.55);
        this.noiseHit(bus, now, 0.4, 0.35, 3200, "lowpass", 300);
        this.sweep(now + 0.08, 180, 2400, 0.55, "sawtooth", 0.1);
        this.seq(now + 0.45, [523, 659, 784, 1047, 1319, 1568], 0.07, 0.4, "square", 0.09);
        this.seq(now + 0.45, [262, 330, 392], 0.07, 0.6, "triangle", 0.12);
        break;
      case "surge":
        this.sweep(now, 120, 900, 0.35, "sawtooth", 0.12);
        this.seq(now + 0.1, [392, 587, 784, 988, 1175], 0.06, 0.3, "square", 0.08);
        this.noiseHit(bus, now, 0.25, 0.14, 5200, "highpass");
        break;
      case "overclock":
        this.sweep(now, 60, 30, 0.45, "sine", 0.6);
        this.sweep(now, 220, 1600, 0.3, "sawtooth", 0.12);
        this.noiseHit(bus, now, 0.45, 0.3, 1800, "bandpass", 6000);
        this.seq(now + 0.2, [330, 440, 659, 880], 0.05, 0.25, "square", 0.08);
        break;
      case "overclockEnd":
        this.sweep(now, 900, 90, 0.5, "sawtooth", 0.1);
        this.noiseHit(bus, now, 0.3, 0.1, 1200, "lowpass");
        break;
    }
  }

  setIntensity(on: boolean) {
    this.intensity = on;
  }

  dispose() {
    if (this.timer !== null) window.clearInterval(this.timer);
  }
}
