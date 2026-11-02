export class Input {
  keys = new Set<string>();
  mouse = { x: 0, y: 0, down: false };
  dashPressed = false;
  pausePressed = false;
  advanceHeld = false;
  confirmPressed = false;
  restartPressed = false;
  cardPick: number | null = null;
  touchMove = { x: 0, y: 0 };
  touchDash = false;

  private stickOrigin: { x: number; y: number } | null = null;
  private stickId: number | null = null;
  private dashPointerId: number | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => this.releaseAll());
    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener("mousedown", () => {
      this.mouse.down = true;
    });
    canvas.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });

    canvas.addEventListener(
      "touchstart",
      (e) => {
        for (const t of e.changedTouches) {
          const r = canvas.getBoundingClientRect();
          const x = t.clientX - r.left;
          const y = t.clientY - r.top;
          if (x > r.width * 0.45 && this.dashPointerId === null) {
            this.dashPointerId = t.identifier;
            this.touchDash = true;
            continue;
          }
          if (this.stickId === null) {
            this.stickId = t.identifier;
            this.stickOrigin = { x, y };
          }
        }
        e.preventDefault();
      },
      { passive: false }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== this.stickId || !this.stickOrigin) continue;
          const r = canvas.getBoundingClientRect();
          const x = t.clientX - r.left;
          const y = t.clientY - r.top;
          const dx = x - this.stickOrigin.x;
          const dy = y - this.stickOrigin.y;
          const max = 52;
          const len = Math.hypot(dx, dy) || 1;
          const scale = Math.min(1, max / len);
          this.touchMove.x = (dx / len) * scale;
          this.touchMove.y = (dy / len) * scale;
        }
        e.preventDefault();
      },
      { passive: false }
    );

    const endTouch = (e: TouchEvent) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stickOrigin = null;
          this.touchMove.x = 0;
          this.touchMove.y = 0;
        }
        if (t.identifier === this.dashPointerId) {
          this.dashPointerId = null;
        }
      }
    };
    canvas.addEventListener("touchend", endTouch);
    canvas.addEventListener("touchcancel", endTouch);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
      e.preventDefault();
    }
    if (down) {
      this.keys.add(k);
      if (e.repeat) return;
      if (k === " " || k === "shift") this.dashPressed = true;
      if (k === "escape" || k === "p") this.pausePressed = true;
      if (k === "enter" || k === " ") {
        this.confirmPressed = true;
        this.advanceHeld = true;
      }
      if (k === "r") this.restartPressed = true;
      if (k === "1" || k === "2" || k === "3") this.cardPick = Number(k) - 1;
    } else {
      this.keys.delete(k);
      if (k === "enter" || k === " ") this.advanceHeld = false;
    }
  }

  clearEdges() {
    this.dashPressed = false;
    this.touchDash = false;
    this.pausePressed = false;
    this.advanceHeld = false;
    this.confirmPressed = false;
    this.restartPressed = false;
    this.cardPick = null;
  }

  releaseAll() {
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.clearEdges();
  }

  consumeConfirm(): boolean {
    const v = this.confirmPressed;
    this.confirmPressed = false;
    return v;
  }

  consumeRestart(): boolean {
    const v = this.restartPressed;
    this.restartPressed = false;
    return v;
  }

  consumeCardPick(): number | null {
    const v = this.cardPick;
    this.cardPick = null;
    return v;
  }

  consumeDash(): boolean {
    const v = this.dashPressed || this.touchDash;
    this.dashPressed = false;
    this.touchDash = false;
    return v;
  }

  consumePause(): boolean {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (x === 0 && y === 0 && (this.touchMove.x !== 0 || this.touchMove.y !== 0)) {
      return { x: this.touchMove.x, y: this.touchMove.y };
    }
    return { x, y };
  }

  focus() {
    this.canvas.focus();
  }
}
