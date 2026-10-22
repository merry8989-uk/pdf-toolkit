import { mountTool } from "../app.js";

/* Create a PDF from scratch: blank pages plus a small word-processor.
   The editor is a contenteditable surface; on export the DOM is walked,
   converted into formatted text runs and laid out with pdf-lib, so the
   resulting PDF has real, selectable, searchable text. */

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a5: [419.53, 595.28] };
const FAMILIES = { sans: 'Helvetica, Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", Courier, monospace' };

function cssColor(str, fallback = [0.1, 0.11, 0.13]) {
  const m = /rgba?\(([^)]+)\)/.exec(str || "");
  if (!m) return fallback;
  const p = m[1].split(",").map((v) => parseFloat(v));
  return [Math.min(1, p[0] / 255), Math.min(1, p[1] / 255), Math.min(1, p[2] / 255)];
}

function stdKey(family, bold, italic) {
  const f = (family || "").toLowerCase();
  const mono = f.includes("mono") || f.includes("courier");
  const serif = f.includes("serif") && !f.includes("sans");
  if (mono) return bold ? (italic ? "CourierBoldOblique" : "CourierBold") : (italic ? "CourierOblique" : "Courier");
  if (serif) return bold ? (italic ? "TimesRomanBoldItalic" : "TimesRomanBold") : (italic ? "TimesRomanItalic" : "TimesRoman");
  return bold ? (italic ? "HelveticaBoldOblique" : "HelveticaBold") : (italic ? "HelveticaOblique" : "Helvetica");
}

