import { mountTool } from "../app.js";

mountTool({
  id: "protect",
  title: "Protect PDF",
  desc: "Encrypt a PDF with a password so it can't be opened without one. AES-256, performed entirely in your browser.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Protect PDF",
  options: [
    { name: "password", label: "Password", type: "text", placeholder: "Required to open the PDF" },
    { name: "owner", label: "Owner password (optional)", type: "text", placeholder: "Defaults to the same password" },
    { name: "allowPrint", label: "Allow printing", type: "checkbox", value: true },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const pw = (o.password || "").trim();
    if (!pw) throw new Error("Enter a password.");
    const doc = await ctx.loadPdf(ctx.files[0]);
    doc.encrypt({
      userPassword: pw,
      ownerPassword: (o.owner || "").trim() || pw,
      permissions: { printing: !!o.allowPrint },
    });
    const bytes = await doc.save();
    ctx.download(bytes, "protected.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Encrypted with AES-256. Keep the password safe — it cannot be recovered.</p>`;
  },
  help: "<p>Encryption uses the browser's Web Crypto API. The password is never transmitted anywhere — there is no server.</p>",
  faq: [["Can a lost password be recovered?", "No. The file is encrypted on your device and never leaves it, so a forgotten password cannot be recovered by anyone."]],
});
