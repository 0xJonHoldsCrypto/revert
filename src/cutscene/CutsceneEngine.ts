import type { CharacterId } from "../types";
import { getSideHero } from "../pixel/hdField";
import { getMonsterSprite } from "../pixel/gbcArt";
import { FONT_MONO, INK } from "../ui/theme";

export type CutsceneId = "intro" | "boss-414" | "boss-phish" | "boss-apt" | "boss-grand" | "boss-mev" | "boss-oracle" | "victory";

type SceneId = "night" | "alarm" | "lights" | "screen" | "hackers" | "boss" | "victory";

type Beat = {
  duration: number;
  speaker: string;
  text: string;
  scene: SceneId;
};

const INTRO_BEATS: Beat[] = [
  {
    duration: 3.1,
    speaker: "Night shift",
    text: "The floor is dark. One developer. One laptop. The rest of the exchange is asleep.",
    scene: "night",
  },
  {
    duration: 2.6,
    speaker: "Pager",
    text: "The alarm hits. Hot-wallet outflow. He is already out of the chair.",
    scene: "alarm",
  },
  {
    duration: 2.8,
    speaker: "Security dev",
    text: "He throws the lamp on. The room stays dim. The screen is already wrong.",
    scene: "lights",
  },
  {
    duration: 3.4,
    speaker: "Exploit.run SOC",
    text: "Lazarus is inside the exchange. Billions are moving, and the block is not waiting.",
    scene: "screen",
  },
  {
    duration: 3,
    speaker: "Lazarus crew",
    text: "On the other side of the chain, the hackers are pulling the funds out by hand.",
    scene: "hackers",
  },
  {
    duration: 2.4,
    speaker: "Hero",
    text: "Not on my watch. Exploit.run is live. Hold the chain.",
    scene: "victory",
  },
];

const BOSS_BEATS: Record<string, Beat[]> = {
  "boss-414": [
    { duration: 2.4, speaker: "Lazarus Unit 414", text: "We mapped the withdrawal flow. Empty the vault.", scene: "boss" },
  ],
  "boss-phish": [
    { duration: 2.4, speaker: "Phish King", text: "Sign this benign transaction. Trust the popup.", scene: "boss" },
  ],
  "boss-apt": [
    { duration: 2.4, speaker: "APT38", text: "SWIFT was practice. DeFi is the mainnet heist.", scene: "boss" },
  ],
  "boss-mev": [
    { duration: 2.4, speaker: "MEV King", text: "I see your transaction before you do. The block is already mine.", scene: "boss" },
  ],
  "boss-oracle": [
    { duration: 2.4, speaker: "Oracle Sovereign", text: "Price is whatever I say it is. Liquidate.", scene: "boss" },
  ],
  "boss-grand": [
    { duration: 2.6, speaker: "Grandmaster", text: "Final patch. Your chain ends here.", scene: "boss" },
  ],
  victory: [
    { duration: 2.8, speaker: "Security dev", text: "Exploit contained. The outflow stopped. Touch grass, anon.", scene: "victory" },
  ],
};

export class CutsceneEngine {
  active = false;
  private beats: Beat[] = [];
  private beatIndex = 0;
  private beatTime = 0;
  private totalTime = 0;
  private onComplete: (() => void) | null = null;
  private heroId: CharacterId = "sec-dev";
  skipProgress = 0;

  setHero(id: CharacterId) {
    this.heroId = id;
  }

  play(id: CutsceneId, onComplete: () => void) {
    this.onComplete = onComplete;
    this.beats = id === "intro" ? INTRO_BEATS : BOSS_BEATS[id] ?? INTRO_BEATS;
    this.beatIndex = 0;
    this.beatTime = 0;
    this.totalTime = 0;
    this.active = true;
  }

  skip() {
    if (!this.active) return;
    this.finish();
  }

  advance() {
    if (!this.active) return;
    if (this.beatIndex < this.beats.length - 1) {
      this.beatIndex++;
      this.beatTime = 0;
    } else {
      this.finish();
    }
  }

