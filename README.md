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

After a death the post-mortem offers a 1200x630 share card drawn in code (`src/ui/shareCard.ts`, lazy): Share uses the Web Share API with the PNG where supported and otherwise copies or downloads it. SAVE RUN FILE downloads `revert-<seed>.run` and COPY RUN CODE copies a `REVERT1:` code (`src/replay/runCode.ts`, lazy: binary-packed, deflate-raw when the browser has CompressionStream, base64url; legacy JSON codes still decode). A text box (capped height) appears if the clipboard is blocked, and long runs are pointed at the file since their code is too big for chat apps, and REPLAY THIS SEED restarts with the same seed, hero and difficulty.

31 achievements (`src/data/achievements.ts`, evaluated by the pure tracker in `src/game/achievements.ts`) unlock from events Game emits and toast in-run. The lazy Codex (`src/ui/Codex.ts`, opened from the title screen or pause menu) lists threats, affixes and network events, tools with evolutions, gear, cameos, achievements and lifetime stats; unseen entries show as ???. Tainted runs (debug cheats) grant nothing and record no codex progress. None of this is read by the simulation, so replays are unaffected. The save is version 4 (history entries and lifetime stats carry `won`, `winTime`, `wins` and `fastestWin`) and migrates older saves. Every write re-reads storage first and other tabs' writes are picked up through the `storage` event, so two open tabs do not overwrite each other.

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

**Contracts** (`src/data/modifiers.ts`) are tuned with the paired-seed contract section of `npm run balance` so that each one lowers bot survival and still pays a higher median score than no contract: Glass Cannon is +35% damage at 40% max HP, Immutable Ledger pays ×1.8, Doxxed hunts every 60s, Dark Forest pays ×1.4, Whale Season whales hit 60% harder, Low Latency is +25% attacker speed for ×1.4, and Bull Market is 60% more attackers for only 10% more XP. Immutable Ledger also stops max HP gains from refilling HP, and Hard Fork revives it at 25% instead of 50%. Shards are scaled by difficulty after contracts (Easy ×0.5, Normal ×1, Hard ×1.5, Nightmare ×2), so Easy with every contract still pays less than plain Nightmare.

The Codex has an INTEL tab for affixes and events, and two achievements cover them (Mempool Weather, Stacked Odds).

## Heroes, biomes and hazards

**Heroes** (`src/data/characters.ts`, art in `src/pixel/handArt.ts`). Six responders. Ledger (Forensic Auditor, unlocks with Bear Market or 120 shards) starts with Finality Beam and carries an audit shield worth 25% of max HP: it soaks hits before HP, recharges 4s after the last hit, and every soaked point hits attackers within 140 for three times that amount (a gold ring around Ledger shows the charge). Relay (Node Operator, unlocks with Mining Farm or 120 shards) starts with Keeper Bot and a Dev Laptop rig, runs three rigs instead of two, and its rigs work 35% faster and cost 30% less to upgrade. Both join the daily rotation. The Codex CREW tab lists every hero, passive and unlock.

**Biomes** (`src/data/environment.ts`). Five biomes on a seeded Voronoi map; spawn is always the Mempool. Cold Storage (frost floor, cold racks, ice shards, seed plates, Frozen Vault and HSM Tower landmarks, its own music theme) is slightly slower going, biased to Sybils, Liquidators, Depegged Stables, Pump Bots, Griefers and Censors, and pays more coin and XP.

**Signature hazards** (`src/game/biomeHazards.ts`, data in `src/data/biomeHazards.ts`). From 0:50, every 10 to 16 seconds (sim RNG, never while a boss is alive, never past the 48-hazard cap) the biome you stand in fires its hazard. All are telegraphed for at least 1.1s and get extra white shape cues in colorblind mode; reduced motion only stills their animation.

