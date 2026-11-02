export type CameoId = "elon-tusk" | "cz-four" | "donald-pump" | "vitalik-butterin" | "michael-sailor" | "satoshi";

export type CameoDef = {
  name: string;
  handle: string;
  color: string;
  deal: string;
  arrival: string;
  posts: string[];
};

export const CAMEOS: Record<CameoId, CameoDef> = {
  "elon-tusk": {
    name: "Elon Tusk",
    handle: "@elontusk",
    color: "#7cc4ff",
    arrival: "just bought this chain. stand here, i'll fix it.",
    deal: "Rockets incoming. Most of them land on the enemy.",
    posts: ["this mempool is so back", "considering renaming the blockchain to X", "lol"],
  },
  "cz-four": {
    name: "C.Z. Four",
    handle: "@czfour",
    color: "#f0c14d",
    arrival: "4. come to the ring.",
    deal: "Funds are safu. Treasury refilled, you are patched up.",
    posts: ["4", "ignore FUD. keep building.", "funds are safu"],
  },
  "donald-pump": {
    name: "Donald Pump",
    handle: "@realdonaldpump",
    color: "#ffb020",
    arrival: "the biggest airdrop. maybe ever. everybody says so.",
    deal: "Tremendous $SAFU shower. The farmers will come for it.",
    posts: ["TREMENDOUS LIQUIDITY", "nobody knows blocks like me", "we are going to win so much yield"],
  },
  "vitalik-butterin": {
    name: "Vitalik Butterin",
    handle: "@vitalikbutterin",
    color: "#b58cff",
    arrival: "i wrote a 9000 word post about this. or: stand here.",
    deal: "Hard fork. One tool upgrades and the bullets never happened.",
    posts: ["have you considered a rollup", "actually, it's more nuanced", "the merge was fine"],
  },
  "michael-sailor": {
    name: "Michael Sailor",
    handle: "@michaelsailor",
    color: "#ff9f43",
    arrival: "there is no second best. board now.",
    deal: "Never sell. Big power for 30 seconds, but no dashing.",
    posts: ["bought more", "sold a kidney. bought more", "you can't dash if you never sell"],
  },
  satoshi: {
    name: "Satoshi",
    handle: "@????",
    color: "#ffffff",
    arrival: "...",
    deal: "Leaves you something legendary, then vanishes.",
    posts: ["Chancellor on brink", "..."],
  },
};

export const CAMEO_ORDER: CameoId[] = ["elon-tusk", "cz-four", "donald-pump", "vitalik-butterin", "michael-sailor"];
export const SATOSHI_CHANCE = 0.12;
