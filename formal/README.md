# Formal verification

`GamePhase.tla` models the phase machine in `Game.setPhase`: popups, pause, window focus and audio silence.

`CutsceneFlow.tla` models the intro, repeating boss entrances (the final confrontation is one of them) and the one-time victory scene after the finale. The continue or cash-out choice is an ordinary popup (`QueuePopup`, `OpenPopup`, `PickCard`), and cashing out is `Die`, so the win flow needs no extra phase.

These specs are hand-written models. TLC proves properties of the model, not of the TypeScript, so change them whenever the phase logic changes.

```bash
npm run formal
```

The script needs Java (`brew install openjdk`) and downloads `tools/tla2tools.jar` on first run.
