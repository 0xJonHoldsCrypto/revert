export type AchievementMetric =
  | "bosses"
  | "soloBoss"
  | "evolved"
  | "noDash"
  | "time"
  | "hardTime"
  | "rigs"
  | "merges"
  | "mergeTier"
  | "cameoKinds"
  | "chests"
  | "kills"
  | "weapons"
  | "level"
  | "whales"
  | "bounties"
  | "savedPct"
  | "events"
  | "affixWhale"
  | "won"
  | "winFast"
  | "winNightmare"
  | "endlessTime";

export type AchievementDef = {
  id: string;
  name: string;
  desc: string;
  metric: AchievementMetric;
  target: number;
};

const TABLE: [string, string, string, AchievementMetric, number][] = [
  ["first-boss", "Contained", "Defeat a boss.", "bosses", 1],
  ["three-bosses", "Incident Commander", "Defeat 3 bosses in one run.", "bosses", 3],
  ["six-bosses", "Chain Reaction", "Defeat 6 bosses in one run.", "bosses", 6],
  ["solo-boss", "One Tool Wonder", "Kill a boss using a single tool.", "soloBoss", 1],
  ["first-evolve", "Fully Formed", "Evolve a tool.", "evolved", 1],
  ["triple-evolve", "Hard Fork Club", "Evolve 3 tools in one run.", "evolved", 3],
  ["no-dash", "Standing Ground", "Reach 10:00 without dashing.", "noDash", 1],
  ["survive-5", "Five Minute Finality", "Survive 5:00.", "time", 300],
  ["survive-10", "Ten Minute Block", "Survive 10:00.", "time", 600],
  ["survive-20", "Long Range Fork", "Survive 20:00.", "time", 1200],
  ["hard-5", "Bear Market", "Survive 5:00 on Hard or Nightmare.", "hardTime", 300],
  ["first-rig", "Racked", "Install a hardware rig.", "rigs", 1],
  ["double-rig", "Mining Farm", "Run two rigs at once.", "rigs", 2],
  ["first-merge", "Merge Window", "Merge a gear item.", "merges", 1],
  ["max-merge", "Final Form", "Merge a gear item to its top tier.", "mergeTier", 2],
  ["first-cameo", "Followed Back", "Take a cameo's deal.", "cameoKinds", 1],
  ["all-cameos", "Full Timeline", "Accept every cameo in one run.", "cameoKinds", 5],
  ["chests-10", "Locksmith", "Open 10 chests in one run.", "chests", 10],
  ["kills-1000", "Thousand Reverts", "Revert 1,000 exploits in one run.", "kills", 1000],
  ["kills-4000", "Mass Revert", "Revert 4,000 exploits in one run.", "kills", 4000],
  ["full-loadout", "Full Toolbox", "Hold six tools at once.", "weapons", 6],
  ["level-25", "Senior Responder", "Reach level 25.", "level", 25],
  ["whale", "Whale Liquidated", "Take down a whale.", "whales", 1],
  ["bounty", "Bounty Hunter", "Collect a bounty target.", "bounties", 1],
  ["saved-half", "Majority Saved", "End a run with at least 50% of funds saved.", "savedPct", 50],
  ["events-3", "Mempool Weather", "Live through 3 network events in one run.", "events", 3],
  ["affix-whale", "Stacked Odds", "Take down a whale with two affixes.", "affixWhale", 2],
  ["reverted", "Reverted", "Trace the attacker's wallet and revert his exploit.", "won", 1],
  ["reverted-nightmare", "Reverted on Nightmare", "Revert the exploit on Nightmare.", "winNightmare", 1],
  ["speed-revert", "Speed Revert", "Revert the exploit in under 15:00.", "winFast", 1],
  ["encore", "Encore", "Survive 10:00 of Endless after winning.", "endlessTime", 600],
];

export const ACHIEVEMENTS: AchievementDef[] = TABLE.map(([id, name, desc, metric, target]) => ({ id, name, desc, metric, target }));

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