mountTool({
  id: "create-pdf",
  title: "Create PDF",
  desc: "Start from a blank page and write your own document. A small word processor with headings, bold/italic/underline, colours, lists, alignment, fonts and page breaks — exported as a real PDF with selectable text.",
  noFile: true,
  action: "Create PDF",
  options: [
    { name: "size", label: "Page size", type: "select", value: "a4", options: [["a4", "A4"], ["letter", "Letter"], ["legal", "Legal"], ["a5", "A5"]] },
    { name: "orient", label: "Orientation", type: "select", value: "portrait", options: [["portrait", "Portrait"], ["landscape", "Landscape"]] },
    { name: "margin", label: "Margin (mm)", type: "number", value: 20, min: 5, max: 50 },
    { name: "base", label: "Base font size (pt)", type: "number", value: 11, min: 7, max: 24 },
    { name: "leading", label: "Line spacing", type: "range", value: 1.45, min: 1, max: 2.4, step: 0.05 },
    { name: "blank", label: "Blank pages before the content", type: "number", value: 0, min: 0, max: 20 },
    { name: "numbers", label: "Add page numbers", type: "checkbox", value: false },
  ],
  onInit(ctx) {
    ctx.extra.innerHTML = `
      <div class="panel" style="padding:14px;margin-top:14px">
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <select id="tb-block" title="Paragraph style" style="background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:inherit;font-size:13px">
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
          </select>
          <select id="tb-font" title="Font" style="background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:inherit;font-size:13px">
            <option value="sans">Sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
          <select id="tb-size" title="Size" style="background:var(--surface-2);color:var(--text);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font:inherit;font-size:13px">
            ${[9, 10, 11, 12, 14, 16, 20, 24, 32].map((s) => `<option value="${s}">${s} pt</option>`).join("")}
          </select>
        </div>
        <div class="row" style="gap:5px;flex-wrap:wrap;margin-bottom:8px">
          <button class="btn ghost sm" data-cmd="bold" title="Bold" type="button"><b>B</b></button>
          <button class="btn ghost sm" data-cmd="italic" title="Italic" type="button"><i>I</i></button>
          <button class="btn ghost sm" data-cmd="underline" title="Underline" type="button"><u>U</u></button>
          <button class="btn ghost sm" data-cmd="strikeThrough" title="Strikethrough" type="button"><s>S</s></button>
          <span style="width:8px"></span>
          <button class="btn ghost sm" data-cmd="justifyLeft" title="Align left" type="button">⯇</button>
          <button class="btn ghost sm" data-cmd="justifyCenter" title="Centre" type="button">≡</button>
          <button class="btn ghost sm" data-cmd="justifyRight" title="Align right" type="button">⯈</button>
          <button class="btn ghost sm" data-cmd="justifyFull" title="Justify" type="button">☰</button>
          <span style="width:8px"></span>
          <button class="btn ghost sm" data-cmd="insertUnorderedList" title="Bullet list" type="button">• List</button>
          <button class="btn ghost sm" data-cmd="insertOrderedList" title="Numbered list" type="button">1. List</button>
          <span style="width:8px"></span>
          <input type="color" id="tb-color" value="#111318" title="Text colour" style="width:34px;height:30px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);cursor:pointer">
          <button class="btn ghost sm" data-ins="hr" title="Divider line" type="button">— Divider</button>
          <button class="btn ghost sm" data-ins="pb" title="Page break" type="button">⤓ Page break</button>
          <button class="btn ghost sm" data-cmd="undo" title="Undo" type="button">↶</button>
          <button class="btn ghost sm" data-cmd="redo" title="Redo" type="button">↷</button>
          <button class="btn ghost sm" id="tb-clear" type="button">Clear</button>
        </div>
        <div id="page" contenteditable="true" spellcheck="true"
          style="background:#fff;color:#111318;border-radius:10px;padding:34px 38px;min-height:460px;max-height:620px;overflow:auto;
                 font:15px/1.5 Helvetica, Arial, sans-serif;outline:none;box-shadow:inset 0 0 0 1px var(--line)">
          <h1>Untitled document</h1>
          <p>Start typing here. Select text and use the toolbar to make it bold, add headings, change the colour, or turn lines into lists.</p>
          <p>Everything is processed in your browser — nothing is uploaded.</p>
        </div>
        <p class="hint" style="margin-top:8px">Leave the editor empty and set “Blank pages before the content” to produce a blank PDF.</p>
      </div>`;

    const page = ctx.extra.querySelector("#page");

    const focusEditor = () => page.focus();
    // keep the text selection alive when a toolbar BUTTON is pressed
    // (selects and the colour input must still open normally)
    ctx.extra.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") && !e.target.closest("#page")) e.preventDefault();
    });

    ctx.extra.querySelectorAll("[data-cmd]").forEach((b) => {
      b.addEventListener("click", () => {
        focusEditor();
        document.execCommand(b.dataset.cmd, false, null);
      });
    });
    ctx.extra.querySelectorAll("[data-ins]").forEach((b) => {
      b.addEventListener("click", () => {
        focusEditor();
        if (b.dataset.ins === "hr") document.execCommand("insertHTML", false, '<hr><p><br></p>');
        else document.execCommand("insertHTML", false, '<hr class="pb"><p><br></p>');
      });
    });
    ctx.extra.querySelector("#tb-block").addEventListener("change", (e) => {
      focusEditor();
      document.execCommand("formatBlock", false, e.target.value.toUpperCase());
    });
    ctx.extra.querySelector("#tb-font").addEventListener("change", (e) => {
      focusEditor();
      document.execCommand("fontName", false, FAMILIES[e.target.value]);
    });
    ctx.extra.querySelector("#tb-size").addEventListener("change", (e) => {
      focusEditor();
      document.execCommand("fontSize", false, "7");
      page.querySelectorAll('font[size="7"]').forEach((f) => {
        f.removeAttribute("size");
        f.style.fontSize = e.target.value + "pt";
      });
    });
    ctx.extra.querySelector("#tb-color").addEventListener("input", (e) => {
      focusEditor();
      document.execCommand("foreColor", false, e.target.value);
    });
    ctx.extra.querySelector("#tb-clear").addEventListener("click", () => {
      page.innerHTML = "<p><br></p>";
      page.focus();
    });
  },
  async run(ctx) {
    const o = ctx.options;
    const editor = ctx.extra.querySelector("#page");
    if (!editor) throw new Error("The editor did not load. Reload the page and try again.");
    const blocks = collectBlocks(editor);

    const { PDFDocument, StandardFonts, rgb } = await ctx.loadPdfLib();
    const doc = await PDFDocument.create();
    const [pw0, ph0] = PAGE_SIZES[o.size] || PAGE_SIZES.a4;
    const landscape = o.orient === "landscape";
    const PW = landscape ? ph0 : pw0, PH = landscape ? pw0 : ph0;
    const margin = (Number(o.margin) || 20) * 2.834645;   // mm → pt
    const base = Number(o.base) || 11;
    const leading = Number(o.leading) || 1.45;
    const maxW = PW - margin * 2;
    // The editor reports sizes in CSS pixels. Convert them to points so the
    // "base font size" option actually controls the document's text size
    // while headings keep their relative proportions.
    const editorBasePx = parseFloat(getComputedStyle(editor).fontSize) || 15;
    const scale = base / editorBasePx;

    // ctx.fontFor keeps the chosen built-in family for plain text and switches
    // to an embedded Noto font only for runs the built-in fonts cannot draw.
    const getFont = (family, bold, italic, text) =>
      ctx.fontFor(doc, text || "", { bold, stdKey: stdKey(family, bold, italic) });

    let page = doc.addPage([PW, PH]);
    let y = PH - margin;
    const newPage = () => { page = doc.addPage([PW, PH]); y = PH - margin; };

    // optional leading blank pages
    const blanks = Math.min(Math.max(0, o.blank | 0), 20);
    for (let i = 0; i < blanks; i++) newPage();

    const drawLine = async (runs, opts) => {
      const blockPx = opts.sizePx || editorBasePx;
      const blockSize = blockPx * scale;
      const lh = blockSize * leading;
      const avail = maxW - (opts.indent || 0);
      const lines = [];
      let line = [], lineW = 0;

      for (const run of runs) {
        const f = await getFont(run.font, run.bold, run.italic, run.text);
        const sz = (run.size || blockPx) * scale;
        for (const tok of run.text.split(/(\s+)/)) {
          if (!tok) continue;
          if (tok === "\n") { lines.push({ line, w: lineW }); line = []; lineW = 0; continue; }
          const w = f.widthOfTextAtSize(tok, sz);
          if (lineW + w > avail && line.length) {
            lines.push({ line, w: lineW });
            line = []; lineW = 0;
            if (/^\s+$/.test(tok)) continue;
          }
          line.push({ text: tok, font: f, size: sz, color: run.color, underline: run.underline, space: /^\s+$/.test(tok), w });
          lineW += w;
        }
      }
      if (line.length) lines.push({ line, w: lineW });

      const align = opts.align || "left";
      lines.forEach((ln, li) => {
        if (y - lh < margin) newPage();
        y -= lh;
        let x = margin + (opts.indent || 0);
        let pad = 0;
        if (align === "center") x += (avail - ln.w) / 2;
        else if (align === "right") x += (avail - ln.w);
        else if (align === "justify") {
          // justify every line except the last of the block
          const gaps = ln.line.filter((s) => s.space).length;
          if (li < lines.length - 1 && gaps > 0) pad = Math.max(0, (avail - ln.w) / gaps);
        }
        for (const seg of ln.line) {
          const col = seg.color || opts.color || [0.1, 0.11, 0.13];
          if (!seg.space) {
            page.drawText(seg.text, { x, y: y + lh * 0.24, size: seg.size, font: seg.font, color: rgb(col[0], col[1], col[2]) });
            if (seg.underline) {
              page.drawLine({ start: { x, y: y + lh * 0.16 }, end: { x: x + seg.w, y: y + lh * 0.16 }, thickness: Math.max(0.5, seg.size / 22), color: rgb(col[0], col[1], col[2]) });
            }
          }
          x += seg.w + pad;
        }
      });
      return lh;
    };

    if (!blocks.length && blanks === 0) {
      ctx.out.innerHTML = `<p class="hint">The editor is empty. Either type something, or set “Blank pages before the content” above 0 to make a blank PDF.</p>`;
      return;
    }

    for (const b of blocks) {
      if (b.type === "pagebreak") { newPage(); continue; }
      if (b.type === "hr") {
        if (y - base * 2 < margin) newPage();
        y -= base * 1.2;
        page.drawLine({ start: { x: margin, y }, end: { x: PW - margin, y }, thickness: 0.75, color: rgb(0.6, 0.62, 0.66) });
        y -= base * 0.6;
        continue;
      }
      // The block's own font size comes from what the browser computed, so a
      // heading stays a heading whatever the base size is set to.
      const sizePx = Math.max(...b.runs.map((r) => r.size || editorBasePx), editorBasePx);
      const size = sizePx * scale;
      let indent = 0;
      const align = b.align === "start" ? "left" : (b.align || "left");
      if (b.type === "h1") y -= base * 0.5;
      else if (b.type === "h2") y -= base * 0.4;
      else if (b.type === "h3") y -= base * 0.3;
      else if (b.type === "quote") indent = base * 1.6;
      else if (b.type === "bullet" || b.type === "number") indent = base * 1.6;

      if (b.type === "bullet" || b.type === "number") {
        if (y - size * leading < margin) newPage();
        y -= size * leading;
        const f = await getFont(null, false, false, b.marker);
        page.drawText(b.marker, { x: margin, y: y + size * leading * 0.24, size, font: f, color: rgb(0.35, 0.37, 0.42) });
      }
      await drawLine(b.runs, { sizePx, indent, align, color: b.color });
      y -= size * 0.35;   // paragraph gap
    }

    if (o.numbers) {
      const f = await getFont(null, false, false, "1");
      const pages = doc.getPages();
      pages.forEach((p, i) => {
        const label = String(i + 1);
        const w = f.widthOfTextAtSize(label, 9);
        p.drawText(label, { x: (PW - w) / 2, y: margin * 0.55, size: 9, font: f, color: rgb(0.4, 0.42, 0.46) });
      });
    }

    const bytes = await doc.save();
    ctx.download(bytes, "document.pdf");
    const blankOnly = !blocks.length;
    ctx.out.innerHTML = `<p class="hint">✓ Created <b>document.pdf</b> — ${doc.getPageCount()} page(s)${blankOnly ? " (blank)" : ", with selectable text"}${o.numbers ? ", numbered" : ""}.${ctx.unicodeNote(doc)}${ctx.glyphWarning(editor.textContent)}</p>`;
  },
  help: "<p>The editor is a real rich-text surface. On export the document is walked block by block, formatted text runs are measured with the actual PDF fonts, and the text is laid out with word wrapping, alignment, lists and page breaks. The output is a normal PDF with <b>selectable, searchable text</b> — not an image.</p>",
});

