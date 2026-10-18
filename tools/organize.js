import { mountTool } from "../app.js";

let order = [];
let grid = null;

mountTool({
  id: "organize",
  title: "Organise PDF",
  desc: "Reorder the pages of a PDF. Click pages in the order you want them to appear — the badge shows each page's new position.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Apply new order",
  options: [{ name: "order", label: "New page order", type: "text", placeholder: "3, 1, 2, 5" }],
  async onFiles(ctx) {
    order = [];
    ctx.extra.innerHTML = "";
    const tip = document.createElement("p");
    tip.className = "hint";
    tip.textContent = "Click pages in the order you want. Click again to remove one from the sequence.";
    ctx.extra.appendChild(tip);
    grid = document.createElement("div");
    ctx.extra.appendChild(grid);
    const input = document.getElementById("opt-order");
    const refresh = () => {
      grid.querySelectorAll(".pg").forEach((el) => {
        const n = +el.dataset.page;
        el.classList.remove("sel");
        const b = el.querySelector(".badge");
        if (b) b.remove();
        const pos = order.indexOf(n);
        if (pos >= 0) {
          el.classList.add("sel");
          const bd = document.createElement("div");
          bd.className = "badge";
          bd.textContent = pos + 1;
          el.appendChild(bd);
        }
      });
      input.value = order.join(", ");
    };
    await ctx.thumbnails(ctx.files[0], grid, {
      onClick: (n) => {
        const i = order.indexOf(n);
        if (i >= 0) order.splice(i, 1); else order.push(n);
        refresh();
      },
    });
  },
  onReset() { order = []; },
  async run(ctx) {
    const { PDFDocument } = await ctx.loadPdfLib();
    const src = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    let ord = ctx.options.order.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1 && n <= total);
    if (!ord.length && order.length) ord = order.slice();
    if (!ord.length) ord = Array.from({ length: total }, (_, i) => i + 1);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, ord.map((n) => n - 1));
    pages.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    ctx.download(bytes, "organized.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ New document has ${ord.length} page(s) in the order you set.</p>`;
  },
  help: "<p>Any page you leave out is dropped from the output, so this tool can also delete pages. Leave everything blank to keep the original order.</p>",
});
