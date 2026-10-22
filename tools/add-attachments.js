import { mountTool } from "../app.js";

mountTool({
  id: "add-attachments",
  title: "Add attachments",
  desc: "Embed extra files — a spreadsheet, a source image, a licence — inside the PDF itself.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Embed files",
  onInit(ctx) {
    ctx.extra.innerHTML = `<div class="field" style="margin-top:12px"><label for="atts">Files to embed inside the PDF</label>
      <input type="file" id="atts" multiple></div><ul class="filelist" id="attlist"></ul>`;
    const input = ctx.extra.querySelector("#atts");
    input.addEventListener("change", () => {
      const ul = ctx.extra.querySelector("#attlist");
      ul.innerHTML = [...input.files].map((f) => `<li><span class="name">${f.name.replace(/[<>&]/g, "")}</span><span class="sz">${ctx.fmtSize(f.size)}</span></li>`).join("");
    });
  },
  async run(ctx) {
    const input = ctx.extra.querySelector("#atts");
    const list = [...(input?.files || [])];
    if (!list.length) throw new Error("Choose at least one file to embed.");
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await ctx.loadPdf(ctx.files[0]);
    let added = 0;
    for (const f of list) {
      const data = new Uint8Array(await f.arrayBuffer());
      await doc.attach(data, f.name, { mimeType: f.type || "application/octet-stream", description: f.name });
      added++;
    }
    const bytes = await doc.save();
    ctx.download(bytes, "with-attachments.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Embedded ${added} file(s). Readers can open them from the attachments pane.</p>`;
  },
  help: "<p>Attachments travel inside the PDF, so a single file carries everything. Use <b>Extract attachments</b> to pull them back out later.</p>",
});
