import { mountTool } from "../app.js";

mountTool({
  id: "flatten",
  title: "Flatten form",
  desc: "Bake a filled PDF form's fields into permanent, non-editable page content. The document looks the same but can no longer be edited.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Flatten form",
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await ctx.loadPdf(ctx.files[0]);
    const form = doc.getForm();
    const n = form.getFields().length;
    if (!n) {
      ctx.out.innerHTML = `<p class="hint">This PDF has no form fields to flatten — nothing to do.</p>`;
      return;
    }
    form.flatten();
    const bytes = await doc.save();
    ctx.download(bytes, "flattened.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Flattened ${n} form field(s) into static content.</p>`;
  },
  help: "<p>Flattening makes the current field values part of the page. The visual appearance does not change, but the fields stop being interactive.</p>",
});
