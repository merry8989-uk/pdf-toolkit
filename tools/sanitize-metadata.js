import { mountTool } from "../app.js";

mountTool({
  id: "sanitize-metadata",
  title: "Remove metadata",
  desc: "Strip the title, author, subject, keywords, creator and producer that are hidden inside a PDF.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Remove metadata",
  options: [{ name: "dates", label: "Also reset the created/modified dates", type: "checkbox", value: true }],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const had = [doc.getTitle(), doc.getAuthor(), doc.getSubject(), doc.getKeywords()].filter(Boolean).length;
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setCreator("");
    doc.setProducer("");
    if (ctx.options.dates) {
      const epoch = new Date(0);
      doc.setCreationDate(epoch);
      doc.setModificationDate(epoch);
    }
    const bytes = await doc.save();
    ctx.download(bytes, "clean.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Cleared ${had} populated metadata field(s). Saved as <b>clean.pdf</b>.</p>`;
  },
  help: "<p>Metadata is the identifying information stored alongside the content — not the content itself. Note that some PDF readers add a Producer field back when they next save the file.</p>",
});
