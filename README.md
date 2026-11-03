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

27 achievements (`src/data/achievements.ts`, evaluated by the pure tracker in `src/game/achievements.ts`) unlock from events Game emits and toast in-run. The lazy Codex (`src/ui/Codex.ts`, opened from the title screen or pause menu) lists threats, affixes and network events, tools with evolutions, gear, cameos, achievements and lifetime stats; unseen entries show as ???. Tainted runs (debug cheats) grant nothing and record no codex progress. None of this is read by the simulation, so replays are unaffected. The save is version 3 and migrates older saves. Every write re-reads storage first and other tabs' writes are picked up through the `storage` event, so two open tabs do not overwrite each other.

## Threat intel: affixes, network events, new tools and attackers

**Elite affixes** (`src/data/affixes.ts`, runtime in `src/game/affixes.ts`). Every whale (random elites, Doxxed hunters, bounties and Whale Hunt targets) rolls one affix with the spawn RNG, and two after 8:00. Each affix has a coloured ring around the whale and a tag in its name plate (`WHALE · SHIELD · HASTE`):

| Affix | Effect |
|-------|--------|
| Shielded | A barrier soaks the first 30% of its HP and returns after 5s without a hit |
| Splitting | Dies into three smaller copies |
| Hasted | Moves 45% faster |
| Volatile | Leaves a blast that goes off a second after death |
| Mender | Heals nearby attackers a little each second |
| Vampiric | Heals itself when it hits you |

**Network events** (`src/game/events.ts`). Between bosses (never while one is alive, never within 25s of the next) a timed event starts from 1:20, then every 70 to 110 seconds, chosen with the sim RNG and never the same twice in a row. A banner announces it and the HUD shows the countdown.

| Event | Effect |
|-------|--------|
| Domino Defaults | 12s: every kill detonates |
| Mempool Surge | 18s: twice the attackers, XP worth 60% more |
| Airdrop Rain | 10s: crates fall on telegraphed spots and leave XP and $SAFU |
| Network Congestion | 10s: you and every attacker move 35% slower |
| Whale Hunt | 30s: two affixed whales surface; the first kill pays a purse, XP and 20 HP |

**Tools** (17 to 20). Keeper Bot executes attackers under 15% HP (bosses never; whales at half the threshold) and otherwise nicks the weakest one; evolves into Keeper Network with Treasury Diversification. Air-Gap Vault is a vault that circles you and shoves off what it touches, bursting every 8 shoves to freeze and hit everything nearby; evolves into Deep Freeze with Cold Storage. Infinite Approval tags attackers with a 4s drain that jumps to the two nearest when the host dies; evolves into Unlimited Allowance with Private Orderflow. Level-up cards show their thresholds, tag counts and burst rules.

**Attackers** (hand-drawn in `src/pixel/handArt.ts`). The Frontrunner reads your heading and blinks ahead of you after a telegraph. The Censor drops a burning ring around you that hurts once if you cross it. The Dust Spammer fires slow dust that stacks a 12% slow (dash to shake it). The Griefer leaves timelocked mines that arm, then wait.

**Contracts** (`src/data/modifiers.ts`) are tuned with the paired-seed contract section of `npm run balance` so that each one lowers bot survival and still pays a higher median score than no contract: Glass Cannon is +35% damage at 40% max HP, Immutable Ledger pays ×1.8, Doxxed hunts every 60s, Dark Forest pays ×1.4, Whale Season whales hit 60% harder, Low Latency is +25% attacker speed for ×1.4, and Bull Market is 60% more attackers for only 10% more XP.

The Codex has an INTEL tab for affixes and events, and two achievements cover them (Mempool Weather, Stacked Odds).

## Checks

```bash
npm test
npm run balance
npm run formal
```

`npm run balance` plays headless bots across heroes and difficulties, then every contract, and prints tool damage shares, network event counts, affixed whales per run and causes of death. Runs use fixed seeds per hero and run index (`SEED` changes the base), so contracts are compared on the same seeds. Set `CAP` (minutes), `RUNS` and `MOD_RUNS` to change its size, `ONLY_MODS=1` to run only the contracts and `SKIP_MODS=1` to skip them.

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
