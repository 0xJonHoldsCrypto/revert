import type { ReplayPayload } from "../replay/RunRecorder.js";

export async function submitScoreWithWallet(payload: ReplayPayload, apiBase: string): Promise<{ ok: boolean; message: string }> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) return { ok: false, message: "No wallet detected. Open on web directly with MetaMask / Rabby." };

  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) return { ok: false, message: "Wallet connection rejected." };

  const summary = `REVERT score=${payload.score} time=${payload.timeSurvived} kills=${payload.kills} seed=${payload.seed}`;
  const sig = (await eth.request({
    method: "personal_sign",
    params: [summary, address],
  })) as string;

  const res = await fetch(`${apiBase}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature: sig, summary, replay: payload }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, message: text || "Server rejected score." };
  }
  return { ok: true, message: "Score submitted. Replay verification pending." };
}
