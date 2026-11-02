# Exploit.run: quality brief for Cursor

**Goal:** reach the production quality of tibo.dog with our own art, music, jokes, code and identity. Tibo is a benchmark for technique. Do not copy its assets, code, script or characters. Tuning numbers marked *(ref)* come from studying its build and are starting points. Tune them by eye.

**Stop adding content until Phase 4.** The game has plenty of systems and very little presentation. Adding more weapons, biomes or data will not close the gap.

## Working rules

1. **Do the phases in order.** Commit after each numbered task, and do not start a phase until the previous phase's "Done when" list passes.
2. **Verify in the running game.** A task is not done because it compiles. Open the game, reach the state, and take a screenshot. Run `npm run build` and `npm run lint` before each commit.
3. **Only one agent edits at a time.** Do not run this alongside another editor on the same checkout.
4. **Keep repo conventions.** ESLint forbids comments in `src/`. The X embed stays under the 124 KB gzip budget and must not import Three.js.
5. **Delete replaced code in the same commit.** No parallel renderers left behind.
6. **Do not change the design decisions in this brief silently.** If one doesn't work, say why and propose an alternative.

## Current state

| Finding | Evidence |
|---|---|
| Dev server on 5179 serves stale code | Served `characters.ts` says CZ/Elon/SBF; disk says Keel/Nyx/Diff/Trace. 16 of 37 modules differed in the playtest. |
| No git history | All files are untracked and there are no commits. |
| Gameplay draws only on 2D canvas | `src/main.ts` skips `pixelEngine.render` while playing. The world scene in `src/render/ThreePixelEngine.ts` is effectively dead. |
| Weapon effects are invisible | `src/render/GbcRenderer.ts` never draws `game.orbiters` or `game.particles`. |
| No SFX | `hit()`, `levelUp()` and `dash()` in `src/audio/ChipSynth.ts` have no call sites. Music is one 8-note loop per zone. |
| Final boss cannot spawn | The last `BOSS_TIMES` entry and `WIN_TIME_SEC` are both 1200s, and the win check runs first. |
| Dash key skips cutscenes | Space sets `cutsceneAdvancePressed` during play, and it is never cleared. Space in a cutscene also sets `dashPressed`. |
| All enemies share one chase AI | Bosses are large HP pools that walk at you, with no attacks. |
| Boss contact range is far beyond its sprite | A boss hurts at about 160 screen px, with a sprite about 42 px tall. |
| Theme is vocabulary only | Enemies look like goblins, worms, crabs and fish. No mechanic expresses crypto. Theme audit: 3.5/10. |
| Cutscenes are slides | One image per beat, text overlaps, and every boss slide uses the same sprite. |

## Phase 0: Stabilize

1. Make the first git commit. Create `main`, since the repo's default is `main` and the current branch is `master`. Confirm `dist` stays ignored.
2. Stop all Vite processes and restart once. Set one port in `vite.config.ts` with `strictPort: true` (config says 5173, the running server uses 5179). Edit a string and confirm it updates. If the watcher is still unreliable, set `server.watch.usePolling: true`.
3. In `src/engine/Input.ts`, add `clearEdges()` and call it from `Game.setPhase`. Clear held keys on `blur` and auto-pause when `document.hidden` is true.
4. Separate intents: `advance` and `dash` must never fire from one key press. Holding Space for 1s skips a cutscene; a tap advances only where the beat allows it. Remove Esc-to-skip or show it on screen.
5. Set the final boss at 19:00 and make victory require the Grandmaster's death after the clock reaches 20:00.
6. Stop drawing the HUD over cutscenes and end screens (`src/ui/OverlayUI.ts`). Clamp displayed HP at 0. Hide score submission after a loss.
7. Enter or Space starts from the title. Keys 1, 2 and 3 pick level-up cards.
8. Spawn the player in the first zone, not the `apt` zone at world centre. Fix `biomeAt` so its fallback doesn't return the first zone for large outer areas.
9. Add `?debug=1`, in dev builds only: jump to a time, spawn any boss, play any cutscene, god mode, and an FPS and draw-call readout. Every later phase needs this for verification.

**Done when:** the server reflects edits, dashing no longer eats a boss cutscene, the Grandmaster fight happens, and alt-tabbing doesn't leave keys stuck.

## Phase 1: HD-2D renderer

