import { mountTool } from "../app.js";

mountTool({
  id: "resize",
  title: "Resize pages",
  desc: "Scale every page to a standard paper size, keeping the content proportional.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Resize pages",
  options: [
    { name: "size", label: "Target size", type: "select", value: "a4", options: [["a4", "A4"], ["letter", "Letter"], ["legal", "Legal"], ["a5", "A5"]] },
    { name: "orientation", label: "Orientation", type: "select", value: "auto", options: [["auto", "Keep each page's"], ["portrait", "Force portrait"], ["landscape", "Force landscape"]] },
  ],
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const o = ctx.options;
    const sizes = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a5: [419.53, 595.28] };
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const [bw, bh] = sizes[o.size] || sizes.a4;
    doc.getPages().forEach((p) => {
      const { width, height } = p.getSize();
      let tw, th;
      if (o.orientation === "portrait") { tw = bw; th = bh; }
      else if (o.orientation === "landscape") { tw = bh; th = bw; }
      else { const land = width > height; tw = land ? bh : bw; th = land ? bw : bh; }
      const s = Math.min(tw / width, th / height);
      p.scale(s, s);
    });
    const bytes = await doc.save();
    ctx.download(bytes, "resized.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Resized ${doc.getPageCount()} page(s) to ${o.size.toUpperCase()}.</p>`;
  },
  help: "<p>Pages are scaled uniformly so nothing is stretched, then fit inside the target size. Aspect ratio is preserved.</p>",
});
