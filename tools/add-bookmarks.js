import { mountTool } from "../app.js";

mountTool({
  id: "add-bookmarks",
  title: "Add bookmarks",
  desc: "Create a PDF outline so readers can jump between sections from their sidebar.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Add bookmarks",
  onInit(ctx) {
    ctx.extra.innerHTML = `<div class="field"><label for="bm">Bookmarks — one per line, as “Title, page”</label>
      <textarea id="bm" placeholder="Introduction, 1&#10;Chapter 1, 3&#10;Chapter 2, 12" style="width:100%;height:150px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px/1.5 var(--mono)"></textarea></div>`;
  },
  async run(ctx) {
    const raw = document.getElementById("bm").value;
    const parsed = raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.*?)[,\t]\s*(\d+)$/);
      return m ? { title: m[1].trim(), page: parseInt(m[2], 10) } : null;
    }).filter(Boolean);
    if (!parsed.length) throw new Error('Add at least one line like "Introduction, 1".');

    const { PDFDocument, PDFName, PDFString, PDFNumber } = await ctx.loadPdfLib();
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = doc.getPageCount();
    const entries = parsed.filter((e) => e.page >= 1 && e.page <= total).sort((a, b) => a.page - b.page);
    if (!entries.length) throw new Error(`Every page number is outside the document (1–${total}).`);

    const context = doc.context;
    const outlineRef = context.nextRef();
    const itemRefs = entries.map(() => context.nextRef());
    entries.forEach((e, i) => {
      const page = doc.getPage(e.page - 1);
      const dict = {
        Title: PDFString.of(e.title),
        Parent: outlineRef,
        Dest: context.obj([page.ref, PDFName.of("Fit")]),
      };
      if (i > 0) dict.Prev = itemRefs[i - 1];
      if (i < itemRefs.length - 1) dict.Next = itemRefs[i + 1];
      context.assign(itemRefs[i], context.obj(dict));
    });
    context.assign(outlineRef, context.obj({
      Type: PDFName.of("Outlines"),
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: PDFNumber.of(itemRefs.length),
    }));
    doc.catalog.set(PDFName.of("Outlines"), outlineRef);

    const bytes = await doc.save();
    ctx.download(bytes, "bookmarked.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Added ${entries.length} bookmark(s). Open the file in a reader and look for the sidebar outline.</p>`;
  },
  help: "<p>Each line becomes one bookmark pointing at the page you name. Entries are sorted by page number so the sidebar reads top-to-bottom.</p>",
});
