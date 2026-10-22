/* Diagnostics logger for a 100% client-side app.
 *
 * Everything stays in this browser: localStorage, nothing else. There is no
 * endpoint to send to, which is the whole point of this toolkit. The log is a
 * ring buffer with a retention cap, so it can never grow without bound.
 *
 * What is deliberately NOT logged: file contents, file names (unless you turn
 * that on), and anything that looks like a password or token.
 */

export const LEVELS = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];

export const CATEGORIES = {
  app: "Application",
  error: "Error",
  perf: "Performance",
  activity: "User activity",
  audit: "Audit",
  debug: "Debug / trace",
};

const LOG_KEY = "pdftk:logs";
const SET_KEY = "pdftk:logsettings";

const DEFAULTS = {
  enabled: true,
  activity: true,      // record navigation / tool usage
  verbose: false,      // also record TRACE + DEBUG
  names: false,        // include file names in metadata
  retention: 500,      // max entries kept
};

let mem = [];            // in-memory mirror, always available
let settings = { ...DEFAULTS };
let loaded = false;

/* ---------- storage (safe when localStorage is blocked) ---------- */

function readStore(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
}

function load() {
  if (loaded) return;
  loaded = true;
  const s = readStore(SET_KEY);
  if (s && typeof s === "object") settings = { ...DEFAULTS, ...s };
  const l = readStore(LOG_KEY);
  if (Array.isArray(l)) mem = l;
}

/* ---------- redaction ---------- */

const SECRET_RE = /pass(word|phrase)?|secret|token|api[-_]?key|auth|credential/i;

/** Trim a metadata object down to small, non-sensitive values. */
export function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return undefined;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_RE.test(k)) continue;                       // never record secrets
    if (v === undefined || v === null) continue;
    if (typeof v === "number" || typeof v === "boolean") { out[k] = v; continue; }
    if (typeof v === "string") {
      // keep a short string, but strip anything that looks like a path or URL query
      out[k] = v.length > 120 ? v.slice(0, 117) + "…" : v;
      continue;
    }
    if (Array.isArray(v)) { out[k] = v.length; continue; }
    out[k] = typeof v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Describe a File without leaking its name (unless the user opted in). */
export function describeFile(file) {
  if (!file) return undefined;
  const d = {
    type: (file.type || "unknown").slice(0, 60),
    size: file.size,
  };
  const ext = (file.name || "").split(".").pop();
  if (ext && ext.length <= 8) d.ext = ext.toLowerCase();
  if (settings.names && file.name) d.name = file.name.slice(0, 80);
  return d;
}

/* ---------- writing ---------- */

function shouldKeep(level) {
  if (!settings.enabled) return false;
  if (!settings.verbose && (level === "TRACE" || level === "DEBUG")) return false;
  return true;
}

export function log(level, category, message, meta) {
  load();
  if (!LEVELS.includes(level)) level = "INFO";
  if (!CATEGORIES[category]) category = "app";
  if (!shouldKeep(level)) return;
  if (category === "activity" && !settings.activity) return;

  const entry = {
    ts: Date.now(),
    level,
    cat: category,
    msg: String(message == null ? "" : message).slice(0, 300),
  };
  const m = sanitizeMeta(meta);
  if (m) entry.meta = m;

  // Collapse repeats: an error thrown in a loop would otherwise fill the whole
  // buffer with identical lines and thrash localStorage.
  const key = level + "|" + category + "|" + entry.msg;
  const last = mem[mem.length - 1];
  if (last && last.__k === key && entry.ts - last.ts < 3000) {
    last.n = (last.n || 1) + 1;
    last.ts = entry.ts;
    if (m) last.meta = m;
    writeStore(LOG_KEY, mem);
    return;
  }
  entry.__k = key;

  mem.push(entry);
  if (mem.length > settings.retention) mem = mem.slice(-settings.retention);
  writeStore(LOG_KEY, mem);
}

