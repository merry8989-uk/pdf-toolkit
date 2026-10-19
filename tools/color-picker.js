import { mountTool } from "../app.js";

let src = null, picked = [];

mountTool({
  id: "color-picker",
  title: "Colour picker",
  desc: "Click anywhere on a photo to read the exact colour — as HEX, RGB and HSL. Collect as many as you like.",
  accept: "image/*",
  multiple: false,
  action: "Copy all colours",
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    picked = [];
    ctx.extra.innerHTML = `<p class="hint">Click anywhere on the photo to sample a colour.</p>
      <div id="stage"></div>
      <div id="swatches" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    const c = ctx.canvasOf(1, 1);
    c.style.cssText = "display:block;border:1px solid var(--line);border-radius:8px;max-width:100%;cursor:crosshair";
    stage.appendChild(c);
    const view = ctx.fitCanvas(src, 560);
    c.width = view.width; c.height = view.height;
    c.getContext("2d").drawImage(view, 0, 0);

    const render = () => {
      ctx.extra.querySelector("#swatches").innerHTML = picked.map((p) => `
        <div style="text-align:center">
          <div style="width:54px;height:54px;border-radius:9px;border:1px solid var(--line);background:${p.hex}"></div>
          <div class="mono" style="font-size:10.5px;margin-top:4px;color:var(--text-dim)">${p.hex}</div>
        </div>`).join("");
    };
    c.addEventListener("click", (e) => {
      const r = c.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) * view.width / r.width);
      const y = Math.round((e.clientY - r.top) * view.height / r.height);
      const d = view.getContext("2d").getImageData(x, y, 1, 1).data;
      const hex = ctx.rgbToHex(d[0], d[1], d[2]);
      picked.unshift({ hex, r: d[0], g: d[1], b: d[2] });
      picked = picked.slice(0, 12);
      render();
      ctx.toast(`Picked ${hex}`);
    });
    render();
  },
  onReset() { src = null; picked = []; },
  async run(ctx) {
    if (!picked.length) throw new Error("Click the photo to pick at least one colour.");
    const list = picked.slice().reverse().map((p) => `${p.hex}\t rgb(${p.r}, ${p.g}, ${p.b})`).join("\n");
    try { await navigator.clipboard.writeText(list); ctx.toast("Colours copied to the clipboard."); } catch (e) { /* clipboard may be blocked */ }
    ctx.out.innerHTML = `<p class="hint">Picked ${picked.length} colour(s): ${picked.map((p) => `<span class="mono" style="color:${p.hex}">${p.hex}</span>`).join(", ")}</p>
      <pre style="white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:12px;font:12px/1.6 var(--mono);margin-top:10px">${list}</pre>`;
  },
  help: "<p>The colour is read from the displayed preview, which is the photo scaled down — for flat colour areas this is exact. Clicking a sharp edge may blend neighbouring pixels.</p>",
});
