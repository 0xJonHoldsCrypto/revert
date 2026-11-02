# Exploit.run

Browser **survivors-like** game (think [tibo.dog](https://tibo.dog)): move, dash, auto-firing crypto weapons, level-up picks, and 20-minute survival runs.

**Theme:** Play as parody crypto figures (CZ, Vitalik, Do Kwon, SBF) and fight waves of hackers, phishing bots, and **Lazarus**-style APT bosses.

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

Survive **20 minutes**. Bosses spawn at 5 / 10 / 15 / 20 minutes. Collect XP gems, level up, stack weapons and upgrades.

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