| Biome | Hazard | Tell |
|-------|--------|------|
| Mempool | Gas Lane | A long strip fills through you, then surges for 1.4s |
| Hot Wallet Vault | Alarm Laser | A wall emitter paints a line and shows its sweep, then sweeps for 3s |
| The Bridge | Collapsing Span | Three deck tiles crack ahead of you and drop one after another |
| Dark Forest | Front-Run Sniper | A crosshair follows you, then locks 0.6s before it fires |
| Cold Storage | Frost Vent | Three vents frost over, then vent; standing in one chills (40% slow) and stings |

**Tool balance.** Mempool Pulse hits for 13 (was 20) with a smaller crowd bonus (3% per attacker, capped at ×1.6). Stablecoin Shield coins now catch enemy bullets and fire them back at the nearest attacker for five times the coin's damage plus double the bullet's, resting 1s after a catch (0.5s once evolved).

## Checks

```bash
npm test
npm run balance
npm run formal
```

`npm run balance` plays headless bots across all six heroes (`HEROES=keel,ledger` to narrow) and difficulties (the good bot also dodges lanes, beams and trackers), then every contract, and prints tool damage shares, network event counts, affixed whales per run and causes of death. Runs use fixed seeds per hero and run index (`SEED` changes the base), so contracts are compared on the same seeds. Set `CAP` (minutes), `RUNS` and `MOD_RUNS` to change its size, `ONLY_MODS=1` to run only the contracts and `SKIP_MODS=1` to skip them. It also reports trace progress at death, when each run crossed 25/50/75/100%, trace points per minute by source and finale outcomes. `WIN=endless` makes bots keep playing after a win (default cashes out), `FORCE_TRACE=<minutes>` forces the trace to 100% at that time to test the fight, and `PACE=1` runs invulnerable bots (`PACE_RUNS`, `PACE_DIFFS`) to measure how fast the trace can fill when survival is not the limit.

## Goal: trace the attacker, then play on

Every run now has an ending. The HUD shows a **TRACE** meter (ticks at 25, 50 and 75%, each with a toast). It fills from, in order of weight: boss kills (6.5 points each), a small time trickle (2 per minute) and, from two per-minute budgets so they cannot rush it, stopping bridge drainers (0.9), bounty whales (4) and elite whales (1.3) from the kills budget (2 up front plus 1 a minute), and merges (2), staking pads (0.8) and hardware racks (1.5, upgrades 0.6) from the points-of-interest budget (1.5 plus 0.7 a minute). All numbers live in one table, `src/data/trace.ts`, including the difficulty multiplier (Easy ×1.2, Normal ×1, Hard ×0.96, Nightmare ×0.92). Contracts and the daily do not change it.

Measured pacing (`npm run balance`, bots, Normal): invulnerable bots that kill every boss as it comes and use what they walk past hit 100% at 16.9 to 20.3 minutes (median about 19), with 25% at 4.6 to 6.9, 50% at 7.8 to 11.5 and 75% at 11.3 to 13.5. They kill bosses slower than a good player does, so a competent run should land nearer 13 to 16 minutes and a bosses-only run nearer 19. Invulnerable bots on Hard reach only 75% at about 15 minutes and do not hit 100% inside 30; on Nightmare they reach 50% at about 10 minutes, so the bots cannot judge those two tiers. Easy reaches 100% at a median of 13.2 minutes in the bots that survive that long (15 of 24 runs). Ordinary bots die first: median trace at death is 40% (casual, Normal), 50% (good, Normal), 32% (good, Hard) and 7% (good, Nightmare).

At 100% (and once no other boss is alive) the board is purged, the HUD locks and a boss cinematic introduces **THE ATTACKER** (`src/game/finale.ts`). Ordinary spawns, waves and the Doxxed hunt stop for the fight; every attack is a telegraphed hazard with at least a one second windup and no instant projectiles. HP scales with difficulty only (24,000 base: a stationary 1,900 DPS test build kills him in about 67s, a 1,100 DPS build in about 93s) and phases cannot be skipped, however hard you hit him:

