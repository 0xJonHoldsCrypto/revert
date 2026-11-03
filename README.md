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
| T | Skip tutorial hints |

## Settings and saves

The gear button (next to mute, and in the pause menu) opens a lazy-loaded settings panel: music/effects volume, screenshake, reduced motion (defaults to your OS setting), colorblind mode, vibration, HUD size, large text and tutorial hints. All of it is cosmetic and never read by the simulation, so replays are unaffected.

Everything persists in one versioned `localStorage` entry (`revert.save`, see `src/save.ts`), which also holds your last 20 runs and your best score per hero and difficulty (shown on the title screen). Older `revert.prefs.v1` and `revert.audio.v1` values are migrated on first load.

## Share card, achievements and codex

After a death the post-mortem offers a 1200x630 share card drawn in code (`src/ui/shareCard.ts`, lazy): Share uses the Web Share API with the PNG where supported and otherwise copies or downloads it. COPY RUN CODE puts the serialized run log on the clipboard (a text box appears if the clipboard is blocked), and REPLAY THIS SEED restarts with the same seed, hero and difficulty.

25 achievements (`src/data/achievements.ts`, evaluated by the pure tracker in `src/game/achievements.ts`) unlock from events Game emits and toast in-run. The lazy Codex (`src/ui/Codex.ts`, opened from the title screen or pause menu) lists threats, tools with evolutions, gear, cameos, achievements and lifetime stats; unseen entries show as ???. Tainted runs (debug cheats) grant nothing and record no codex progress. None of this is read by the simulation, so replays are unaffected. The save is now version 2 and migrates v1 saves.

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
