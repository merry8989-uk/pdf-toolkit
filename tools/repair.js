import { mountTool } from "../app.js";

mountTool({
  id: "repair",
  title: "Repair PDF",
  desc: "Best-effort rebuild of a damaged or corrupt PDF. The file is re-parsed and written out with a clean structure.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Repair PDF",
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const input = await ctx.files[0].arrayBuffer();
    let doc;
    try {
      doc = await PDFDocument.load(input, { ignoreEncryption: true, throwOnInvalidObject: false });
    } catch (e) {
      throw new Error("This file could not be parsed even in repair mode. It may be truncated or not a PDF.");
    }
    const pages = doc.getPageCount();
    const bytes = await doc.save();
    ctx.download(bytes, "repaired.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Rebuilt the document structure and recovered ${pages} page(s). Saved as <b>repaired.pdf</b>.</p>`;
  },
  help: "<p>Repair works by re-reading the file's cross-reference table and rewriting the whole document. It fixes many broken xref tables, bad offsets and minor corruption — but it cannot recover content that is genuinely missing from the file.</p>",
});