/* ---------- DOM → blocks ---------- */
function baseStyle(el) {
  const cs = getComputedStyle(el);
  return {
    bold: parseInt(cs.fontWeight, 10) >= 600,
    italic: cs.fontStyle === "italic",
    underline: (cs.textDecorationLine || "").includes("underline"),
    color: cssColor(cs.color),
    size: parseFloat(cs.fontSize) || null,
    font: cs.fontFamily,
  };
}

function runsFrom(node, inherited) {
  const runs = [];
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      const t = n.textContent.replace(/\s+/g, " ");
      if (t) runs.push({ text: t, ...inherited });
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (tag === "BR") { runs.push({ text: "\n", ...inherited }); return; }
    const cs = getComputedStyle(n);
    const st = {
      bold: inherited.bold || /^(B|STRONG)$/.test(tag) || parseInt(cs.fontWeight, 10) >= 600,
      italic: inherited.italic || /^(I|EM)$/.test(tag) || cs.fontStyle === "italic",
      underline: inherited.underline || tag === "U" || (cs.textDecorationLine || "").includes("underline"),
      color: cssColor(cs.color, inherited.color),
      size: parseFloat(cs.fontSize) || inherited.size,
      font: cs.fontFamily || inherited.font,
    };
    runs.push(...runsFrom(n, st));
  });
  return runs;
}

