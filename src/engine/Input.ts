export class Input {
  keys = new Set<string>();
  codes = new Set<string>();
  mouse = { x: 0, y: 0, down: false };
  dashPressed = false;
  pausePressed = false;
  advanceHeld = false;
  confirmPressed = false;
  restartPressed = false;
  mutePressed = false;
  cardPick: number | null = null;
  touchMove = { x: 0, y: 0 };
  touchDash = false;
  abilityPressed = false;
  skipPressed = false;
  stickOrigin: { x: number; y: number } | null = null;

  private stickId: number | null = null;
  private touchCount = 0;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
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
        this.touchCount = e.touches.length;
        this.advanceHeld = true;
        for (const t of e.changedTouches) {
          const r = canvas.getBoundingClientRect();
          const x = t.clientX - r.left;
          const y = t.clientY - r.top;
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
      this.touchCount = e.touches.length;
      if (this.touchCount === 0) this.advanceHeld = false;
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stickOrigin = null;
          this.touchMove.x = 0;
          this.touchMove.y = 0;
        }
      }
    };
    canvas.addEventListener("touchend", endTouch);
    canvas.addEventListener("touchcancel", endTouch);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.metaKey) {
      this.releaseAll();
      return;
    }
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
      e.preventDefault();
    }
    if (down) {
      this.keys.add(k);
      this.codes.add(e.code);
      if (e.repeat) return;
      if (k === " " || k === "shift") this.dashPressed = true;
      if (k === "escape" || k === "p") this.pausePressed = true;
      if (k === "enter" || k === " ") {
        this.confirmPressed = true;
        this.advanceHeld = true;
      }
      if (k === "r") this.restartPressed = true;
      if (k === "m") this.mutePressed = true;
      if (k === "q" || k === "e") this.abilityPressed = true;
      if (k === "x") this.skipPressed = true;
      if (k === "1" || k === "2" || k === "3") this.cardPick = Number(k) - 1;
    } else {
      this.keys.delete(k);
      this.codes.delete(e.code);
      if (k === "enter" || k === " ") this.advanceHeld = false;
    }
  }

  clearEdges() {
    this.dashPressed = false;
    this.touchDash = false;
    this.abilityPressed = false;
    this.skipPressed = false;
    this.pausePressed = false;
    this.advanceHeld = false;
    this.confirmPressed = false;
    this.restartPressed = false;
    this.cardPick = null;
  }

  releaseAll() {
    this.keys.clear();
    this.codes.clear();
    this.stickId = null;
    this.stickOrigin = null;
    this.touchCount = 0;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.clearEdges();
  }

  consumeConfirm(): boolean {
    const v = this.confirmPressed;
    this.confirmPressed = false;
    return v;
  }

  consumeMute(): boolean {
    const v = this.mutePressed;
    this.mutePressed = false;
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

  consumeSkip(): boolean {
    const v = this.skipPressed;
    this.skipPressed = false;
    return v;
  }

  consumeAbility(): boolean {
    const v = this.abilityPressed;
    this.abilityPressed = false;
    return v;
  }

  pressDash() {
    this.touchDash = true;
  }

  pressAbility() {
    this.abilityPressed = true;
  }

  pressPause() {
    this.pausePressed = true;
  }

  consumePause(): boolean {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }

  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    const c = this.codes;
    if (c.has("KeyW") || c.has("ArrowUp")) y -= 1;
    if (c.has("KeyS") || c.has("ArrowDown")) y += 1;
    if (c.has("KeyA") || c.has("ArrowLeft")) x -= 1;
    if (c.has("KeyD") || c.has("ArrowRight")) x += 1;
    if (x === 0 && y === 0 && (this.touchMove.x !== 0 || this.touchMove.y !== 0)) {
      return { x: this.touchMove.x, y: this.touchMove.y };
    }
    return { x, y };
  }

  focus() {
    this.canvas.focus();
  }
}
