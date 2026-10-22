import { mountTool } from "../app.js";

let picked = new Set();

mountTool({
  id: "extract-pages",
  title: "Extract pages",
  desc: "Save just the pages you select into a new PDF. Click thumbnails to pick pages, or type page numbers.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Extract pages",
  options: [{ name: "pages", label: "Pages to keep", type: "text", placeholder: "1, 4-6" }],
  async onFiles(ctx) {
    picked = new Set();
    ctx.extra.innerHTML = "";
    const tip = document.createElement("p");
    tip.className = "hint";
    tip.textContent = "Click the pages you want to keep (highlighted = kept).";
    ctx.extra.appendChild(tip);
    const grid = document.createElement("div");
    ctx.extra.appendChild(grid);
    const input = document.getElementById("opt-pages");
    await ctx.thumbnails(ctx.files[0], grid, {
      onClick: (n, el) => {
        if (picked.has(n)) { picked.delete(n); el.classList.remove("sel"); }
        else { picked.add(n); el.classList.add("sel"); }
        input.value = [...picked].sort((a, b) => a - b).join(", ");
      },
    });
  },
  onReset() { picked = new Set(); },
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await ctx.loadPdf(ctx.files[0]);
    const total = src.getPageCount();
    let sel = ctx.parseRanges(ctx.options.pages, total);
    if (!sel.length && picked.size) sel = [...picked].sort((a, b) => a - b);
    if (!sel.length) throw new Error("Pick at least one page to keep.");
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, sel.map((n) => n - 1));
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "extracted.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Saved ${sel.length} page(s) into <b>extracted.pdf</b>.</p>`;
  },
  help: "<p>Only the selected pages end up in the output, in their original order. The original file is not modified.</p>",
});
