import { mountTool } from "../app.js";

mountTool({
  id: "booklet",
  title: "Booklet / impose",
  desc: "Rearrange pages so a printed double-sided stack folds into a booklet, with two pages per side.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Build booklet",
  options: [
    { name: "size", label: "Sheet size", type: "select", value: "a4", options: [["a4", "A4"], ["letter", "Letter"]] },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await ctx.loadPdf(ctx.files[0]);
    const idxs = src.getPageIndices();
    if (idxs.length < 2) throw new Error("A booklet needs at least two pages.");
    let n = idxs.length;
    while (n % 4 !== 0) n++;

    const out = await PDFDocument.create();
    const emb = await out.embedPdf(src, idxs);
    const dims = { a4: [841.89, 595.28], letter: [792, 612] };
    const [pw, ph] = dims[ctx.options.size] || dims.a4;
    const m = 10;
    const cellW = (pw - 2 * m) / 2, cellH = ph - 2 * m;

    const order = [];
    for (let k = 0; k < n / 4; k++) {
      order.push([n - 2 * k, 1 + 2 * k]);
      order.push([2 + 2 * k, n - 1 - 2 * k]);
    }

    order.forEach((pair, si) => {
      ctx.progress(si / order.length);
      const sheet = out.addPage([pw, ph]);
      pair.forEach((num, col) => {
        const ep = num >= 1 && num <= idxs.length ? emb[num - 1] : null;
        if (!ep) return;
        const s = Math.min(cellW / ep.width, cellH / ep.height);
        const w = ep.width * s, h = ep.height * s;
        const x = m + col * cellW + (cellW - w) / 2;
        const y = m + (cellH - h) / 2;
        sheet.drawPage(ep, { x, y, width: w, height: h });
      });
    });

    const bytes = await out.save();
    ctx.download(bytes, "booklet.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ ${n} pages imposed onto ${order.length} sheet side(s). Print double-sided, flip on the short edge, then fold.</p>`;
  },
  help: "<p>Pages are padded to a multiple of four, then paired in saddle-stitch order. Print the result double-sided (flip on the short edge) and fold the stack in half.</p>",
});
