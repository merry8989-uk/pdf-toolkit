import { mountTool } from "../app.js";

mountTool({
  id: "extract-text",
  title: "Extract text",
  desc: "Read the selectable text out of a PDF, page by page, and copy or download it as a .txt file.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Extract text",
  async run(ctx) {
    const doc = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      ctx.progress(i / doc.numPages);
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const line = tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
      text += `\n\n----- Page ${i} -----\n\n${line}`;
    }
    text = text.trim();
    const blob = new Blob([text || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    ctx.out.innerHTML = `<textarea readonly style="width:100%;height:280px;margin-top:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px/1.5 var(--mono)"></textarea>
      <div class="row" style="margin-top:10px"><a class="dl" href="${url}" download="extracted.txt">Download .txt</a></div>`;
    ctx.out.querySelector("textarea").value =
      text || "(No selectable text found — this PDF is likely a scan with no text layer.)";
  },
  help: "<p>This reads the text layer embedded in the PDF. If the document is a scan (just an image), there is no text to read.</p>",
});
