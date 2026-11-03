# REVERT

Browser **survivors-like** game (think [tibo.dog](https://tibo.dog)): move, dash, auto-firing crypto weapons, level-up picks, and endless survival runs.

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
| Q / E | Active ability |
| 1-3 | Pick a card |
| R / X | Reroll / skip cards |
| M | Mute |
| Esc / P | Pause |

## Checks

```bash
npm test
npm run balance
npm run formal
```

`npm run balance` plays headless bots across heroes and difficulties. Set `CAP` (minutes) and `RUNS` to change its size.

## Goal

The run is endless and ends only when you die. The first boss arrives at 2:00, and bosses keep cycling and scaling after that. Collect XP, level up, open chests, take deals and post a high score.

## X player card

The build fails if the first load of `index.html` or  exceeds **124KB gzip** (see `scripts/first-load-budget-plugin.ts`). That counts the HTML plus every script and stylesheet it loads without a dynamic import. Three.js loads afterwards.

The card plays the full game from `/`. Build with your public https URL to add the tags:

```bash
PUBLIC_URL=https://revert.run npm run build
```

Production builds on Vercel use `vercel.json`, which sets this URL. Submit https://revert.run to X for player card approval.

## Replayable runs

Every run records its seed, hero, difficulty, inputs and choices in a versioned log with state checkpoints (`src/replay/runLog.ts`). `replayRun` in `src/replay/replayRun.ts` plays a log back headless and rejects it if the state ever differs. Score submission and the server that runs this check are not built yet. Bump `SIM_VERSION` whenever a change alters simulation results.

## Lint

```bash
npm run lint
```

Comments in `src/` are forbidden by ESLint (`local/no-comments`).

## Formal specs

See `formal/README.md` (TLA+ for phase machine and cutscenes).
