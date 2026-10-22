import { mountTool } from "../app.js";

mountTool({
  id: "extract-attachments",
  title: "Extract attachments",
  desc: "Pull out the files that are embedded inside a PDF.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Extract files",
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await ctx.loadPdf(ctx.files[0]);
    const atts = doc.getAttachments() || {};
    const list = Object.values(atts).filter((a) => a && a.data);
    if (!list.length) {
      ctx.out.innerHTML = `<p class="hint">This PDF has no embedded attachments.</p>`;
      return;
    }
    const entries = list.map((a, i) => ({ name: a.name || `attachment-${i + 1}`, data: a.data, mime: a.mimeType }));
    if (entries.length === 1) {
      ctx.download(new Blob([entries[0].data], { type: entries[0].mime || "application/octet-stream" }), entries[0].name, entries[0].mime || "application/octet-stream");
    } else {
      ctx.downloadZip(entries.map((e) => ({ name: e.name, data: e.data })), "attachments.zip");
    }
    ctx.out.innerHTML = `<p class="hint">✓ Extracted ${entries.length} file(s): ${entries.map((e) => e.name.replace(/[<>&]/g, "")).join(", ")}.</p>`;
  },
  help: "<p>Attachments are stored inside the PDF and are not visible when you read it. This tool lists what is there and hands each file back to you.</p>",
});
