import { mountTool } from "../app.js";

let src = null;

mountTool({
  id: "palette",
  title: "Colour palette",
  desc: "Extract the dominant colours from a photo — a ready-made palette for a design, a theme or a mood board.",
  accept: "image/*",
  multiple: false,
  action: "Extract palette",
  options: [
    { name: "count", label: "Number of colours", type: "number", value: 6, min: 2, max: 16 },
    { name: "format", label: "Export palette as", type: "select", value: "text", options: [["text", "Text list (HEX + RGB)"], ["css", "CSS variables"], ["none", "Just show them"]] },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.fitCanvas(ctx.canvasOf(img.naturalWidth, img.naturalHeight), 400);
    src.getContext("2d").drawImage(img, 0, 0, src.width, src.height);
    const n = Math.min(Math.max(2, ctx.options.count | 0), 16);

    const d = src.getContext("2d").getImageData(0, 0, src.width, src.height).data;
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      let b = buckets.get(key);
      if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, n)
      .map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) }));
    if (!top.length) throw new Error("Could not read any pixels from that image.");

    const hexes = top.map((c) => ctx.rgbToHex(c.r, c.g, c.b));
    let text = "";
    if (ctx.options.format === "text") text = hexes.map((h, i) => `${i + 1}. ${h}\t rgb(${top[i].r}, ${top[i].g}, ${top[i].b})`).join("\n");
    else if (ctx.options.format === "css") text = hexes.map((h, i) => `  --color-${i + 1}: ${h};`).join("\n");

    ctx.out.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        ${hexes.map((h) => `<div style="text-align:center">
          <div style="width:76px;height:76px;border-radius:11px;border:1px solid var(--line);background:${h}"></div>
          <div class="mono" style="font-size:11px;margin-top:5px;color:var(--text-dim)">${h}</div></div>`).join("")}
      </div>
      ${text ? `<pre style="white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:12px;font:12px/1.6 var(--mono);margin-top:14px">${text}</pre>` : ""}`;
  },
  help: "<p>Pixels are grouped into colour buckets by their most significant bits, then the most common buckets are averaged — a fast, dependency-free way to get a representative palette.</p>",
});