  update(dt: number) {
    if (!this.active) return;
    this.beatTime += dt;
    this.totalTime += dt;
    const beat = this.beats[this.beatIndex];
    if (beat && this.beatTime >= beat.duration) this.advance();
  }

  private finish() {
    this.active = false;
    const cb = this.onComplete;
    this.onComplete = null;
    cb?.();
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.active) return;
    const beat = this.beats[this.beatIndex];
    if (!beat) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    const side = Math.round(Math.min(w * 0.48, h * 0.98));
    const border = Math.max(8, Math.round(side * 0.013));
    const slide = Math.min(1, this.beatTime / 0.42);
    const prev = this.beatIndex > 0 ? this.beats[this.beatIndex - 1] : null;

    if (beat.scene === "screen") {
      this.drawTerminal(ctx, Math.round(w * 0.22), 0, Math.round(w * 0.56), h, beat);
      this.drawSkip(ctx, w, h);
      return;
    }

    if (prev && prev.scene !== "screen" && slide < 1) {
      this.paintPrint(ctx, prev, w, side, border, 1, 18);
    }
    const enter = this.beatIndex === 0 ? 0 : (1 - slide) * -w * 0.62;
    const rise = this.beatIndex === 0 ? (1 - slide) * h * 0.55 : 0;
    this.paintPrint(ctx, beat, w, side, border, enter, rise);
    this.drawSkip(ctx, w, h);
  }

  private paintPrint(
    ctx: CanvasRenderingContext2D,
    beat: Beat,
    w: number,
    side: number,
    border: number,
    dx: number,
    dy: number,
  ) {
    const tilt = beat.scene === "lights" || beat.scene === "victory" ? 0 : -0.035;
    const cx = w / 2 + dx;
    const cy = side / 2 + dy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.translate(-side / 2, -side / 2);
    ctx.fillStyle = "rgb(219, 204, 175)";
    ctx.fillRect(0, 0, side, side);
    const inner = border;
    this.drawScene(ctx, beat, inner, inner, side - inner * 2, side - inner * 2);
    ctx.restore();
  }

  private drawSkip(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK.gold;
    ctx.font = `600 13px ${FONT_MONO}`;
    ctx.fillText("SPACE", w - 16, h - 28);
    ctx.fillStyle = "#f3ecdf";
    ctx.font = `500 12px ${FONT_MONO}`;
    ctx.fillText("hold to skip", w - 16, h - 12);
    if (this.skipProgress > 0) {
      ctx.fillStyle = INK.gold;
      ctx.fillRect(w - 96, h - 6, 80 * this.skipProgress, 2);
    }
    ctx.restore();
  }

  private drawScene(ctx: CanvasRenderingContext2D, beat: Beat, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (beat.scene === "screen") this.drawTerminal(ctx, x, y, w, h, beat);
    else if (beat.scene === "hackers" || beat.scene === "boss") this.drawCrew(ctx, beat, x, y, w, h);
    else this.drawDesk(ctx, beat, x, y, w, h);
    ctx.restore();
  }

  private drawDesk(ctx: CanvasRenderingContext2D, beat: Beat, x: number, y: number, w: number, h: number) {
    const alarm = beat.scene === "alarm";
    const lit = beat.scene === "lights" || beat.scene === "victory";
    const pulse = alarm && Math.floor(this.beatTime * 6) % 2 === 0;
    ctx.fillStyle = "#000010";
    ctx.fillRect(x, y, w, h);
    const screenH = Math.round(h * 0.28);
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, w, screenH);
    ctx.fillStyle = "#f3ecdf";
    ctx.font = `600 ${Math.max(13, Math.round(w * 0.038))}px ${FONT_MONO}`;
    ctx.textAlign = "left";
    this.wrapLeft(ctx, beat.text, x + 14, y + 28, w - 28, Math.max(16, Math.round(w * 0.045)));
    for (let row = screenH; row < h; row++) {
      const cool = !lit && row < h * 0.7;
      const band = Math.floor((row / 8) % 3);
      if ((row + (band % 2)) % 2 === 0 && band === 1) {
        ctx.fillStyle = cool ? "#001020" : "#a04010";
      } else {
        ctx.fillStyle = cool ? (band === 0 ? "#000010" : "#001830") : lit ? "#c06020" : "#100808";
      }
      ctx.fillRect(x, y + row, w, 1);
    }
    ctx.fillStyle = lit ? "#1c2430" : "#0c1016";
    ctx.fillRect(x, y + Math.round(h * 0.42), w, Math.round(h * 0.16));
    const winX = x + Math.round(w * 0.08);
    const winY = y + screenH + 8;
    ctx.fillStyle = "#05070c";
    ctx.fillRect(winX, winY, Math.round(w * 0.28), Math.round(h * 0.22));
    ctx.fillStyle = pulse ? "#ff5d7a" : "#8fb4ff";
    for (let i = 0; i < 8; i++) ctx.fillRect(winX + 8 + (i % 4) * 14, winY + 8 + Math.floor(i / 4) * 12, 3, 3);

    const deskY = y + Math.round(h * 0.68);
    const who: CharacterId = beat.scene === "victory" ? this.heroId : "sec-dev";
    const sprite = getSideHero(who, Math.floor(this.totalTime * 2));
    const dh = Math.round(h * 0.7);
    const dw = Math.round(dh * (sprite.width / sprite.height));
    const dx = x + Math.round(w * 0.06);
    const dy = y + h - dh;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(dx + dw * 0.55, deskY + 2, dw * 0.28, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(sprite, dx, dy, dw, dh);

    ctx.fillStyle = lit ? "#3a2c22" : "#1a140f";
    ctx.fillRect(x + Math.round(w * 0.42), deskY, Math.round(w * 0.5), Math.round(h * 0.08));
    const lapW = Math.round(w * 0.34);
    const lapH = Math.round(h * 0.28);
    const lapX = x + Math.round(w * 0.52);
    const lapY = deskY - lapH + 4;
    ctx.fillStyle = "#2a313c";
    ctx.fillRect(lapX - 6, lapY - 6, lapW + 12, lapH + 8);
    ctx.fillStyle = alarm ? (pulse ? "#3a1018" : "#101810") : lit ? "#102820" : "#07140f";
    ctx.fillRect(lapX, lapY, lapW, lapH - 8);
    ctx.fillStyle = "#1a1e26";
    ctx.fillRect(lapX - 8, lapY + lapH - 8, lapW + 16, 10);
    ctx.fillStyle = alarm && pulse ? INK.danger : INK.mint;
    ctx.font = `500 ${Math.max(12, Math.round(h * 0.055))}px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(alarm ? "ALARM" : lit ? "LAZARUS" : "idle", lapX + 10, lapY + Math.round(lapH * 0.38));
    ctx.fillStyle = INK.gold;
    ctx.fillText(alarm ? "outflow" : "hot wallet", lapX + 10, lapY + Math.round(lapH * 0.62));

    if (lit) {
      const ox = x + 12;
      const oy = y + screenH + 10;
      ctx.fillStyle = "#f0c14d";
      ctx.fillRect(ox, oy, 10, 8);
      for (let row = 0; row < h * 0.55; row++) {
        const spread = Math.round(row * 0.22);
        ctx.fillStyle = row % 3 === 0 ? "rgba(240,193,77,0.16)" : "rgba(240,193,77,0.28)";
        ctx.fillRect(ox - spread, oy + row, spread * 2 + 10, 1);
      }
    }

    if (pulse) {
      ctx.fillStyle = "rgba(255,93,122,0.18)";
      ctx.fillRect(x, y, w, h);
    }
  }

  private drawTerminal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, beat?: Beat) {
    ctx.fillStyle = "#070a10";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#101820";
    ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
    ctx.fillStyle = "#07110e";
    ctx.fillRect(x + 18, y + 36, w - 36, h - 54);
    ctx.fillStyle = INK.mint;
    ctx.font = `600 ${Math.max(13, Math.round(w * 0.028))}px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText("Exploit.run  //  exchange SOC", x + 28, y + 30);
    if (beat) {
      ctx.fillStyle = "#f3ecdf";
      ctx.font = `600 ${Math.max(16, Math.round(w * 0.03))}px ${FONT_MONO}`;
      this.wrapLeft(ctx, beat.text, x + 36, y + 58, w - 72, Math.max(18, Math.round(w * 0.034)));
    }
    const billions = (1.2 + this.beatTime * 0.85).toFixed(2);
    const lines = [
      { t: "signer        LAZARUS GROUP", c: INK.danger },
      { t: "venue         CEX hot wallet", c: INK.text },
      { t: `outflow       $${billions}B`, c: INK.gold },
      { t: "route         bridge router → mixers", c: INK.muted },
      { t: "status        EXPLOIT LIVE", c: INK.danger },
      { t: "next block    not waiting", c: INK.mint },
    ];
    const size = Math.max(14, Math.round(w * 0.032));
    ctx.font = `500 ${size}px ${FONT_MONO}`;
    lines.forEach((line, i) => {
      ctx.fillStyle = line.c;
      ctx.fillText(line.t, x + 36, y + 68 + i * (size + 10));
    });
    const barW = w - 72;
    ctx.fillStyle = "#14201c";
    ctx.fillRect(x + 36, y + h - 48, barW, 10);
    ctx.fillStyle = INK.danger;
    ctx.fillRect(x + 36, y + h - 48, barW * Math.min(1, 0.35 + this.beatTime * 0.18), 10);
  }

  private drawCrew(ctx: CanvasRenderingContext2D, beat: Beat, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = "#120c10";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, w, Math.round(h * 0.22));
    ctx.fillStyle = "#f3ecdf";
    ctx.font = `600 ${Math.max(12, Math.round(w * 0.034))}px ${FONT_MONO}`;
    ctx.textAlign = "left";
    this.wrapLeft(ctx, beat.text, x + 12, y + 24, w - 24, Math.max(15, Math.round(w * 0.04)));
    ctx.fillStyle = "#24161c";
    ctx.fillRect(x, y + Math.round(h * 0.55), w, h);
    const desks = beat.scene === "boss" ? [0.5] : [0.28, 0.72];
    desks.forEach((px, i) => {
      const dx = x + Math.round(w * px);
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(dx - 28, y + Math.round(h * 0.58), 56, 10);
      ctx.fillStyle = i === 0 ? "#3a1820" : "#102018";
      ctx.fillRect(dx - 22, y + Math.round(h * 0.4), 44, 28);
      ctx.fillStyle = i === 0 ? INK.danger : INK.mint;
      ctx.fillRect(dx - 16, y + Math.round(h * 0.46), 18, 3);
    });
    const sprite = beat.scene === "boss" ? getMonsterSprite("boss-lazarus-414") : getMonsterSprite("lazarus-op");
    const dh = Math.round(h * (beat.scene === "boss" ? 0.62 : 0.42));
    const dw = Math.round(dh * (sprite.width / Math.max(1, sprite.height)));
    if (beat.scene === "boss") {
      ctx.drawImage(sprite, x + (w - dw) / 2, y + h - dh - 8, dw, dh);
    } else {
      ctx.drawImage(sprite, x + w * 0.22, y + h - dh - 6, dw, dh);
      const other = getSideHero("sec-dev", 1);
      const oh = Math.round(h * 0.4);
      const ow = Math.round(oh * (other.width / other.height));
      ctx.save();
      ctx.translate(x + w * 0.78, y + h - 6);
      ctx.scale(-1, 1);
      ctx.drawImage(other, -ow / 2, -oh, ow, oh);
      ctx.restore();
    }
    ctx.fillStyle = INK.danger;
    ctx.font = `600 ${Math.max(12, Math.round(h * 0.06))}px ${FONT_MONO}`;
    ctx.textAlign = "left";
    ctx.fillText(beat.scene === "boss" ? "INCOMING" : "DRAIN", x + 16, y + 28);
  }

  private wrapLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
    const words = text.split(" ");
    let line = "";
    let ly = y;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line.trim(), x, ly);
        line = word + " ";
        ly += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line.trim(), x, ly);
  }
}
