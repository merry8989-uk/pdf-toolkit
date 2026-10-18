import { mountTool } from "../app.js";

let marked = new Set();

mountTool({
  id: "remove-pages",
  title: "Remove pages",
  desc: "Delete specific pages from a PDF and keep everything else as one file. Click the thumbnails to mark pages, or type page numbers.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Remove pages",
  options: [{ name: "pages", label: "Pages to remove", type: "text", placeholder: "2, 4, 7-9" }],
  async onFiles(ctx) {
    marked = new Set();
    ctx.extra.innerHTML = "";
    const tip = document.createElement("p");
    tip.className = "hint";
    tip.textContent = "Click a page to mark it for removal (red = will be removed).";
    ctx.extra.appendChild(tip);
    const grid = document.createElement("div");
    ctx.extra.appendChild(grid);
    const input = document.getElementById("opt-pages");
    await ctx.thumbnails(ctx.files[0], grid, {
      onClick: (n, el) => {
        if (marked.has(n)) { marked.delete(n); el.classList.remove("del"); }
        else { marked.add(n); el.classList.add("del"); }
        input.value = [...marked].sort((a, b) => a - b).join(", ");
      },
    });
  },
  onReset() { marked = new Set(); },
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    let del = ctx.parseRanges(ctx.options.pages, total);
    if (!del.length && marked.size) del = [...marked].sort((a, b) => a - b);
    if (!del.length) throw new Error("Mark some pages, or type the page numbers to remove.");
    const keep = [];
    for (let i = 1; i <= total; i++) if (!del.includes(i)) keep.push(i - 1);
    if (!keep.length) throw new Error("That would remove every page — nothing would be left to save.");
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "pages-removed.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Removed ${del.length} page(s). <b>pages-removed.pdf</b> now has ${keep.length} page(s).</p>`;
  },
  help: "<p>Pages are genuinely removed from the output, not hidden. Page numbers refer to the original document.</p>",
});
