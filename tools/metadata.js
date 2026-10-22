import { mountTool } from "../app.js";

mountTool({
  id: "metadata",
  title: "Edit metadata",
  desc: "Change the title, author, subject and keywords stored inside a PDF. Existing values are read from the file when you add it.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Save metadata",
  options: [
    { name: "title", label: "Title", type: "text" },
    { name: "author", label: "Author", type: "text" },
    { name: "subject", label: "Subject", type: "text" },
    { name: "keywords", label: "Keywords (comma separated)", type: "text" },
  ],
  async onFiles(ctx) {
    try {
      const { PDFDocument } = await ctx.loadPdfLib();
      const doc = await ctx.loadPdf(ctx.files[0]);
      const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      set("opt-title", doc.getTitle());
      set("opt-author", doc.getAuthor());
      set("opt-subject", doc.getSubject());
      set("opt-keywords", doc.getKeywords());
    } catch (e) { /* unreadable metadata is fine to ignore */ }
  },
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const doc = await ctx.loadPdf(ctx.files[0]);
    doc.setTitle(o.title || "");
    doc.setAuthor(o.author || "");
    doc.setSubject(o.subject || "");
    doc.setKeywords((o.keywords || "").split(",").map((s) => s.trim()).filter(Boolean));
    doc.setModificationDate(new Date());
    const bytes = await doc.save();
    ctx.download(bytes, "metadata.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Metadata updated.</p>`;
  },
  help: "<p>The <code>Producer</code> field is written by the library on save and is not editable here. Clearing a field removes that value.</p>",
});
