#!/usr/bin/env node
import { spawn } from "node:child_process";

const HELP = `claude-code-cost-compare — scan ~/.claude/projects and compare API cost vs alternatives

Usage:
  npx claude-code-cost-compare [flags]

Flags:
  --port <n>            Port to listen on (default: 3000)
  --days <n>            Days of history to scan (default: 30)
  --projects-dir <path> Directory to scan (default: ~/.claude/projects)
  --no-open             Don't auto-open the browser
  -h, --help            Show this help
`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--no-open") out.noOpen = true;
    else if (a === "--port") out.port = argv[++i];
    else if (a === "--days") out.days = argv[++i];
    else if (a === "--projects-dir") out.projectsDir = argv[++i];
    else { console.error(`Unknown argument: ${a}\n`); console.error(HELP); process.exit(2); }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) { process.stdout.write(HELP); process.exit(0); }

if (args.port)         process.env.PORT              = args.port;
if (args.days)         process.env.CCC_DAYS          = args.days;
if (args.projectsDir)  process.env.CCC_PROJECTS_DIR  = args.projectsDir;
if (args.noOpen)       process.env.CCC_NO_OPEN       = "1";

function openBrowser(url) {
  if (process.env.CCC_NO_OPEN) return;
  const cmd = process.platform === "darwin" ? "open"
            : process.platform === "win32"  ? "cmd"
            : "xdg-open";
  const argv = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, argv, { stdio: "ignore", detached: true }).unref(); }
  catch { /* best-effort; user can open manually */ }
}

const port = Number(process.env.PORT ?? 3000);
setTimeout(() => openBrowser(`http://localhost:${port}`), 400);

await import("../src/server.mjs");
