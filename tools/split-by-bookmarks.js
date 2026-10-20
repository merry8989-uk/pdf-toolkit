import { mountTool } from "../app.js";

async function readOutline(doc, PDFName) {
  const context = doc.context;
  const ref = doc.catalog.get(PDFName.of("Outlines"));
  if (!ref) return [];
  const out = context.lookup(ref);
  if (!out) return [];
  const pageRefs = doc.getPages().map((p) => p.ref);

  const pageIndex = (target) => {
    if (!target) return -1;
    return pageRefs.findIndex((r) => r.tag === target.tag && r.objectNumber === target.objectNumber);
  };
  const resolveArrayDest = (arr) => {
    if (!arr || typeof arr.get !== "function") return -1;
    return pageIndex(arr.get(0));
  };

  // A destination is usually an array [pageRef, /Fit], but very often it is a
  // NAMED destination — a string/name looked up in the catalog's /Dests
  // dictionary or in the /Names -> /Dests name tree. Missing that made this
  // tool report "no bookmarks" on plenty of real-world files.
  const namedCache = new Map();
  const lookupNamed = (key) => {
    if (namedCache.has(key)) return namedCache.get(key);
    let dest = null;
    const destsRef = doc.catalog.get(PDFName.of("Dests"));
    if (destsRef) {
      const d = context.lookup(destsRef);
      if (d && typeof d.get === "function") {
        const v = d.get(PDFName.of(key));
        if (v) dest = context.lookup(v);
      }
    }
    if (!dest) {
      const namesRef = doc.catalog.get(PDFName.of("Names"));
      const names = namesRef && context.lookup(namesRef);
      const dests = names && typeof names.get === "function" ? context.lookup(names.get(PDFName.of("Dests"))) : null;
      const arr = dests && typeof dests.get === "function" ? context.lookup(dests.get(PDFName.of("Names"))) : null;
      if (arr && typeof arr.size === "function") {
        for (let i = 0; i + 1 < arr.size(); i += 2) {
          const k = arr.get(i);
          const kk = k && k.decodeText ? k.decodeText() : (k && k.asString ? k.asString() : null);
          if (kk === key) { dest = context.lookup(arr.get(i + 1)); break; }
        }
      }
    }
    namedCache.set(key, dest);
    return dest;
  };

  const destToPage = (dest) => {
    if (!dest) return -1;
    const direct = resolveArrayDest(dest);
    if (direct >= 0) return direct;
    let key = null;
    if (dest.decodeText) key = dest.decodeText();
    else if (dest.asString) key = dest.asString();
    if (!key) return -1;
    return resolveArrayDest(lookupNamed(key));
  };

  const items = [];
  const seen = new Set();
  const walk = (first, depth) => {
    let cur = first, guard = 0;
    while (cur && guard++ < 5000) {
      const it = context.lookup(cur);
      if (!it) break;
      const t = it.get(PDFName.of("Title"));
      const title = t && t.decodeText ? t.decodeText() : "Untitled";
      let idx = destToPage(it.get(PDFName.of("Dest")));
      if (idx < 0) {
        const a = it.get(PDFName.of("A"));
        const act = a && context.lookup(a);
        const d = act && typeof act.get === "function" ? act.get(PDFName.of("D")) : null;
        idx = destToPage(d);
      }
      const id = cur.tag + ":" + cur.objectNumber;
      if (idx >= 0 && !seen.has(id)) {
        seen.add(id);
        items.push({ title, page: idx + 1, depth: depth || 0 });
      }
      const child = it.get(PDFName.of("First"));
      if (child && (depth || 0) < 2) walk(child, (depth || 0) + 1);
      cur = it.get(PDFName.of("Next"));
    }
  };
  walk(out.get(PDFName.of("First")), 0);
  return items;
}

mountTool({
  id: "split-by-bookmarks",
  title: "Split by bookmarks",
  desc: "Create one PDF per bookmark in the document outline. Useful for splitting a book into chapters. Handles both direct and named destinations, and nested outlines.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Split by bookmarks",
  options: [
    { name: "nested", label: "Include sub-bookmarks", type: "checkbox", value: true },
  ],
  async run(ctx) {
    const { PDFDocument, PDFName } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    let marks = await readOutline(src, PDFName);
    if (!ctx.options.nested) marks = marks.filter((m) => !m.depth);
    marks.sort((a, b) => a.page - b.page || a.depth - b.depth);
    if (!marks.length) throw new Error("This PDF has no bookmarks/outline to split on.");

    // one section per distinct starting page
    const unique = [];
    for (const m of marks) if (!unique.length || unique[unique.length - 1].page !== m.page) unique.push(m);

    const entries = [];
    for (let i = 0; i < unique.length; i++) {
      ctx.progress(i / unique.length);
      const start = unique[i].page - 1;
      const end = i + 1 < unique.length ? unique[i + 1].page - 1 : total;
      if (end <= start) continue;
      const idxs = [];
      for (let p = start; p < end; p++) idxs.push(p);
      const d = await PDFDocument.create();
      const pgs = await d.copyPages(src, idxs);
      pgs.forEach((p) => d.addPage(p));
      const safe = unique[i].title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().slice(0, 60).replace(/\s+/g, "-") || `section-${i + 1}`;
      entries.push({ name: `${String(i + 1).padStart(2, "0")}-${safe}.pdf`, data: await d.save() });
    }
    if (!entries.length) throw new Error("No usable bookmark sections were found.");
    ctx.downloadZip(entries, "bookmark-sections.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Found ${marks.length} bookmark(s); created ${entries.length} section(s) in <b>bookmark-sections.zip</b>.</p>`;
  },
  help: "<p>Each section runs from its bookmark to the page before the next bookmark. Both direct destinations and named destinations are resolved, and nested bookmarks can be included or ignored. This only works on files that already have an outline.</p>",
});
