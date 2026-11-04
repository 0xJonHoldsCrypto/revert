import { CHOICE_TYPES, parseRunLog, serializeRunLog, validateRunLog, type RunChoice, type RunLog } from "./runLog";

export const RUN_CODE_PREFIX = "REVERT1:";
const MAX_BYTES = 16_000_000;
const MAX_CODE_CHARS = 24_000_000;
const DIRS = 257;
const WORD = 4294967296;
const RAW = 0;
const DEFLATE = 1;
const PACKED = 1;
const JSON_BODY = 0;

class Writer {
  private buf = new Uint8Array(4096);
  private len = 0;

  private room(n: number) {
    if (this.len + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(b: number) {
    this.room(1);
    this.buf[this.len++] = b;
  }

  varint(n: number) {
    this.room(10);
    while (n >= 128) {
      this.buf[this.len++] = (n % 128) | 128;
      n = Math.floor(n / 128);
    }
    this.buf[this.len++] = n;
  }

  word(n: number) {
    this.room(4);
    for (let i = 0; i < 4; i++) {
      this.buf[this.len++] = n % 256;
      n = Math.floor(n / 256);
    }
  }

  bytes(b: Uint8Array) {
    this.room(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  done(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

class Reader {
  pos = 0;
  constructor(private buf: Uint8Array) {}

  get end(): boolean {
    return this.pos >= this.buf.length;
  }

  byte(): number {
    if (this.pos >= this.buf.length) throw new Error("eof");
    return this.buf[this.pos++]!;
  }

  varint(): number {
    let n = 0;
    let scale = 1;
    for (let i = 0; i < 9; i++) {
      const b = this.byte();
      n += (b & 127) * scale;
      if (b < 128) return n;
      scale *= 128;
    }
    throw new Error("varint");
  }

  count(): number {
    const n = this.varint();
    if (n > this.buf.length - this.pos + 1) throw new Error("count");
    return n;
  }

  word(): number {
    let n = 0;
    let scale = 1;
    for (let i = 0; i < 4; i++) {
      n += this.byte() * scale;
      scale *= 256;
    }
    return n;
  }

  bytes(n: number): Uint8Array {
    if (n > this.buf.length - this.pos) throw new Error("eof");
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

const isUint = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const sorted = (list: number[]) => list.every((n, i) => isUint(n) && (i === 0 || n >= list[i - 1]!));

function packable(log: RunLog): boolean {
  if (log.moves.length % 2 !== 0 || !log.moves.every(isUint)) return false;
  if (!sorted(log.dashes) || !sorted(log.abilities)) return false;
  if (!sorted(log.choices.map((c) => c[0])) || !log.choices.every((c) => CHOICE_TYPES.includes(c[1]) && isUint(c[2]))) return false;
  if (!sorted(log.aspects.map((a) => a[0])) || !log.aspects.every((a) => a[1] >= 0 && Number.isSafeInteger(Math.round(a[1] * 1000)) && Math.round(a[1] * 1000) / 1000 === a[1])) return false;
  return log.checkpoints.every((n) => isUint(n) && n < WORD);
}

function writeDeltas(w: Writer, list: number[]) {
  w.varint(list.length);
  let prev = 0;
  for (const n of list) {
    w.varint(n - prev);
    prev = n;
  }
}

function readDeltas(r: Reader): number[] {
  const out: number[] = [];
  let prev = 0;
  for (let i = r.count(); i > 0; i--) {
    prev += r.varint();
    out.push(prev);
  }
  return out;
}

function pack(log: RunLog): Uint8Array {
  const w = new Writer();
  if (!packable(log)) {
    w.byte(JSON_BODY);
    w.bytes(new TextEncoder().encode(serializeRunLog(log)));
    return w.done();
  }
  w.byte(PACKED);
  const { moves, dashes, abilities, choices, aspects, checkpoints, ...head } = log;
  const header = new TextEncoder().encode(JSON.stringify(head));
  w.varint(header.length);
  w.bytes(header);
  w.varint(moves.length / 2);
  let last = 0;
  for (let i = 0; i < moves.length; i += 2) {
    const d = (((moves[i]! - last) % DIRS) + DIRS) % DIRS;
    w.varint(d > DIRS / 2 ? (DIRS - d) * 2 - 1 : d * 2);
    last = moves[i]!;
  }
  for (let i = 1; i < moves.length; i += 2) w.varint(moves[i]!);
  writeDeltas(w, dashes);
  writeDeltas(w, abilities);
  w.varint(choices.length);
  let prev = 0;
  for (const [tick, type, index] of choices) {
    w.varint(tick - prev);
    w.byte(CHOICE_TYPES.indexOf(type));
    w.varint(index);
    prev = tick;
  }
  w.varint(aspects.length);
  prev = 0;
  for (const [tick, aspect] of aspects) {
    w.varint(tick - prev);
    w.varint(Math.round(aspect * 1000));
    prev = tick;
  }
  w.varint(checkpoints.length);
  for (const n of checkpoints) w.word(n);
  return w.done();
}

function unpack(data: Uint8Array): RunLog | null {
  const r = new Reader(data);
  const kind = r.byte();
  if (kind === JSON_BODY) return parseRunLog(new TextDecoder().decode(data.subarray(1)));
  if (kind !== PACKED) return null;
  const head = JSON.parse(new TextDecoder().decode(r.bytes(r.varint()))) as Partial<RunLog>;
  const moves: number[] = [];
  let last = 0;
  for (let i = r.count(); i > 0; i--) {
    const z = r.varint();
    last = (((last + (z % 2 ? -(z + 1) / 2 : z / 2)) % DIRS) + DIRS) % DIRS;
    moves.push(last, 0);
  }
  for (let i = 1; i < moves.length; i += 2) moves[i] = r.varint();
  const dashes = readDeltas(r);
  const abilities = readDeltas(r);
  const choices: RunChoice[] = [];
  let prev = 0;
  for (let i = r.count(); i > 0; i--) {
    prev += r.varint();
    const type = CHOICE_TYPES[r.byte()];
    if (!type) return null;
    choices.push([prev, type, r.varint()]);
  }
  const aspects: [number, number][] = [];
  prev = 0;
  for (let i = r.count(); i > 0; i--) {
    prev += r.varint();
    aspects.push([prev, r.varint() / 1000]);
  }
  const checkpoints: number[] = [];
  for (let i = r.count(); i > 0; i--) checkpoints.push(r.word());
  if (!r.end) return null;
  return validateRunLog({ ...head, moves, dashes, abilities, choices, aspects, checkpoints });
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const written = writer.write(data as BufferSource).then(() => writer.close());
  written.catch(() => undefined);
  const reader = stream.readable.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      reader.cancel().catch(() => undefined);
      throw new Error("too large");
    }
    parts.push(value);
  }
  await written;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const canCompress = () => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function encodeRunBytes(log: RunLog): Promise<Uint8Array> {
  const body = pack(log);
  const out = new Writer();
  if (canCompress()) {
    try {
      const z = await pipe(body, new CompressionStream("deflate-raw"));
      if (z.length < body.length) {
        out.byte(DEFLATE);
        out.bytes(z);
        return out.done();
      }
    } catch {
      out.byte(RAW);
      out.bytes(body);
      return out.done();
    }
  }
  out.byte(RAW);
  out.bytes(body);
  return out.done();
}

export async function decodeRunBytes(bytes: Uint8Array): Promise<RunLog | null> {
  try {
    if (bytes.length < 2 || bytes.length > MAX_BYTES) return null;
    const mode = bytes[0];
    const rest = bytes.subarray(1);
    if (mode === RAW) return unpack(rest);
    if (mode !== DEFLATE || !canCompress()) return null;
    return unpack(await pipe(rest, new DecompressionStream("deflate-raw")));
  } catch {
    return null;
  }
}

export async function encodeRunCode(log: RunLog): Promise<string> {
  return RUN_CODE_PREFIX + toBase64Url(await encodeRunBytes(log));
}

export async function decodeRunCode(text: string): Promise<RunLog | null> {
  const t = text.trim();
  if (t.length > MAX_CODE_CHARS) return null;
  if (t.startsWith("{")) return parseRunLog(t);
  if (!t.startsWith(RUN_CODE_PREFIX)) return null;
  const bytes = fromBase64Url(t.slice(RUN_CODE_PREFIX.length).replace(/\s+/g, ""));
  return bytes ? decodeRunBytes(bytes) : null;
}
