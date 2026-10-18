import { mountTool } from "../app.js";

mountTool({
  id: "compare",
  title: "Compare PDFs",
  desc: "Spot the differences between two versions of a PDF. Add both files and get a page-by-page difference report.",
  accept: ".pdf,application/pdf",
  multiple: true,
  action: "Compare",
  options: [
    { name: "threshold", label: "Sensitivity", type: "select", value: "1.5", options: [["0.5", "High (tiny changes)"], ["1.5", "Balanced"], ["4", "Low (major changes only)"]] },
  ],
  async run(ctx) {
    if (ctx.files.length !== 2) throw new Error("Add exactly two PDFs to compare.");
    const [a, b] = ctx.files;
    const da = await ctx.openDocument(await a.arrayBuffer());
    const db = await ctx.openDocument(await b.arrayBuffer());
    const n = Math.max(da.numPages, db.numPages);
    const thr = parseFloat(ctx.options.threshold);
    const rows = [];
    let changed = 0;

    for (let i = 1; i <= n; i++) {
      ctx.progress(i / n);
      const pa = i <= da.numPages ? await da.getPage(i) : null;
      const pb = i <= db.numPages ? await db.getPage(i) : null;
      if (!pa || !pb) {
        rows.push({ page: i, pct: 100, note: pa ? "Only in first file" : "Only in second file" });
        changed++;
        continue;
      }
      const vp = pa.getViewport({ scale: 1 });
      const scale = Math.min(1.2, 460 / vp.width);
      const v = pa.getViewport({ scale });
      const ca = ctx.canvasOf(v.width, v.height);
      const ga = ca.getContext("2d");
      ga.fillStyle = "#fff"; ga.fillRect(0, 0, ca.width, ca.height);
      await pa.render({ canvasContext: ga, viewport: v }).promise;
      const cb = ctx.canvasOf(v.width, v.height);
      const gb = cb.getContext("2d");
      gb.fillStyle = "#fff"; gb.fillRect(0, 0, cb.width, cb.height);
      await pb.render({ canvasContext: gb, viewport: pb.getViewport({ scale }) }).promise;

      const A = ga.getImageData(0, 0, ca.width, ca.height).data;
      const B = gb.getImageData(0, 0, cb.width, cb.height).data;
      let diff = 0;
      for (let p = 0; p < A.length; p += 4) {
        if (Math.abs(A[p] - B[p]) > 24 || Math.abs(A[p + 1] - B[p + 1]) > 24 || Math.abs(A[p + 2] - B[p + 2]) > 24) diff++;
      }
      const pct = (diff / (A.length / 4)) * 100;
      const isChanged = pct > thr;
      if (isChanged) changed++;
      rows.push({ page: i, pct, note: isChanged ? "Different" : "Matches" });
    }

    ctx.out.innerHTML = `
      <p class="hint" style="margin-top:12px">Compared <b>${a.name}</b> (${da.numPages} pages) with <b>${b.name}</b> (${db.numPages} pages). <b>${changed}</b> page(s) differ.</p>
      <div class="table-wrap" style="margin-top:12px"><table>
        <thead><tr><th>Page</th><th>Difference</th><th>Result</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${r.page}</td><td>${r.pct.toFixed(1)}%</td><td>${r.note}</td></tr>`).join("")}</tbody>
      </table></div>`;
  },
  help: "<p>Each page is rendered to a small image in both files and the pixels are compared. It is a visual comparison, so a page that differs only in hidden text structure still counts as a match.</p>",
});
