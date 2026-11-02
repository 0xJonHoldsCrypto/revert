export const PANEL_W = 320;
export const PANEL_H = 240;

export type Layers = { bg: HTMLCanvasElement; mid: HTMLCanvasElement; fx: HTMLCanvasElement };

type Ctx = CanvasRenderingContext2D;

function layer(paint: (c: Ctx) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  paint(c);
  return canvas;
}

function rect(c: Ctx, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function dither(c: Ctx, color: string, x: number, y: number, w: number, h: number, seed = 3) {
  c.fillStyle = color;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if ((px + py * seed) % 2 === 0 && (px * 7 + py * 3) % 3 !== 0) c.fillRect(x + px, y + py, 1, 1);
    }
  }
}

const SKIN = "#e0ac88";
const SKIN_DARK = "#b47d60";
const SKIN_LIT = "#f6cdaa";
const HAIR = "#191420";
const HOODIE = "#2a3a5a";
const HOODIE_DARK = "#1a2540";
const HOODIE_LIT = "#40588a";
const OUTLINE = "#080910";

function serverWall(c: Ctx, seedOffset = 0) {
  rect(c, "#070a14", 0, 0, PANEL_W, PANEL_H);
  for (let col = 0; col < 7; col++) {
    const x = col * 48 - 6;
    rect(c, "#0e1322", x, 16, 44, 160);
    rect(c, "#141b2e", x, 16, 44, 2);
    rect(c, "#05070e", x + 42, 16, 2, 160);
    for (let u = 0; u < 13; u++) {
      const y = 22 + u * 12;
      rect(c, "#161e33", x + 3, y, 38, 9);
      rect(c, "#0a0e1a", x + 5, y + 2, 24, 5);
      for (let l = 0; l < 3; l++) {
        const on = (col * 31 + u * 17 + l * 11 + seedOffset) % 5;
        if (on === 4) continue;
        rect(c, on === 0 ? "#ff5a3c" : on === 1 ? "#ffc23d" : "#2ee6c7", x + 31 + l * 3, y + 3, 1, 2);
      }
    }
  }
  rect(c, "#05060c", 0, 176, PANEL_W, 64);
}

function seatedDev(c: Ctx, ox: number, oy: number) {
  rect(c, "#14141c", ox - 18, oy + 30, 46, 7);
  rect(c, "#14141c", ox - 22, oy - 8, 10, 42);
  rect(c, "#22222c", ox - 21, oy - 7, 3, 40);
  rect(c, "#0c0c12", ox + 2, oy + 37, 5, 21);
  rect(c, "#0c0c12", ox - 10, oy + 55, 30, 4);

  rect(c, OUTLINE, ox - 13, oy - 10, 34, 46);
  rect(c, HOODIE, ox - 12, oy - 9, 32, 44);
  rect(c, HOODIE_LIT, ox + 12, oy - 8, 8, 40);
  rect(c, HOODIE_DARK, ox - 12, oy + 22, 32, 13);
  rect(c, HOODIE_DARK, ox - 12, oy - 9, 6, 44);

  rect(c, OUTLINE, ox + 14, oy + 26, 66, 12);
  rect(c, "#23283a", ox + 15, oy + 27, 64, 10);
  rect(c, "#39415c", ox + 15, oy + 27, 64, 3);
  rect(c, OUTLINE, ox + 72, oy + 14, 26, 26);
  rect(c, "#e4e7ee", ox + 76, oy + 16, 19, 20);
  rect(c, "#c23c3c", ox + 76, oy + 31, 19, 5);
  rect(c, "#ffffff", ox + 77, oy + 17, 5, 6);

  rect(c, OUTLINE, ox + 2, oy + 2, 48, 12);
  rect(c, HOODIE, ox + 3, oy + 3, 40, 10);
  rect(c, HOODIE_LIT, ox + 3, oy + 3, 40, 3);
  rect(c, OUTLINE, ox + 42, oy + 1, 14, 14);
  rect(c, SKIN, ox + 43, oy + 2, 12, 12);
  rect(c, SKIN_LIT, ox + 49, oy + 2, 6, 5);

  rect(c, OUTLINE, ox - 12, oy - 42, 40, 36);
  rect(c, SKIN, ox - 6, oy - 38, 32, 30);
  rect(c, SKIN_DARK, ox - 6, oy - 16, 12, 8);
  rect(c, SKIN_LIT, ox + 18, oy - 31, 8, 15);
  rect(c, HAIR, ox - 12, oy - 44, 40, 13);
  rect(c, HAIR, ox - 12, oy - 44, 16, 32);
  rect(c, HAIR, ox + 10, oy - 47, 14, 5);
  rect(c, "#27344f", ox - 16, oy - 22, 12, 22);
  rect(c, HOODIE_LIT, ox - 16, oy - 22, 12, 3);
  rect(c, OUTLINE, ox + 10, oy - 24, 16, 8);
  rect(c, "#9fe9ff", ox + 11, oy - 23, 6, 5);
  rect(c, "#9fe9ff", ox + 19, oy - 23, 6, 5);
  rect(c, OUTLINE, ox + 17, oy - 22, 2, 2);
  rect(c, SKIN_DARK, ox + 22, oy - 15, 4, 2);
  rect(c, OUTLINE, ox + 16, oy - 11, 8, 2);
}