| Phase | HP | What changes |
| --- | --- | --- |
| 1 · Decoys | 100 to 66% | Four fake wallets spawn around you and detonate after 9s (a 1.3s circle telegraph). While any lives he takes 20% damage and shows a SHIELDED tag. He also casts circle volleys and aimed beams. |
| 2 · Siphon | 66 to 33% | The treasury drains 2.2M a second (never below 8% of the funds) until you kill the bridge drainers he spawns, while rotating beams, three-lane lockdowns and circle rings run. |
| 3 · Reorg | below 33% | He speeds up and sends a rewind ring that expands at 360 px/s after a 1.5s telegraph. It cannot be outrun, dash through it. Beam fans and circle volleys fill the gaps. |

Dying during the fight ends the run as normal. Killing him sweeps the board, plays the new victory cutscene (the exploit is reverted and the funds are back, but a second attacker wallet just woke up) and opens a popup with two cards, both ordinary popup choices so they go through the recorded choice path and replay verification:

- **KEEP PLAYING · ENDLESS** keeps the run going. The HUD swaps the meter for an `ENDLESS` tag and a *Loops survived* counter (one loop per 60s). The existing late-game scaling and anti-camping whales keep climbing, bosses stay on their schedule (overdue ones are skipped and the next waits 30s) and the horde ramps back in over 25s.
- **BANK THE WIN · FINISH RUN** ends the run through the normal post-mortem as a win.

A win books a crown: `won` and `winTime` are stored in the run summary, the history list and the share card show REVERTED with the time to win, the score gets +20,000 plus 5 per second under 30:00, and shards get +80 (never for tainted runs). Quitting or restarting after a win still books it. Achievements: Reverted, Reverted on Nightmare, Speed Revert (under 15:00) and Encore (10:00 of Endless). The state hash covers trace progress, the finale phase, decoys, win and endless, so replays prove the whole path. `SIM_VERSION` stays 3 and the log shape is unchanged.

Debug helpers (`?debug` panel, all taint the run): `game.debugSetTrace(pct)`, `debugFinishTrace()`, `debugFinalePhase(1|2|3)` and `debugKillAttacker()`. Tests can instead set `TRACE_DEBUG` (`rateMult`, `finaleHpMult`) in `src/data/trace.ts` to reach a real, replayable win without tainting.

## X player card

The build fails if the first load of `index.html` or  exceeds **124KB gzip** (see `scripts/first-load-budget-plugin.ts`). That counts the HTML plus every script and stylesheet it loads without a dynamic import. Three.js loads afterwards.

The card plays the full game from `/`. Build with your public https URL to add the tags:

```bash
PUBLIC_URL=https://revert.run npm run build
```

Production builds on Vercel use `vercel.json`, which sets this URL. Submit https://revert.run to X for player card approval.

## Replayable runs

Every run records its seed, hero, difficulty, inputs and choices in a versioned log with state checkpoints (`src/replay/runLog.ts`). `replayRun` in `src/replay/replayRun.ts` plays a log back headless and rejects it if the state ever differs. Run codes are 3 to 4 times smaller than the JSON log; a 30-minute run with constant input churn is still tens of KB, because the inputs themselves are the entropy. Score submission and the server that runs this check are not built yet. Two limits of a client-only check: the log's unlock list is self-declared (replay proves the run is consistent with the unlocks it claims, not that the player earned them), so a leaderboard should compare ranked runs without trusting or splitting by that list, or use daily mode, which fixes the hero, contract and unlock set; and the daily date is not bounded client-side, so the server must reject daily logs whose date is not the current UTC day. Bump `SIM_VERSION` whenever a change alters simulation results.

## Lint

```bash
npm run lint
```

Comments in `src/` are forbidden by ESLint (`local/no-comments`).

## Formal specs

See `formal/README.md` (TLA+ for phase machine and cutscenes).