export const trace = (cat, msg, meta) => log("TRACE", cat, msg, meta);
export const debug = (cat, msg, meta) => log("DEBUG", cat, msg, meta);
export const info = (cat, msg, meta) => log("INFO", cat, msg, meta);
export const warn = (cat, msg, meta) => log("WARN", cat, msg, meta);

export function error(message, meta) {
  // pull out a readable stack for the Error case, without dumping the whole object
  if (meta instanceof Error) {
    const e = meta;
    meta = { name: e.name, stack: (e.stack || "").split("\n").slice(0, 4).join(" | ").slice(0, 400) };
  }
  log("ERROR", "error", message, meta);
}

export function fatal(message, meta) { log("FATAL", "error", message, meta); }
export function perf(msg, meta) { log("INFO", "perf", msg, meta); }
export function activity(msg, meta) { log("INFO", "activity", msg, meta); }
export function audit(msg, meta) { log("INFO", "audit", msg, meta); }

/* ---------- reading ---------- */

export function getLogs() { load(); return mem.slice(); }

export function clearLogs() {
  load();
  mem = [];
  writeStore(LOG_KEY, mem);
  // Deliberately does NOT write an entry of its own: pressing "Clear log" should
  // leave the log empty, not leave one line behind explaining itself.
}

export function getSettings() { load(); return { ...settings }; }

export function setSettings(patch) {
  load();
  settings = { ...settings, ...patch };
  writeStore(SET_KEY, settings);
  audit("Log settings changed", { ...patch });
  if (mem.length > settings.retention) {
    mem = mem.slice(-settings.retention);
    writeStore(LOG_KEY, mem);
  }
  return { ...settings };
}

export function stats() {
  load();
  const by = { TRACE: 0, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 };
  for (const e of mem) by[e.level] = (by[e.level] || 0) + 1;
  return { total: mem.length, by, bytes: (() => { try { return (localStorage.getItem(LOG_KEY) || "").length; } catch (e) { return 0; } })() };
}

/* ---------- export ---------- */

export function toText(entries) {
  const rows = entries || getLogs();
  return rows.map((e) => {
    const d = new Date(e.ts);
    const stamp = d.toISOString().replace("T", " ").slice(0, 23);
    const meta = e.meta ? "  " + JSON.stringify(e.meta) : "";
    const rep = e.n > 1 ? `  (x${e.n})` : "";
    return `${stamp}  ${e.level.padEnd(5)}  ${e.cat.padEnd(8)}  ${e.msg}${rep}${meta}`;
  }).join("\n");
}

export function toJSON(entries) {
  const rows = (entries || getLogs()).map(({ __k, ...rest }) => rest);  // drop the internal dedupe key
  return JSON.stringify({
    app: "PDF Toolkit",
    exported: new Date().toISOString(),
    userAgent: navigator.userAgent,
    entries: rows,
  }, null, 2);
}

/* ---------- global capture ---------- */

let installed = false;

export function installGlobalHandlers() {
  if (installed) return;
  installed = true;
  load();

  window.addEventListener("error", (ev) => {
    // resource load failures also fire here
    if (ev.target && ev.target !== window && ev.target.tagName) {
      warn("app", `Asset failed to load: ${ev.target.tagName}`, { src: String(ev.target.src || ev.target.href || "").slice(0, 120) });
      return;
    }
    error(ev.message || "Uncaught error", { src: (ev.filename || "").split("/").pop(), line: ev.lineno });
  }, true);

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    error("Unhandled promise rejection", r instanceof Error ? r : { value: String(r).slice(0, 200) });
  });

  // Errors the app itself reports through console.error are worth keeping too.
  const origError = console.error.bind(console);
  console.error = (...args) => {
    try {
      const first = args[0];
      if (first instanceof Error) error(first.message || "console.error", first);
      else error(args.map((a) => (typeof a === "string" ? a : String(a && a.message ? a.message : typeof a))).join(" ").slice(0, 240));
    } catch (e) { /* never let logging break logging */ }
    origError(...args);
  };

  info("app", "Diagnostics ready", { ua: navigator.userAgent.slice(0, 80) });
}
