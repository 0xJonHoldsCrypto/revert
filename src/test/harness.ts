import { Game } from "../game/Game";
import type { Input } from "../engine/Input";

export function headlessGame(move: () => { x: number; y: number } = () => ({ x: 0, y: 0 })): Game {
  Object.assign(globalThis, { window: { devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, addEventListener() {} } });
  const input = {
    keys: new Set<string>(),
    advanceHeld: false,
    clearEdges() {},
    consumeMute: () => false,
    consumeConfirm: () => false,
    consumeRestart: () => false,
    consumeCardPick: () => null,
    consumeDash: () => false,
    consumeAbility: () => false,
    consumeSkip: () => false,
    consumePause: () => false,
    moveVector: move,
    focus() {},
  } as unknown as Input;
  const canvas = { clientWidth: 1280, clientHeight: 720 } as HTMLCanvasElement;
  const game = new Game(canvas, input, { onPhaseChange() {}, onLevelUpChoices() {}, onHudUpdate() {} });
  Object.assign(game.audio, { play() {}, setMusic() {}, unlock() {}, duck() {} });
  return game;
}

export function startRun(game: Game) {
  game.startRun();
  game.cinematic = null;
  game.player.lift = 0;
  game.setPhase("playing");
}

export function stepSeconds(game: Game, seconds: number, pick: (g: Game) => number = () => 0) {
  for (let i = 0; i < seconds * 60; i++) {
    if (game.phase === "levelup") game.pickUpgrade(pick(game));
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
  }
}
