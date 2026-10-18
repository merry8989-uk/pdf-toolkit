import { mountTool } from "../app.js";

mountTool({
  id: "image-to-base64",
  title: "Image to Base64",
  desc: "Turn an image into a Base64 data URI you can paste into HTML or CSS.",
  accept: "image/*",
  multiple: false,
  action: "Encode image",
  options: [
    { name: "format", label: "Output format", type: "select", value: "png", options: [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
    { name: "wrap", label: "Include the CSS/HTML snippet", type: "checkbox", value: true },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const c = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0);
    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    const dataUri = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(blob);
    });
    const snippet = o.wrap
      ? `<!-- Image as a data URI (${c.width}×${c.height}) -->\n<img src="${dataUri}" alt="image" width="${c.width}" height="${c.height}">\n\n/* CSS */\nbackground-image: url("${dataUri}");`
      : dataUri;
    const url = URL.createObjectURL(new Blob([snippet], { type: "text/plain" }));
    ctx.out.innerHTML = `<textarea readonly style="width:100%;height:220px;margin-top:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:9px;padding:12px;font:12px/1.5 var(--mono)"></textarea>
      <div class="row" style="margin-top:10px"><a class="dl" href="${url}" download="image-base64.txt">Download .txt</a></div>
      <p class="hint">Data URI length: ${dataUri.length.toLocaleString()} characters.</p>`;
    ctx.out.querySelector("textarea").value = snippet;
  },
  help: "<p>A data URI embeds the image directly in your HTML or CSS, so there is no separate file to load. It is larger than a normal image file by about a third.</p>",
});
