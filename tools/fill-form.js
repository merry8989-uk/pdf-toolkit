import { mountTool } from "../app.js";

let fields = [];

mountTool({
  id: "fill-form",
  title: "Fill form",
  desc: "Type values into a PDF's existing form fields. The fields are detected automatically when you add the file.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Fill & download",
  async onFiles(ctx) {
    fields = [];
    ctx.extra.innerHTML = "";
    const { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } = await ctx.loadPdfLib();
    const doc = await ctx.loadPdf(ctx.files[0]);
    const list = doc.getForm().getFields();
    if (!list.length) {
      ctx.extra.innerHTML = `<p class="hint">This PDF has no fillable form fields.</p>`;
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "opts";
    wrap.style.marginTop = "12px";
    list.forEach((f, idx) => {
      const name = f.getName();
      const box = document.createElement("div");
      box.className = "field";
      const lab = document.createElement("label");
      lab.textContent = name;
      lab.htmlFor = "ff-" + idx;
      box.appendChild(lab);
      let el;
      if (f instanceof PDFCheckBox) {
        box.className = "check";
        el = document.createElement("input");
        el.type = "checkbox";
        el.checked = f.isChecked();
        box.appendChild(el);
        box.appendChild(lab);
      } else if (f instanceof PDFRadioGroup) {
        el = document.createElement("select");
        const blank = document.createElement("option");
        blank.value = ""; blank.textContent = "— choose —";
        el.appendChild(blank);
        f.getOptions().forEach((o) => { const op = document.createElement("option"); op.value = o; op.textContent = o; el.appendChild(op); });
        box.appendChild(el);
      } else if (f instanceof PDFDropdown || f instanceof PDFOptionList) {
        el = document.createElement("select");
        if (f instanceof PDFOptionList) el.multiple = true;
        f.getOptions().forEach((o) => { const op = document.createElement("option"); op.value = o; op.textContent = o; el.appendChild(op); });
        box.appendChild(el);
      } else if (f instanceof PDFTextField) {
        el = f.isMultiline() ? document.createElement("textarea") : document.createElement("input");
        if (el.tagName === "INPUT") el.type = "text";
        el.value = f.getText() || "";
        box.appendChild(el);
      } else {
        el = document.createElement("input");
        el.type = "text";
        el.disabled = true;
        el.placeholder = "Unsupported field type";
        box.appendChild(el);
      }
      el.id = "ff-" + idx;
      wrap.appendChild(box);
      fields.push({ field: f, el, kind: f.constructor.name });
    });
    ctx.extra.appendChild(wrap);
  },
  async run(ctx) {
    if (!fields.length) throw new Error("No form fields were found in this PDF.");
    const { PDFDocument, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList, PDFTextField } = await ctx.loadPdfLib();
    const doc = await ctx.loadPdf(ctx.files[0]);
    const live = doc.getForm().getFields();
    let filled = 0;
    fields.forEach((rec, i) => {
      const f = live[i];
      if (!f) return;
      try {
        if (f instanceof PDFCheckBox) { rec.el.checked ? f.check() : f.uncheck(); filled++; }
        else if (f instanceof PDFRadioGroup) { if (rec.el.value) { f.select(rec.el.value); filled++; } }
        else if (f instanceof PDFDropdown) { if (rec.el.value) { f.select(rec.el.value); filled++; } }
        else if (f instanceof PDFOptionList) {
          const vals = [...rec.el.selectedOptions].map((o) => o.value);
          if (vals.length) { f.select(vals); filled++; }
        } else if (f instanceof PDFTextField) { f.setText(rec.el.value || ""); filled++; }
      } catch (e) { /* skip a field that refuses the value */ }
    });
    const bytes = await doc.save();
    ctx.download(bytes, "filled.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Filled ${filled} field(s). The output keeps the fields interactive.</p>`;
  },
  help: "<p>Values are written into the existing AcroForm fields, so the document stays fillable and editable. Use <b>Flatten form</b> afterwards if you want to lock the values in.</p>",
});
