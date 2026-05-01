import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { homedir } from "node:os";
import { normalizeModel } from "./normalize.mjs";

function getProjectsDir() {
  return process.env.CCC_PROJECTS_DIR || join(homedir(), ".claude", "projects");
}
function getWindowDays() {
  const n = Number(process.env.CCC_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function* walkJsonl(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { yield* walkJsonl(full); }
    else if (e.isFile() && e.name.endsWith(".jsonl")) { yield full; }
  }
}

async function parseJsonl(filePath, cutoff, totals, fileCount, seenReqIds) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type !== "assistant") continue;
    const model = obj.message?.model;
    if (!model || model === "<synthetic>") continue;
    if (!obj.timestamp) continue;
    if (Date.parse(obj.timestamp) < cutoff) continue;

    const reqId = obj.requestId;
    if (reqId) {
      if (seenReqIds.has(reqId)) continue;
      seenReqIds.add(reqId);
    }

    const usage = obj.message.usage ?? {};
    const cache_creation = usage.cache_creation ?? {};

    const req = {
      input_tokens:            usage.input_tokens                            ?? 0,
      output_tokens:           usage.output_tokens                           ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens                 ?? 0,
      cache_write_5m:          cache_creation.ephemeral_5m_input_tokens      ?? 0,
      cache_write_1h:          cache_creation.ephemeral_1h_input_tokens
                               ?? usage.cache_creation_input_tokens          ?? 0,
    };

    const norm = normalizeModel(model);
    if (!totals[norm]) {
      totals[norm] = { messages: 0, requests: [], byTokenType: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite5m: 0, cacheWrite1h: 0 } };
    }
    const bucket = totals[norm];
    bucket.messages++;
    bucket.requests.push(req);
    bucket.byTokenType.input       += req.input_tokens;
    bucket.byTokenType.output      += req.output_tokens;
    bucket.byTokenType.cacheRead   += req.cache_read_input_tokens;
    bucket.byTokenType.cacheWrite5m += req.cache_write_5m;
    bucket.byTokenType.cacheWrite1h += req.cache_write_1h;
    bucket.byTokenType.cacheWrite   += req.cache_write_5m + req.cache_write_1h;
  }
  fileCount.n++;
}

export async function aggregate() {
  const projectsDir = getProjectsDir();
  const windowDays  = getWindowDays();
  const windowMs    = windowDays * 24 * 60 * 60 * 1000;
  const cutoff      = Date.now() - windowMs;
  const totals      = {};
  const fileCount   = { n: 0 };
  const seenReqIds  = new Set();

  let dirExists = true;
  try { await stat(projectsDir); }
  catch { dirExists = false; }

  if (dirExists) {
    const tasks = [];
    for await (const filePath of walkJsonl(projectsDir)) {
      tasks.push(parseJsonl(filePath, cutoff, totals, fileCount, seenReqIds));
    }
    await Promise.all(tasks);
  }

  return {
    windowStart:  new Date(Date.now() - windowMs).toISOString().slice(0, 10),
    windowEnd:    new Date().toISOString().slice(0, 10),
    windowDays,
    projectsDir,
    dirExists,
    scannedFiles: fileCount.n,
    totals,
  };
}
