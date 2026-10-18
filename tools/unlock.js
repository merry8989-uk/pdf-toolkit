import { mountTool } from "../app.js";

mountTool({
  id: "unlock",
  title: "Unlock PDF",
  desc: "Remove a password you already know, producing an unencrypted copy you can open freely. This does not crack or guess passwords.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Unlock PDF",
  options: [{ name: "password", label: "Current password", type: "text", placeholder: "The password that opens the file" }],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const pw = ctx.options.password || "";
    const bytes0 = await ctx.files[0].arrayBuffer();
    let doc;
    try {
      doc = await PDFDocument.load(bytes0, pw ? { password: pw } : {});
    } catch (e) {
      try {
        const probe = await PDFDocument.load(bytes0, { ignoreEncryption: true });
        if (probe.isEncrypted) throw new Error("encrypted");
        doc = probe;
      } catch (_) {
        throw new Error("Could not open the file with that password. Check it and try again.");
      }
    }
    const bytes = await doc.save();
    ctx.download(bytes, "unlocked.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Saved an unencrypted copy. Anyone can now open it without a password.</p>`;
  },
  help: "<p>You must know the password. If the file was not encrypted, it is simply re-saved unchanged.</p>",
});
