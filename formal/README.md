# Formal verification

`GamePhase.tla` models the phase machine in `Game.setPhase`: popups, pause, window focus and audio silence.

`CutsceneFlow.tla` models the intro, repeating boss entrances and the one-time second-wallet scene in an endless run.

These specs are hand-written models. TLC proves properties of the model, not of the TypeScript, so change them whenever the phase logic changes.

```bash
npm run formal
```

The script needs Java (`brew install openjdk`) and downloads `tools/tla2tools.jar` on first run.
