import { mountTool } from "../app.js";

async function readOutline(doc, PDFName) {
  const context = doc.context;
  const ref = doc.catalog.get(PDFName.of("Outlines"));
  if (!ref) return [];
  const out = context.lookup(ref);
  if (!out) return [];
  const pageRefs = doc.getPages().map((p) => p.ref);
  const resolve = (arr) => {
    if (!arr || typeof arr.get !== "function") return -1;
    const pr = arr.get(0);
    if (!pr) return -1;
    return pageRefs.findIndex((r) => r.tag === pr.tag && r.objectNumber === pr.objectNumber);
  };
  const items = [];
  let cur = out.get(PDFName.of("First")), guard = 0;
  while (cur && guard++ < 10000) {
    const it = context.lookup(cur);
    if (!it) break;
    const t = it.get(PDFName.of("Title"));
    const title = t && t.decodeText ? t.decodeText() : "Untitled";
    let idx = resolve(it.get(PDFName.of("Dest")));
    if (idx < 0) {
      const a = it.get(PDFName.of("A"));
      if (a) idx = resolve(context.lookup(a)?.get(PDFName.of("D")));
    }
    if (idx >= 0) items.push({ title, page: idx + 1 });
    cur = it.get(PDFName.of("Next"));
  }
  return items;
}

mountTool({
  id: "split-by-bookmarks",
  title: "Split by bookmarks",
  desc: "Create one PDF per bookmark in the document outline. Useful for splitting a book into chapters.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Split by bookmarks",
  async run(ctx) {
    const { PDFDocument, PDFName } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const marks = (await readOutline(src, PDFName)).sort((a, b) => a.page - b.page);
    if (!marks.length) throw new Error("This PDF has no bookmarks/outline to split on.");

    const entries = [];
    for (let i = 0; i < marks.length; i++) {
      ctx.progress(i / marks.length);
      const start = marks[i].page - 1;
      const end = i + 1 < marks.length ? marks[i + 1].page - 1 : total;
      if (end <= start) continue;
      const idxs = [];
      for (let p = start; p < end; p++) idxs.push(p);
      const d = await PDFDocument.create();
      const pgs = await d.copyPages(src, idxs);
      pgs.forEach((p) => d.addPage(p));
      const safe = marks[i].title.replace(/[^\w\s-]/g, "").trim().slice(0, 60).replace(/\s+/g, "-") || `section-${i + 1}`;
      entries.push({ name: `${String(i + 1).padStart(2, "0")}-${safe}.pdf`, data: await d.save() });
    }
    if (!entries.length) throw new Error("No usable bookmark sections were found.");
    ctx.downloadZip(entries, "bookmark-sections.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Created ${entries.length} section(s) in <b>bookmark-sections.zip</b>.</p>`;
  },
  help: "<p>Each section runs from its bookmark to the page before the next bookmark. Bookmarks are read from the PDF's own outline, so this only works on files that already have one.</p>",
});