function noodleCup(c: Ctx, x: number, y: number, scale = 1) {
  const s = scale;
  rect(c, OUTLINE, x - 11 * s, y, 22 * s, 24 * s);
  rect(c, "#f0e4cc", x - 10 * s, y + 1 * s, 20 * s, 22 * s);
  rect(c, "#c23c3c", x - 10 * s, y + 8 * s, 20 * s, 7 * s);
  rect(c, "#ffffff", x - 8 * s, y + 2 * s, 3 * s, 20 * s);
  rect(c, "#d9b45a", x - 9 * s, y - 2 * s, 18 * s, 4 * s);
  rect(c, "#3c2a1c", x + 2 * s, y - 16 * s, 2 * s, 18 * s);
  rect(c, "#3c2a1c", x + 6 * s, y - 16 * s, 2 * s, 18 * s);
}

export function paintSoc(): Layers {
  return {
    bg: layer((c) => serverWall(c)),
    mid: layer((c) => {
      rect(c, OUTLINE, 150, 92, 112, 72);
      rect(c, "#1b2133", 153, 95, 106, 66);
      rect(c, "#0a1f1c", 157, 99, 98, 58);
      const lines = [60, 44, 72, 30, 54, 66, 38, 48];
      lines.forEach((w, i) => rect(c, i === 3 ? "#ffc23d" : "#2ee6c7", 162, 104 + i * 6, w, 2));
      rect(c, "#242a3e", 196, 161, 20, 12);
      rect(c, "#2e354c", 180, 171, 52, 4);
      rect(c, "#2b2028", 0, 174, PANEL_W, 8);
      rect(c, "#4a3640", 0, 174, PANEL_W, 2);
      rect(c, "#130d12", 0, 182, PANEL_W, 58);
      seatedDev(c, 72, 134);
      noodleCup(c, 138, 150, 1);
    }),
    fx: layer((c) => {
      const glow = c.createRadialGradient(205, 128, 12, 205, 128, 150);
      glow.addColorStop(0, "rgba(70,230,200,0.12)");
      glow.addColorStop(1, "rgba(70,230,200,0)");
      c.fillStyle = glow;
      c.fillRect(0, 0, PANEL_W, PANEL_H);
      for (let i = 0; i < 8; i++) rect(c, "rgba(230,240,255,0.5)", 132 + ((i * 5) % 12), 112 - i * 4, 2, 3);
    }),
  };
}

