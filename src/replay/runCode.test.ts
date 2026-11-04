import { describe, expect, it } from "vitest";
import { headlessGame, startRun } from "../test/harness";
import { decodeRunBytes, decodeRunCode, encodeRunBytes, encodeRunCode, RUN_CODE_PREFIX } from "./runCode";
import { serializeRunLog, type RunLog } from "./runLog";

function record(seconds: number): RunLog {
  let tick = 0;
  const game = headlessGame(() => ({ x: Math.cos(tick / 90) + (tick % 700 < 90 ? 1 : 0), y: Math.sin(tick / 130) }));
  game.aspectSource = () => 16 / 9;
  game.chooseHero("keel");
  startRun(game);
  const input = game["input"] as unknown as { consumeDash: () => boolean; consumeAbility: () => boolean };
  input.consumeDash = () => tick % 170 === 0;
  input.consumeAbility = () => tick % 400 === 0;
  let cards = 0;
  while (game.runTick < seconds * 60 && game.phase !== "lost") {
    tick++;
    if (game.phase === "levelup") {
      cards++;
      if (cards % 7 === 0 && game.rerolls > 0 && game.choiceMode === "levelup") game.rerollCards();
      else if (cards % 11 === 0 && game.choiceMode === "levelup") game.skipCards();
      else game.pickUpgrade(cards % game.levelUpChoices.length);
      continue;
    }
    if (game.phase === "cinematic" && game.cinematic) game.cinematic.t += 99;
    if (game.phase === "cutscene") game.cutscene.skip();
    game.update(1 / 60);
  }
  return game.runLog();
}

describe("run code", () => {
  it("round-trips short and long runs exactly", async () => {
    for (const seconds of [3, 600]) {
      const log = record(seconds);
      const code = await encodeRunCode(log);
      expect(code.startsWith(RUN_CODE_PREFIX)).toBe(true);
      expect(await decodeRunCode(code)).toEqual(log);
      expect(await decodeRunCode(` ${code.slice(0, 40)}\n${code.slice(40)} `)).toEqual(log);
      expect(await decodeRunBytes(await encodeRunBytes(log))).toEqual(log);
    }
  }, 120_000);

  it("is at least 5x smaller than JSON for a ten minute run", async () => {
    const log = record(600);
    const code = await encodeRunCode(log);
    expect(code.length * 5).toBeLessThan(serializeRunLog(log).length);
  }, 120_000);

  it("accepts legacy JSON codes", async () => {
    const log = record(3);
    expect(await decodeRunCode(serializeRunLog(log))).toEqual(log);
  });

  it("rejects truncated and garbage input", async () => {
    const log = record(30);
    const code = await encodeRunCode(log);
    expect(await decodeRunCode(code.slice(0, code.length - 9))).toBeNull();
    expect(await decodeRunCode(code.slice(0, 20))).toBeNull();
    expect(await decodeRunCode(RUN_CODE_PREFIX)).toBeNull();
    expect(await decodeRunCode(RUN_CODE_PREFIX + "!!!!")).toBeNull();
    expect(await decodeRunCode(RUN_CODE_PREFIX + "AAAAAAAAAAAAAAAA")).toBeNull();
    expect(await decodeRunCode("hello")).toBeNull();
    expect(await decodeRunCode("")).toBeNull();
    expect(await decodeRunCode("{}")).toBeNull();
    expect(await decodeRunBytes(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull();
  }, 60_000);
});
