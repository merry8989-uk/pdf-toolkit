import { mountTool } from "../app.js";

mountTool({
  id: "pages-per-sheet",
  title: "Pages per sheet",
  desc: "Place 2 or 4 pages of a PDF onto each sheet — handy for printing handouts and saving paper.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Create sheets",
  options: [
    { name: "per", label: "Pages per sheet", type: "select", value: "2", options: [["2", "2 per sheet"], ["4", "4 per sheet"]] },
    { name: "orientation", label: "Sheet orientation", type: "select", value: "portrait", options: [["portrait", "Portrait"], ["landscape", "Landscape"]] },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const idxs = src.getPageIndices();
    if (!idxs.length) throw new Error("This PDF has no pages.");
    const out = await PDFDocument.create();
    const emb = await out.embedPdf(src, idxs);
    const per = parseInt(o.per, 10);
    const cols = per === 4 ? 2 : 1, rows = 2;
    const [pw, ph] = o.orientation === "landscape" ? [841.89, 595.28] : [595.28, 841.89];
    const m = 12;
    const cw = (pw - 2 * m) / cols, ch = (ph - 2 * m) / rows;
    for (let i = 0; i < emb.length; i += per) {
      const sheet = out.addPage([pw, ph]);
      for (let j = 0; j < per && i + j < emb.length; j++) {
        const ep = emb[i + j];
        const col = j % cols, row = Math.floor(j / cols);
        const s = Math.min(cw / ep.width, ch / ep.height);
        const w = ep.width * s, h = ep.height * s;
        const cellX = m + col * cw, cellY = ph - m - (row + 1) * ch;
        sheet.drawPage(ep, { x: cellX + (cw - w) / 2, y: cellY + (ch - h) / 2, width: w, height: h });
      }
    }
    const bytes = await out.save();
    ctx.download(bytes, "n-up.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ ${emb.length} page(s) placed onto ${Math.ceil(emb.length / per)} sheet(s).</p>`;
  },
  help: "<p>Each page is scaled to fit its cell without distortion, so nothing is stretched.</p>",
});
