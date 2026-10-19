import { mountTool, PHOTO_FILTERS } from "../app.js";

const FILTER_OPTS = Object.entries(PHOTO_FILTERS).map(([k, v]) => [k, v.label]);
const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, small = null;

mountTool({
  id: "image-filters",
  title: "Photo filters",
  desc: "Apply a preset look to a photo — document scan, black & white, sepia, vivid, fade and more — with a live before/after preview.",
  accept: "image/*",
  multiple: false,
  action: "Apply filter",
  options: [
    { name: "filter", label: "Filter", type: "select", value: "vivid", options: FILTER_OPTS },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    small = ctx.fitCanvas(src, 300);
    ctx.extra.innerHTML = `
      <p class="hint">Preview: original on the left, filtered on the right.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hint" style="margin:0 0 5px">Original</div><canvas id="pvA" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
        <div><div class="hint" style="margin:0 0 5px">Filtered</div><canvas id="pvB" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
      </div>`;
    const a = ctx.extra.querySelector("#pvA");
    a.width = small.width; a.height = small.height;
    a.getContext("2d").drawImage(small, 0, 0);
    const update = () => {
      const sel = document.getElementById("opt-filter");
      const out = ctx.applyFilter(small, sel ? sel.value : "none");
      const b = ctx.extra.querySelector("#pvB");
      b.width = out.width; b.height = out.height;
      b.getContext("2d").drawImage(out, 0, 0);
    };
    const sel = document.getElementById("opt-filter");
    if (sel) sel.addEventListener("change", update);
    update();
  },
  onReset() { src = null; small = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const out = ctx.applyFilter(src, o.filter);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `filtered.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied “${PHOTO_FILTERS[o.filter]?.label || o.filter}” — ${out.width}×${out.height}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>Filters use the browser's native image pipeline, so the full-resolution photo is processed at its original size. “Black & white” applies a true threshold for a clean two-tone look.</p>",
});
