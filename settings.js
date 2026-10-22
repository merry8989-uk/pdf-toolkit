import { siteChrome } from "./app.js";
import { LEVELS, CATEGORIES, getLogs, clearLogs, getSettings, setSettings, stats, toText, toJSON } from "./logger.js";

siteChrome();

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LEVEL_CLASS = { TRACE: "l-trace", DEBUG: "l-debug", INFO: "l-info", WARN: "l-warn", ERROR: "l-error", FATAL: "l-fatal" };
const fmtBytes = (n) => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const fmtTime = (ts) => {
  const d = new Date(ts);
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/* ---------------- appearance ---------------- */

const themeSel = $("#theme");
const currentTheme = () => localStorage.getItem("theme") || "system";
themeSel.value = currentTheme();
themeSel.addEventListener("change", () => {
  const v = themeSel.value;
  if (v === "system") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("theme");
  } else {
    document.documentElement.dataset.theme = v;
    localStorage.setItem("theme", v);
  }
  import("./logger.js").then((l) => l.audit("Theme changed", { theme: v }));
});

/* ---------------- log filters ---------------- */

LEVELS.forEach((l) => $("#f-level").insertAdjacentHTML("beforeend", `<option value="${l}">${l}</option>`));
Object.entries(CATEGORIES).forEach(([k, v]) => $("#f-cat").insertAdjacentHTML("beforeend", `<option value="${k}">${esc(v)}</option>`));

/* ---------------- what gets recorded ---------------- */

const OPT_SPEC = [
  { key: "enabled", label: "Record diagnostics", note: "Turn the whole log off." },
  { key: "activity", label: "Include usage (tool opens, resets)", note: "Leave off for a log of errors and timings only." },
  { key: "verbose", label: "Verbose (TRACE / DEBUG)", note: "More detail, more noise." },
  { key: "names", label: "Include file names", note: "Off by default — names can be sensitive. Type and size are always recorded instead." },
  { key: "retention", label: "Entries kept", type: "number", min: 50, max: 5000, step: 50 },
];

function renderOpts() {
  const s = getSettings();
  $("#logopts").innerHTML = OPT_SPEC.map((o) => {
    const on = s[o.key];
    if (o.type === "number") {
      return `<div class="field"><label for="o-${o.key}">${esc(o.label)}</label>
        <input id="o-${o.key}" type="number" min="${o.min}" max="${o.max}" step="${o.step}" value="${on}"></div>`;
    }
    return `<div class="field"><label><input type="checkbox" id="o-${o.key}" ${on ? "checked" : ""}> ${esc(o.label)}</label>
      <div class="hint" style="margin:2px 0 0">${esc(o.note)}</div></div>`;
  }).join("");

  OPT_SPEC.forEach((o) => {
    const el = $("#o-" + o.key);
    el.addEventListener("change", () => {
      const val = o.type === "number" ? Math.min(o.max, Math.max(o.min, Number(el.value) || o.min)) : el.checked;
      setSettings({ [o.key]: val });
      renderStats();
      renderLogs();
    });
  });
}

/* ---------------- stats ---------------- */

function renderStats() {
  const st = stats();
  const s = getSettings();
  const bits = LEVELS.filter((l) => st.by[l]).map((l) =>
    `<span class="badge ${LEVEL_CLASS[l]}">${l} ${st.by[l]}</span>`).join("");
  $("#logstats").innerHTML =
    `<div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">` +
      `<b>${st.total}</b> entr${st.total === 1 ? "y" : "ies"} · ${fmtBytes(st.bytes)} stored` +
      (bits ? ` · ${bits}` : "") +
      (s.enabled ? "" : ` · <span class="badge l-warn">recording is off</span>`) +
    `</div>`;
}

/* ---------------- the table ---------------- */

function visible() {
  const lvl = $("#f-level").value, cat = $("#f-cat").value;
  const q = $("#f-q").value.trim().toLowerCase();
  return getLogs().filter((e) =>
    (!lvl || e.level === lvl) &&
    (!cat || e.cat === cat) &&
    (!q || (e.msg + " " + (e.meta ? JSON.stringify(e.meta) : "") + " " + e.cat + " " + e.level).toLowerCase().includes(q))
  ).reverse();
}

function renderLogs() {
  const rows = visible();
  if (!rows.length) {
    $("#logtable").innerHTML = `<p class="hint" style="margin:10px 0">No entries match. Use a tool or two, then come back — the log fills up on its own.</p>`;
    return;
  }
  const shown = rows.slice(0, 400);
  $("#logtable").innerHTML = shown.map((e) => `
    <div class="logrow ${LEVEL_CLASS[e.level] || ""}">
      <span class="lt">${fmtTime(e.ts)}</span>
      <span class="ll">${e.level}</span>
      <span class="lc">${esc(CATEGORIES[e.cat] || e.cat)}</span>
      <span class="lm">${esc(e.msg)}${e.meta ? `<span class="lmeta">${esc(JSON.stringify(e.meta))}</span>` : ""}</span>
    </div>`).join("") +
    (rows.length > shown.length ? `<p class="hint" style="margin:10px 0">Showing the newest ${shown.length} of ${rows.length} — download for the full set.</p>` : "");
}

/* ---------------- actions ---------------- */

function saveBlob(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

$("#refresh").addEventListener("click", () => { renderStats(); renderLogs(); });

$("#copy").addEventListener("click", async () => {
  const text = toText(visible());
  try {
    await navigator.clipboard.writeText(text);
    $("#copy").textContent = "Copied ✓";
  } catch (e) {
    saveBlob(text, "pdf-toolkit-log.txt", "text/plain");
    $("#copy").textContent = "Clipboard blocked — downloaded";
  }
  setTimeout(() => { $("#copy").textContent = "Copy all"; }, 2200);
});

$("#dl-json").addEventListener("click", () => saveBlob(toJSON(visible()), "pdf-toolkit-log.json", "application/json"));
$("#dl-txt").addEventListener("click", () => saveBlob(toText(visible()), "pdf-toolkit-log.txt", "text/plain"));

$("#clear").addEventListener("click", () => {
  if (!confirm("Clear the whole diagnostics log? This cannot be undone.")) return;
  clearLogs();
  renderStats(); renderLogs();
});

["f-level", "f-cat"].forEach((id) => $("#" + id).addEventListener("change", renderLogs));
$("#f-q").addEventListener("input", renderLogs);

/* ---------------- stored data ---------------- */

function storedInfo() {
  const keys = ["pdftk:recent", "pdftk:opts:", "pdftk:logs", "pdftk:logsettings", "theme"];
  let bytes = 0, count = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (keys.some((p) => k === p || k.startsWith(p))) { bytes += (localStorage.getItem(k) || "").length; count++; }
    }
  } catch (e) { /* ignore */ }
  $("#stored-info").textContent = count
    ? `${count} key${count === 1 ? "" : "s"}, about ${fmtBytes(bytes)} in total.`
    : "Nothing stored yet.";
}

const purge = (match) => {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (match(k)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
    return doomed.length;
  } catch (e) { return 0; }
};

$("#clr-recent").addEventListener("click", () => { purge((k) => k === "pdftk:recent"); storedInfo(); });
$("#clr-opts").addEventListener("click", () => { purge((k) => k.startsWith("pdftk:opts:")); storedInfo(); });
$("#clr-all").addEventListener("click", () => {
  if (!confirm("Clear everything this site has stored in your browser? Your files are not affected.")) return;
  purge(() => true);
  renderStats(); renderLogs(); renderOpts(); storedInfo();
});

/* ---------------- go ---------------- */

renderOpts();
renderStats();
renderLogs();
storedInfo();
