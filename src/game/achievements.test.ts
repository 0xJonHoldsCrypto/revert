import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../data/achievements";
import * as save from "../save";
import { headlessGame, startRun } from "../test/harness";
import { emptyMetrics, evaluate, RunTracker } from "./achievements";

const none = new Set<string>();

describe("achievement evaluator", () => {
  it("has unique ids and sensible targets", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(ids.length).toBeLessThanOrEqual(34);
    expect(ACHIEVEMENTS.every((a) => a.target > 0 && a.name && a.desc)).toBe(true);
  });

  it("returns nothing for an empty run and skips owned ids", () => {
    expect(evaluate(emptyMetrics(), none)).toEqual([]);
    const t = new RunTracker();
    expect(t.step("kill", 5, { boss: true }, none)).toContain("first-boss");
    expect(t.step("kill", 6, { boss: true }, new Set(["first-boss"]))).not.toContain("first-boss");
  });

  it("awards the win achievements from the win and endless events", () => {
    const only = (ids: string[]) => ids.filter((id) => ["reverted", "reverted-nightmare", "speed-revert", "encore"].includes(id)).sort();
    expect(only(new RunTracker().step("win", 1000, { winTime: 1000, nightmare: false }, none))).toEqual(["reverted"]);
    expect(only(new RunTracker().step("win", 800, { winTime: 800, nightmare: false }, none))).toEqual(["reverted", "speed-revert"]);
    expect(only(new RunTracker().step("win", 899.9, { winTime: 899.9, nightmare: true }, none))).toEqual(["reverted", "reverted-nightmare", "speed-revert"]);
    expect(only(new RunTracker().step("win", 900, { winTime: 900 }, none))).toEqual(["reverted"]);
    const encore = new RunTracker();
    expect(only(encore.step("endless", 1500, { endlessSec: 599 }, none))).toEqual([]);
    expect(only(encore.step("endless", 1501, { endlessSec: 600 }, none))).toEqual(["encore"]);
  });

  it("counts evolutions toward the three-evolution run", () => {
    const t = new RunTracker();
    expect(t.step("evolve", 100, {}, none)).toEqual(["first-evolve"]);
    t.step("evolve", 200, {}, none);
    expect(t.step("evolve", 300, {}, new Set(["first-evolve"]))).toContain("triple-evolve");
  });

  it("grants the no-dash feat only without dashing", () => {
    const clean = new RunTracker();
    expect(clean.step("kill", 599, {}, none)).not.toContain("no-dash");
    expect(clean.step("kill", 601, {}, none)).toContain("no-dash");
    const dasher = new RunTracker();
    dasher.step("dash", 30, {}, none);
    expect(dasher.step("kill", 700, {}, none)).not.toContain("no-dash");
  });

  it("requires a solo flag for the single-tool boss feat", () => {
    const t = new RunTracker();
    expect(t.step("kill", 120, { boss: true, solo: false }, none)).not.toContain("solo-boss");
    expect(t.step("kill", 240, { boss: true, solo: true }, none)).toContain("solo-boss");
  });

  it("tracks whales, bounties, rigs, merges and cameos", () => {
    const t = new RunTracker();
    expect(t.step("kill", 1, { elite: true }, none)).toContain("whale");
    expect(t.step("kill", 2, { elite: true, bounty: true }, none)).toContain("bounty");
    expect(t.step("rig", 3, { rigs: 2 }, none)).toEqual(expect.arrayContaining(["first-rig", "double-rig"]));
    expect(t.step("merge", 4, { tier: 2 }, none)).toEqual(expect.arrayContaining(["first-merge", "max-merge"]));
    for (const cameo of ["elon-tusk", "cz-four", "donald-pump", "vitalik-butterin"]) t.step("cameo", 5, { cameo }, none);
    expect(t.step("cameo", 6, { cameo: "satoshi" }, none)).not.toContain("all-cameos");
    expect(t.step("cameo", 7, { cameo: "michael-sailor" }, none)).toContain("all-cameos");
  });

  it("gates hard-mode survival on difficulty", () => {
    expect(new RunTracker(false).step("kill", 400, {}, none)).not.toContain("hard-5");
    expect(new RunTracker(true).step("kill", 400, {}, none)).toContain("hard-5");
  });

  it("reads saved percent at the end of the run", () => {
    const t = new RunTracker();
    expect(t.step("end", 90, { savedPct: 49.9 }, none)).not.toContain("saved-half");
    expect(t.step("end", 90, { savedPct: 62 }, none)).toContain("saved-half");
  });
});

describe("game hook", () => {
  it("grants on clean runs and skips tainted ones", () => {
    const clean = headlessGame();
    startRun(clean);
    clean.emit("kill", { boss: true });
    expect(save.get().achievements["first-boss"]).toBeGreaterThan(0);
    expect(clean.postMortem().achievements).toContain("first-boss");
    save.patch((d) => {
      d.achievements = {};
    });
    const tainted = headlessGame();
    startRun(tainted);
    tainted.god = true;
    tainted.emit("kill", { boss: true });
    expect(save.get().achievements["first-boss"]).toBeUndefined();
  });
});
