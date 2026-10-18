import { mountTool } from "../app.js";

mountTool({
  id: "favicon",
  title: "Favicon generator",
  desc: "Turn one image into every favicon and app-icon size you need, plus the manifest and the HTML to paste in.",
  accept: "image/*",
  multiple: false,
  action: "Generate icons",
  options: [
    { name: "bg", label: "Background", type: "select", value: "transparent", options: [["transparent", "Transparent"], ["white", "White"], ["black", "Black"]] },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const sizes = [16, 32, 48, 64, 128, 180, 192, 512];
    const entries = [];
    for (const s of sizes) {
      ctx.progress(sizes.indexOf(s) / sizes.length);
      const c = ctx.canvasOf(s, s);
      const g = c.getContext("2d");
      const bg = ctx.options.bg;
      if (bg !== "transparent") { g.fillStyle = bg === "black" ? "#000" : "#fff"; g.fillRect(0, 0, s, s); }
      const r = Math.min(s / img.naturalWidth, s / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      g.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      const blob = await ctx.canvasBlob(c, "image/png");
      entries.push({ name: s === 180 ? "apple-touch-icon.png" : `favicon-${s}x${s}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const manifest = {
      name: "My site", short_name: "Site",
      icons: [
        { src: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: "#ffffff", background_color: "#ffffff", display: "standalone",
    };
    entries.push({ name: "site.webmanifest", data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
    const snippet = `<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="icon" href="/favicon-16x16.png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;
    entries.push({ name: "html-head-snippet.txt", data: new TextEncoder().encode(snippet) });
    ctx.downloadZip(entries, "favicons.zip");
    ctx.out.innerHTML = `<p class="hint">✓ Generated ${sizes.length} icon sizes plus a web manifest and the HTML snippet, in <b>favicons.zip</b>.</p>`;
  },
  help: "<p>Your image is centred and scaled to fit each square. Upload it to your site root, then paste the snippet from <code>html-head-snippet.txt</code> into your page's &lt;head&gt;.</p>",
});