This phase gives the largest visual gain per hour. Use one renderer for gameplay, title and cutscenes: Three.js with crisp pixel sprites standing in a lit 3D world. The 2D canvas keeps HUD text only. Keep `Canvas2DRenderer` solely for the embed.

1. **Fixed-tick sim.** Run the sim at 60 Hz with an accumulator, at most 8 catch-up steps per frame, and interpolate rendering. This replaces the 50 ms `dt` cap, which causes slow motion. Move shake and other render randomness out of sim state, and use a seeded RNG in the sim. Replay validation depends on this.
2. **Revive the world scene** in `ThreePixelEngine.ts` and render it during play. Then delete `GbcRenderer` world drawing and the unused `TitleSceneRenderer` backgrounds as they are replaced.
3. **Camera:** long lens, FOV about 20° *(ref)*, pitch about 50° *(ref)*, placed far back so the world reads as a miniature. The current FOV 46 looks wide and cheap. Add a small lead in the movement direction and a smooth follow.
4. **Instanced sprites.** One texture atlas and `InstancedMesh` with per-instance frame, flip and flash attributes. Remove the current one-material-per-enemy pool, including `mat.needsUpdate = true` every frame. Target 500 enemies at 60 fps.
5. **Real shadows.** Directional light with a 2048 shadow map, and alpha-tested depth so upright sprites cast character-shaped shadows. Use a low light angle, so the shadow is about 1.3x body length *(ref)*, plus a soft contact blob at the feet. This is the strongest grounding cue.
6. **Our lighting (do not copy tibo's warm field):** "server room at 3 a.m." A cool moon key (about `#7FD8FF`), deep indigo shade, and hot alarm accents in amber and red from emissive props, plus up to 4 moving point lights. ACES tone mapping. Keep the ground at mid value, so sprites stay readable.
7. **Post chain in one pass after an HDR target:** tilt-shift on top and bottom bands, bloom with threshold above 1 so only emissives glow, split-tone grading, vignette about 0.18 *(ref)*, and animated grain at ±1% *(ref)*.
8. **Quality tiers and dynamic resolution.** High, medium and low set shadow size, bloom, tilt-shift, lights and DPR cap. Drop resolution by x0.85 when frames exceed 18.5 ms, recover below 17.2 ms, minimum scale 0.5 *(ref)*. Handle `webglcontextlost`.
9. **Fix scale once.** One world unit size, independent of window height, with sprites sized against their hit circles. The player hitbox should be about half the visual body, with enemy hit circles close to their sprites. Bosses are 3 to 5x the player's height. Widen the view so weapon range and spawn distance fit: enemies spawn off-screen at every supported aspect ratio, and shots land on visible targets.

**Done when:** a 1080p screenshot of gameplay has sprites with cast shadows, glowing emissives and depth blur, and looks like a lit miniature; 300+ enemies hold 60 fps on a laptop; and nothing hits you visibly out of contact.

## Phase 2: Combat feel, VFX and audio

1. **Draw everything:** orbiters, AoE rings, whip arcs, beams, trails and impacts. Each of the 7 weapons gets a distinct silhouette and colour.
2. **Feedback for every event:**
   - Enemy hit: full white flash for 2 to 3 frames, small knockback, merged damage numbers.
   - Enemy death: squash, pop and themed debris. Burst coins, shards or packets.
   - Separation: enemies push apart so they never stack into one blob.
   - Player hurt: red edge pulse, flash, short hit-stop.
   - Dash: afterimages and dust, with a dash meter at the feet. Add a 100 ms input buffer *(ref)*.
3. **Shake and freeze.** Trauma-based shake (max offset about 6, decay about 1.5/s *(ref)*) with settings for full, low and off. Hit-stop 120 to 225 ms *(ref)*, only for big events: boss landing, boss death, evolution, player death. Death gets a 0.75 s hold *(ref)* with slow motion before the results.
4. **Impact frames.** A 1-bit ink/paper flash for 3 to 16 frames on the biggest moments only.
5. **Audio engine.** Replace the `ChipSynth` interval with an AudioWorklet or a look-ahead WebAudio scheduler driven by the same clock as cutscenes. Four or more voices: lead, bass, pad, noise and drums.
6. **SFX, at least 25:** hit, crit, kill, coin, xp, hurt, dash, level-up, card select, chest, jackpot, evolve, boss spawn, boss death, enemy shot, near miss, UI, dialogue blip, pager, terminal type, alarm, tx confirmed, liquidation, gas spike, rug pull. Rate-limit to about 8/s for pickups and 3/s for combat *(ref)*, or swarms become noise.
7. **Music states:** title, intro, one per zone, boss, silence, win, game over. 2-bar crossfades, plus a duck on pause. Add mute on M, and music and SFX volumes.

**Done when:** a muted video makes each weapon identifiable, and with sound on, every action has a cue. Also delete the 8-note loop.

## Phase 3: Cutscene system

The cutscene engine is rewritten, not patched. Delete `drawDesk`, `drawTerminal`, `drawCrew` and the hard-coded print slide.

**Engine: `src/cutscene/score.ts`, `timeline.ts`, `panel.ts`.**
- A scene is declarative data at a BPM, with times in 16th-note steps. One clock drives visuals and audio.
- Compile events into tween channels that can be sampled deterministically at any time, so debug can scrub.
- Channels: camera dolly, roll, shake, light intensity, flicker, panel position, rotation, scale, dim, layer reveal, overlay text, SFX and music cues.
- A panel is a textured set of parallax layers in the Three scene: `bg`, `mid`, `fx` and `text`, at different depths, lit by a moving point light. Draw live screens such as phones and terminals at runtime on a canvas texture, so text stays crisp and localizable.
- Skip by holding Space for 1 s, with a visible progress ring. Honor `prefers-reduced-motion`: no shake, flashes become fades.
- A scene ends by matching the gameplay camera exactly, with no cut to black. Throw in dev if the end pose doesn't match.

**Editing rules:** panels enter in 150 to 230 ms with ease-out and 2 to 9° tilt, overlap the previous panel (which dims to about 0.7 and scales to 0.92), and sit in a full-screen layout. Then one long hold for the joke. **Fast cuts and a single long hold are the craft.** Never put two text elements in one zone. Test 16:9, 4:3 and phone portrait.

**Intro "gm" (original script). 124 BPM, about 15 s. Write the art to this.**

| t (s) | Shot | Sound |
|---|---|---|
| 0.0 | Dark SOC at 03:12. A dev, feet up, slurps noodles lit by a monitor. Slow push-in. | Room hum |
| 1.5 | Pager slams in from below: `HOT WALLET OUTFLOW`. Noodles freeze mid-air. | Pager buzz |
| 2.3 | Crash zoom into the monitor. Hard cut. | Whoosh |
| 2.7 | Explorer screen. `$1.20B` counter starts rolling up. Lines of transactions scroll by. | Rising ticks |
| 4.2 | An inbound on-chain message types out from `0xdead…`: `gm` | Text blip |
| 4.8 | **Hold 2 s.** Then, `thx for the liquidity`. The joke beat. | Silence, one blip |
| 6.8 | Dev's face fills the panel, a noodle hanging from their mouth. | Sting |
| 7.5 | Multisig panel: `SIGNERS 1/3`, two avatars with `zzz`. | Snore gag |
| 8.8 | Dev grabs the hardware wallet with both hands. Build: light and shake rise. | Riser |
| 10.0 | Thumb presses `SIGN: PAUSE`. Hard cut on a short ink impact frame. | Hit |
| 10.4 | Screen: `tx pending… gas: 9,999 gwei`. The explorer graph tears open like a rift. | Glitch |
| 11.3 | Dev, chair and noodles are pulled in; the panel twists and shrinks into the tear. | Suck-in |
| 12.8 | White flash. Rift opens over the world. Hero falls while the camera tilts to the gameplay angle. | Music drop |
| 14.0 | Faceplant on the ground. Speed lines, dust, shake. | Thud |
| 14.6 | Hero scrambles up. Game starts with no cut. `BLOCK 21,000,000` appears on the HUD. | First bar of zone music |

This also solves the setting problem: **gameplay takes place inside the chain.** Restarts reuse a 2 s landing only.

**Boss entrances (letterbox, real-time, in the game camera).** Bars animate in, about 12% each. The camera moves to the boss, it drops in within 150 ms, then impact frame, shake, and a one-line taunt with a portrait while the sim is frozen. A name plate and HP bar follow. Each boss gets a unique portrait, entrance gimmick and line:
- **MEV King:** his entrance plays a split second before yours, then the screen rewinds and he's already there. `I saw that coming. Literally.`
- **Unit 414:** every enemy turns and salutes. Uses a generic fictional name.
- **Phish King:** arrives as a fake "Claim Airdrop" modal, which is torn open.
- **Oracle Sovereign:** the HUD numbers go wrong while he talks.
- **APT38-style boss:** rename to a fictional group. Opens with a resume-shaped job offer PDF.
- **Grandmaster:** the chain itself. Blocks stop. The clock freezes for the fight.

**Victory:** the outflow counter stops, then rewinds as funds return. Multisig signers wake up: `gm. what'd we miss?` Then the post-mortem results.

**Done when:** the intro plays start to finish with synced sound and no slide transitions, it flows into gameplay with no visible cut, and each boss has a unique entrance. No text overlaps at the three test sizes.

## Phase 4: Make the theme real

The theme must change what the player *does*, not only what things are called.

**1. Funds at risk is the core stake.**
Add a large `OUTFLOW` meter to the HUD. A run starts with `$1.2B` in play. Drainer-class enemies carry funds off the map; killing them recovers the money. Reaching 0 ends the run as `INSOLVENT` on Hard and up, and on lower difficulties reduces the score only. The final score is **funds saved**, not time.

**2. Show the chain.**
- Replace the mm:ss clock with a block height and a small time readout; a block every 12 s.
- A slim mempool ticker on one screen edge.
- A kill feed in explorer format: `0x3fa…c1 reverted · out of gas`.
- Gas spikes as a timed world event: enemies rush while cooldowns lag.

**3. Enemy art and behaviour.** No fantasy creatures. Each kind has a silhouette readable at gameplay scale, and a first-seen name tag.

| Enemy kind | Looks like | Behaviour |
|---|---|---|
| `script-kiddie` | Hoodie with a laptop | Basic swarm. Copies your last-used path badly. |
| `phishing-bot` | Floating fake popup with legs | **Disguises as XP or a chest.** Bites when collected, with a subtle tell. |
| `mev-searcher` | Sleek courier drone | **Front-runs:** dashes to steal the nearest pickup before you reach it. Killing it returns the loot. |
| `bridge-drainer` | Suction crawler with a hose | **Tethers a vault node and drains Funds at risk** until killed. Priority target. |
| `rug-dev` | Suited guy holding a carpet | **Yanks the floor:** telegraphed rug area, then it collapses and flings you. |
| `oracle-witch` (rename: Oracle Manipulator) | Hovering price display | **Shows false prices:** chest costs and HUD values glitch nearby. Rename the ID too. |
| `sim-swapper` | Figure with a stack of SIM cards | **Swaps your controls** for 2 s on hit, with a clear on-screen warning. Keep it short and fair. |
| `insider` | Friendly-looking staff with a badge | **Looks allied** with a green tag until close, then turns. |
| `lazarus-op` | Masked operator in black | Ranged, keeps distance, flanks in groups. |

**4. Boss fights.** Every boss has 2 to 3 telegraphed attacks, using ground rings and a clear wind-up of at least 0.7 s, plus a phase change at 50% HP.
- **MEV King:** places a danger zone where you are heading (sandwich attack: walls on both sides).
- **Unit 414:** summons squads; mapping beams sweep the arena.
- **Phish King:** fills the arena with fake pickups and popups, some real.
- **Oracle Sovereign:** rewrites values; damage numbers and HP display lie for a window; hits a true weak point.
- **APT boss:** hijacks your weapons briefly; disable the implant nodes to recover.
- **Grandmaster:** block-reorg attack rewinds positions by 2 s, so your past path becomes a hazard.

**5. Upgrades that behave like the term.**
- **Leverage Long:** big damage, but taking a hit at low HP causes liquidation: lose a level's worth of bonus.
- **Flash Loan:** huge cooldown boost for 8 s, then a repay debuff if you did not hit a kill target.
- **Multisig:** a fatal hit is blocked only if 2 of 3 charges remain.
- **Staking:** payout grows, with a lock-up. Fix the description/effect mismatch (HP vs XP) in `wells.ts`.
- **Rug Pull Coin:** huge orbit damage that expires randomly.

**6. Zones.** Drop the coloured meadow. Rename and rebuild the four biomes, each with its own tileset, props, landmark, lighting and music:

| Biome ID | Zone | Look |
|---|---|---|
| `wasteland` | **The Mempool** (start) | Glowing tx packets drift across a dark grid; floating gas-price signs. |
| `cex` | **Hot Wallet Vault** | Vault doors, server aisles, cable trays, red alarm light. |
| `defi` | **The Bridge** | Huge broken span over void, cross-chain cargo, liquidity falls. |
| `apt` | **The Dark Forest** (endgame) | Black monolith trees made of contracts, watchers in the dark. Spawn is far from here. |

Rename the IDs in code when the zones change.

**7. Identity.**
- Currency: decide on one. Replace sats with a generic in-world token (`$SAFU`) with its own coin sprite.
- Retire internal IDs `cz`, `elon`, `sbf`. Give Keel, Nyx, Diff and Trace distinct silhouettes and props.
- Replace `Lazarus`, `APT38`, `Uniswap`, `Aave` and `Binance` with fictional names in all user-facing text. Parody by attack type, not by real people or brands.
- Weapons: rename `alameda-burst` and `bnb-whip` IDs. A defender should not fire "exploit payloads".
- Results screen: a **post-mortem report** with incident ID, attack timeline, funds saved, what got you (`Root cause: Phish King`), and a damage table per weapon.

**Done when:** a stranger can look at any 10-second clip and identify it as a crypto-hacking game with the HUD hidden, and can name 3 enemy mechanics after one run.

## Phase 5: First 60 seconds and UI system

1. **Design tokens.** One palette and type system in CSS variables. Direction: black, amber and alarm red; a heavy condensed display face and one mono, subset and preloaded. Delete glass cards. Keycap badges on every control.
2. **HUD:** thin full-width XP bar on top; block clock at centre; Funds at risk prominent; loadout icons with level pips at bottom left; HP and dash at the feet. Off-screen pointers for chests and bosses. Dark plates so it reads on any scene.
3. **Title:** one huge physical object, a **red `PAUSE CONTRACT` button under a flip-up safety cover**, on a dark desk with a blinking pager. Clicking it unlocks audio and starts the intro. No menu clutter. Difficulty appears after the first story run.
4. **Story first run.** A scripted first game of about 90 seconds that cannot be lost and pays out a reward every few seconds. The sim clock stays at 0 until the first objective. An in-fiction teacher (an on-chain voice: the attacker heckling you through tx messages) teaches one instruction at a time, and the sim freezes during lines. A scripted ending hands off to Easy.
5. **Level-up cards:** framed cards with an animated shine, number keycaps, `NEW` and `LV n` tags, Reroll, Skip and Banish, and a Recommended marker. Keep the world visible behind them. Use a jackpot reel for chests. Tell the player what they got.
6. **Death to replay in under 3 s:** death hold, results, R to retry, 2 s landing, playing.
7. **Options:** shake, flashes, damage numbers, volumes, quality, color-vision mode. No sponsor interstitials.

**Done when:** a new player can start with one click, understand the game without reading a page, and get a level-up within 10 s.

## Phase 6: Share loop and final polish

1. Share button with a stats-encoded URL and a server-generated OG image: `I saved $842M from the Phish King. Can you do better?`
2. Keep the X player card working under budget. Test that the real game or a real slice plays in the embed.
3. PWA manifest, touch controls with a flick to dash, phone layouts for cards and HUD, context-loss recovery.
4. Balance by bot: because the sim is seeded and fixed-tick, write a headless script that plays runs and reports time-to-death per difficulty. Set targets: Easy novice median death at 12 minutes or later; enemy ceilings about 35 at 90 s, 150 at 255 s, cap about 500 *(ref)*.
5. Server validates replays by deterministic re-simulation, not timing bounds, before any public leaderboard.
6. Update the README, which still describes older content.

## Art pipeline (the main risk)

Procedural sprites in `src/pixel/*` will not reach this bar. Tibo's look is a modest amount of **authored** pixel art (about 300 KB) under a heavy render path. Use this plan:

- Add `src/assets/` with PNG atlases and a JSON manifest, loaded through one module. Build the renderer against this format from Phase 1.
- Fix one pixel density for all gameplay art, and one for cutscene panels (240x240 per layer). Use one master palette of about 32 to 48 colours.
- Use existing procedural art as placeholders exported to the atlas, and replace them batch by batch: heroes, enemies, bosses, props, tiles, then panels.
- **Minimum art list:** 4 heroes with 4-direction walk, 9 enemies with walk and death, 6 bosses with idle and attack and portrait, 4 tilesets with about 12 props each, about 15 layered intro panels.
- Never ship a mix of pixel densities or a fantasy placeholder under a crypto name in a release.

## Order of work if time is short

Phase 0, then Phase 1 tasks 2 to 7, Phase 2 tasks 1 to 3 and 6, the Phase 3 intro, then enemies and Funds at risk from Phase 4. Those produce most of the perceived change.
