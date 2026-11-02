# Formal verification

`GamePhase.tla` models menu / playing / levelup / pause / win / lose transitions and checks type invariants.

`CutsceneFlow.tla` models boss intro banners and end-state cutscenes.

Run with the TLA+ Toolbox or CLI:

```bash
java -cp tla2tools.jar tlc2.TLC formal/GamePhase.tla
```

These specs are meant to stay aligned with `Game.setPhase` and boss scheduling in `src/game/Game.ts`.