function collectBlocks(root) {
  const blocks = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const t = child.textContent.replace(/\s+/g, " ").trim();
        if (t) blocks.push({ type: "p", runs: [{ text: t, bold: false, italic: false, underline: false, color: null, size: null, font: null }] });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName;
      if (tag === "UL" || tag === "OL") {
        [...child.children].forEach((li, i) => {
          const runs = runsFrom(li, baseStyle(li));
          if (runs.length) blocks.push({ type: tag === "UL" ? "bullet" : "number", marker: tag === "OL" ? `${i + 1}. ` : "• ", runs, align: "left" });
        });
        continue;
      }
      if (tag === "HR") {
        blocks.push({ type: child.classList.contains("pb") ? "pagebreak" : "hr" });
        continue;
      }
      if (["H1", "H2", "H3", "H4", "H5", "H6", "P", "DIV", "BLOCKQUOTE", "PRE", "LI"].includes(tag)) {
        const map = { H1: "h1", H2: "h2", H3: "h3", H4: "h3", H5: "h3", H6: "h3", BLOCKQUOTE: "quote", PRE: "p" };
        const runs = runsFrom(child, baseStyle(child));
        const text = runs.map((r) => r.text).join("").trim();
        if (text) blocks.push({ type: map[tag] || "p", runs, align: getComputedStyle(child).textAlign, color: baseStyle(child).color });
        continue;
      }
      walk(child);
    }
  };
  walk(root);
  return blocks;
}
