# Exploit.run

Browser **survivors-like** game (think [tibo.dog](https://tibo.dog)): move, dash, auto-firing crypto weapons, level-up picks, and 20-minute survival runs.

**Theme:** Night-shift responders fall into the chain and fight the attack itself: phishing bots, MEV searchers, bridge drainers, and fictional APT crews. All names are fictional.

## Run locally

```bash
npm install
npm run dev
```

## Controls

| Key | Action |
|-----|--------|
| WASD / arrows | Move |
| Space | Dash (i-frames) |
| Esc / P | Pause |

## Goal

Save the funds and survive **20 minutes**. Six bosses arrive between 3:00 and 19:00. Victory needs the clock at 20:00 and the Grandmaster dead. Collect XP gems, level up, stack weapons and upgrades.

## X embed budget

Build fails if any `embed*.js` chunk exceeds **124KB gzip** (see `scripts/embed-budget-plugin.ts`). Use `embed.html` for the X card; Three.js loads only on the full site.

## Replay + wallet scores

```bash
npm run server:replay
```

Win screen → **Submit score (wallet)** signs a summary and POSTs replay frames. Server validates timing/input bounds (full deterministic re-sim is the next iteration).

## Lint

```bash
npm run lint
```

Comments in `src/` are forbidden by ESLint (`local/no-comments`).

## Formal specs

See `formal/README.md` (TLA+ for phase machine and cutscenes).