export function paintPager(): Layers {
  return {
    bg: layer((c) => {
      rect(c, "#120a10", 0, 0, PANEL_W, PANEL_H);
      for (let r = 0; r < 7; r++) {
        c.strokeStyle = `rgba(255,60,50,${0.3 - r * 0.04})`;
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(160, 120, 90 + r * 26, 60 + r * 22, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }),
    mid: layer((c) => {
      rect(c, OUTLINE, 48, 44, 224, 152);
      rect(c, "#20242f", 52, 48, 216, 144);
      rect(c, "#343a4a", 52, 48, 216, 6);
      rect(c, "#14161e", 52, 176, 216, 16);
      rect(c, "#3b1012", 66, 62, 188, 84);
      rect(c, "#55181a", 66, 62, 188, 4);
      rect(c, OUTLINE, 62, 58, 196, 4);
      rect(c, OUTLINE, 62, 146, 196, 4);
      rect(c, OUTLINE, 62, 58, 4, 92);
      rect(c, OUTLINE, 254, 58, 4, 92);
      rect(c, "#ff4638", 234, 30, 18, 14);
      rect(c, "#ffd0c8", 238, 32, 6, 4);
      for (let b = 0; b < 3; b++) {
        rect(c, OUTLINE, 86 + b * 54, 154, 40, 18);
        rect(c, "#555e72", 88 + b * 54, 156, 36, 13);
        rect(c, "#79839a", 88 + b * 54, 156, 36, 3);
      }
    }),
    fx: layer((c) => {
      for (let i = 0; i < 3; i++) {
        rect(c, "#ffffff", 20 + i * 8, 60 + i * 34, 10 - i * 2, 3);
        rect(c, "#ffffff", 290 - i * 8, 74 + i * 30, 10 - i * 2, 3);
      }
    }),
  };
}

export function paintExplorer(): Layers {
  return {
    bg: layer((c) => {
      rect(c, "#05090d", 0, 0, PANEL_W, PANEL_H);
      for (let y = 0; y < PANEL_H; y += 2) rect(c, "rgba(46,230,199,0.04)", 0, y, PANEL_W, 1);
    }),
    mid: layer((c) => {
      rect(c, "#0c1a1a", 0, 0, PANEL_W, 16);
      rect(c, "#ff4638", 6, 5, 6, 6);
      rect(c, "#ffc23d", 16, 5, 6, 6);
      rect(c, "#2ee6c7", 26, 5, 6, 6);
      rect(c, "#163032", 0, 16, PANEL_W, 1);
    }),
    fx: layer((c) => dither(c, "rgba(255,70,56,0.06)", 0, 0, PANEL_W, PANEL_H)),
  };
}

export function paintFace(): Layers {
  return {
    bg: layer((c) => {
      rect(c, "#0a1420", 0, 0, PANEL_W, PANEL_H);
      c.fillStyle = "#101f30";
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        c.beginPath();
        c.moveTo(160, 120);
        c.lineTo(160 + Math.cos(a) * 320, 120 + Math.sin(a) * 320);
        c.lineTo(160 + Math.cos(a + 0.2) * 320, 120 + Math.sin(a + 0.2) * 320);
        c.fill();
      }
    }),
    mid: layer((c) => {
      rect(c, OUTLINE, 60, 214, 200, 26);
      rect(c, HOODIE, 64, 218, 192, 22);
      rect(c, OUTLINE, 72, 24, 176, 196);
      rect(c, SKIN, 78, 40, 164, 176);
      rect(c, SKIN_LIT, 186, 44, 52, 110);
      rect(c, SKIN_DARK, 78, 150, 60, 66);
      rect(c, HAIR, 74, 22, 170, 38);
      rect(c, HAIR, 74, 22, 22, 96);
      rect(c, HAIR, 224, 30, 20, 40);
      for (let i = 0; i < 6; i++) rect(c, HAIR, 92 + i * 24, 58, 14, 8 + (i % 3) * 5);
      for (const ex of [104, 174]) {
        rect(c, OUTLINE, ex - 4, 86, 56, 50);
        rect(c, "#f8f8f4", ex, 90, 48, 42);
        rect(c, OUTLINE, ex + 22, 106, 10, 10);
      }
      rect(c, OUTLINE, 104, 72, 46, 7);
      rect(c, OUTLINE, 176, 66, 46, 7);
      rect(c, SKIN_DARK, 156, 134, 14, 26);
      rect(c, OUTLINE, 128, 172, 70, 28);
      rect(c, "#5a1c28", 132, 176, 62, 20);
      rect(c, "#f4e4a0", 150, 176, 5, 60);
      rect(c, "#d8c070", 155, 176, 3, 50);
      rect(c, "#f4e4a0", 166, 176, 4, 46);
    }),
    fx: layer((c) => {
      rect(c, "#9fd8ff", 66, 74, 6, 12);
      rect(c, "#9fd8ff", 248, 60, 6, 14);
      rect(c, "#e8f6ff", 248, 60, 3, 4);
    }),
  };
}

function signerCard(c: Ctx, x: number, awake: boolean, hood: string) {
  rect(c, OUTLINE, x, 46, 84, 128);
  rect(c, "#171d2d", x + 3, 49, 78, 122);
  rect(c, awake ? "#163a33" : "#1f2638", x + 3, 49, 78, 16);
  const fx = x + 42;
  rect(c, OUTLINE, fx - 8, 124, 16, 12);
  rect(c, SKIN_DARK, fx - 6, 124, 12, 12);
  rect(c, OUTLINE, fx - 30, 132, 60, 36);
  rect(c, hood, fx - 27, 135, 54, 33);
  rect(c, OUTLINE, fx - 21, 78, 42, 50);
  rect(c, SKIN, fx - 18, 81, 36, 44);
  rect(c, HAIR, fx - 20, 76, 40, 15);
  if (awake) {
    rect(c, "#f8f8f4", fx - 13, 97, 10, 9);
    rect(c, "#f8f8f4", fx + 3, 97, 10, 9);
    rect(c, OUTLINE, fx - 9, 100, 4, 4);
    rect(c, OUTLINE, fx + 7, 100, 4, 4);
    rect(c, OUTLINE, fx - 6, 114, 12, 3);
  } else {
    rect(c, OUTLINE, fx - 14, 101, 11, 2);
    rect(c, OUTLINE, fx + 3, 101, 11, 2);
    rect(c, OUTLINE, fx - 3, 114, 7, 2);
  }
}

export function paintMultisig(): Layers {
  return {
    bg: layer((c) => {
      rect(c, "#0d1020", 0, 0, PANEL_W, PANEL_H);
      dither(c, "#141933", 0, 0, PANEL_W, PANEL_H);
    }),
    mid: layer((c) => {
      signerCard(c, 22, true, "#2a3a5a");
      signerCard(c, 118, false, "#5a2a4a");
      signerCard(c, 214, false, "#3a5a3a");
    }),
    fx: layer(() => undefined),
  };
}

export function paintSigners(): Layers {
  return {
    bg: paintMultisig().bg,
    mid: layer((c) => {
      signerCard(c, 22, true, "#2a3a5a");
      signerCard(c, 118, false, "#5a2a4a");
      signerCard(c, 214, false, "#3a5a3a");
    }),
    fx: layer((c) => {
      signerCard(c, 118, true, "#5a2a4a");
      signerCard(c, 214, true, "#3a5a3a");
    }),
  };
}

export function paintWallet(): Layers {
  return {
    bg: layer((c) => {
      rect(c, "#0b0c16", 0, 0, PANEL_W, PANEL_H);
      c.fillStyle = "#15182c";
      for (let i = 0; i < 12; i++) rect(c, "#15182c", 0, i * 22 + 4, PANEL_W, 8);
    }),
    mid: layer((c) => {
      rect(c, OUTLINE, 74, 64, 172, 104);
      rect(c, "#24283a", 78, 68, 164, 96);
      rect(c, "#3a4058", 78, 68, 164, 5);
      rect(c, OUTLINE, 92, 78, 136, 40);
      rect(c, "#0a2420", 96, 82, 128, 32);
      rect(c, OUTLINE, 134, 124, 52, 34);
      rect(c, "#d7322c", 137, 127, 46, 28);
      rect(c, "#ff6a58", 137, 127, 46, 6);

      for (const side of [-1, 1]) {
        const cx = side < 0 ? 56 : 264;
        rect(c, OUTLINE, cx - 34, 96, 68, 144);
        rect(c, HOODIE, cx - 30, 188, 60, 52);
        rect(c, SKIN, cx - 30, 100, 60, 88);
        rect(c, SKIN_LIT, cx - 30, 100, 60, 10);
        rect(c, SKIN_DARK, cx - 30, 168, 60, 20);
        for (let f = 0; f < 3; f++) {
          const fy = 110 + f * 20;
          const fx = side < 0 ? cx + 22 : cx - 56;
          rect(c, OUTLINE, fx, fy, 34, 18);
          rect(c, SKIN, fx + 2, fy + 2, 30, 14);
          rect(c, SKIN_LIT, fx + 2, fy + 2, 30, 4);
        }
      }
    }),
    fx: layer((c) => {
      rect(c, OUTLINE, 136, 158, 48, 82);
      rect(c, SKIN, 140, 160, 40, 80);
      rect(c, SKIN_LIT, 140, 160, 12, 80);
      rect(c, "#f6dcc8", 146, 163, 28, 14);
      rect(c, SKIN_DARK, 140, 196, 40, 3);
    }),
  };
}

function jaggedRift(c: Ctx, color: string, width: number) {
  const offsets = [6, 14, 3, 11, 18, 5, 13, 2, 16, 8, 12];
  const stepY = PANEL_H / (offsets.length - 1);
  c.fillStyle = color;
  c.beginPath();
  offsets.forEach((off, i) => {
    const x = 160 - width / 2 - off;
    if (i === 0) c.moveTo(x, -1);
    else c.lineTo(x, i * stepY);
  });
  for (let i = offsets.length - 1; i >= 0; i--) {
    c.lineTo(160 + width / 2 + offsets[(i + 4) % offsets.length]!, i * stepY);
  }
  c.closePath();
  c.fill();
}

export function paintTear(): Layers {
  return {
    bg: paintExplorer().bg,
    mid: layer((c) => {
      seatedDev(c, 70, 138);
      noodleCup(c, 138, 140, 1);
    }),
    fx: layer((c) => {
      jaggedRift(c, "#58c8ff", 40);
      jaggedRift(c, "#f8ffff", 18);
    }),
  };
}

export const paintVaultSafe = paintExplorer;
