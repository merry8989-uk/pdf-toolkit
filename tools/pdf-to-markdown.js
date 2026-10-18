import { mountTool } from "../app.js";

mountTool({
  id: "pdf-to-markdown",
  title: "PDF to Markdown",
  desc: "Convert a PDF into Markdown, inferring headings, bullet lists and paragraphs from the text layout.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Convert to Markdown",
  async run(ctx) {
    const doc = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    let md = "";
    for (let i = 1; i <= doc.numPages; i++) {
      ctx.progress(i / doc.numPages);
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const lines = [];
      let cur = null;
      for (const it of tc.items) {
        if (!it.str) continue;
        const y = Math.round(it.transform[5]);
        const h = Math.abs(it.transform[3]) || it.height || 10;
        if (!cur || Math.abs(cur.y - y) > h * 0.6) { cur = { y, h, parts: [] }; lines.push(cur); }
        cur.parts.push({ x: it.transform[4], str: it.str });
        cur.h = Math.max(cur.h, h);
      }
      lines.sort((a, b) => b.y - a.y);
      const hs = lines.map((l) => l.h).sort((a, b) => a - b);
      const median = hs[Math.floor(hs.length / 2)] || 10;
      md += `\n\n<!-- page ${i} -->\n\n`;
      for (const l of lines) {
        const text = l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join("").replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (l.h > median * 1.45) md += `## ${text}\n\n`;
        else if (l.h > median * 1.15) md += `### ${text}\n\n`;
        else if (/^[•·▪‣]\s*/.test(text) || /^[-*]\s+/.test(text)) md += `- ${text.replace(/^[•·▪‣]\s*|^[-*]\s+/, "")}\n`;
        else md += `${text}\n\n`;
      }
    }
    md = md.trim();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    ctx.out.innerHTML = `<textarea readonly style="width:100%;height:280px;margin-top:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:13px/1.5 var(--mono)"></textarea>
      <div class="row" style="margin-top:10px"><a class="dl" href="${url}" download="document.md">Download .md</a></div>`;
    ctx.out.querySelector("textarea").value = md || "(No text layer found in this PDF.)";
  },
  help: "<p>Headings are inferred from relative font size, and bullet characters become Markdown list items. It is a best-effort conversion from layout, so complex tables and multi-column pages may need tidying.</p>",
});
