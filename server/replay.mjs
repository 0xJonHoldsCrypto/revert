import { createServer } from "node:http";
import type { ReplayPayload } from "../src/replay/RunRecorder.ts";

const PORT = Number(process.env.PORT || 8787);

function verifyReplay(payload: ReplayPayload): { ok: boolean; reason?: string } {
  if (payload.version !== 1) return { ok: false, reason: "bad_version" };
  if (!payload.frames.length) return { ok: false, reason: "empty_replay" };
  if (payload.frames.length > 40000) return { ok: false, reason: "replay_too_long" };
  let lastT = -1;
  for (const f of payload.frames) {
    if (f.t < lastT) return { ok: false, reason: "time_regression" };
    if (Math.abs(f.mx) > 1.5 || Math.abs(f.my) > 1.5) return { ok: false, reason: "invalid_input" };
    lastT = f.t;
  }
  const expectedMin = Math.floor(payload.timeSurvived * 1000 * 0.5);
  if (lastT < expectedMin) return { ok: false, reason: "duration_mismatch" };
  return { ok: true };
}

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/score") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body) as { replay: ReplayPayload; address: string; signature: string };
      const verdict = verifyReplay(parsed.replay);
      if (!verdict.ok) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: verdict.reason }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "accepted", replayFrames: parsed.replay.frames.length }));
    } catch {
      res.writeHead(400);
      res.end("invalid_json");
    }
    return;
  }
  res.writeHead(404);
  res.end("not_found");
}).listen(PORT, () => {
  process.stdout.write(`replay server on ${PORT}\n`);
});
