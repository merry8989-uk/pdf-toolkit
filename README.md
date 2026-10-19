# PDF Toolkit

A free, **100% client-side** suite of **100 PDF and photo tools** that runs
entirely in the browser. Merge, split, compress, OCR and sign PDFs; edit photos,
remove backgrounds, apply filters and colour grades. Nothing is ever uploaded:
the whole app is static HTML, CSS and JavaScript, so it deploys to GitHub Pages
as-is — and installs as an offline app.

**Live site:** https://merry8989-uk.github.io/pdf-toolkit/
**Suggest a feature:** [@osintgram_io](https://instagram.com/osintgram_io) on Instagram

## Why

Most online PDF and photo tools upload your file to their servers to process it.
This one has no server to upload to. Your file is read into the browser tab's
memory, edited there with WebAssembly and JavaScript, and downloaded straight
back to your device. Open the Network tab and watch — nothing goes out.

## Install it as an app

Open the site and use the **Install app** button in the footer (or your
browser's *Install app* / *Add to Home screen* menu). A service worker caches
the app shell and every engine you use, so the tools keep working offline after
the first visit. You can also **Download source (.zip)** from the footer to run
the whole thing yourself — there is no build step.

## Tools (100)

### PDF — 49

**Organise pages (18)** — Merge · Split · Split by size · Split by bookmarks ·
Remove pages · Extract pages · Organise · Rotate · Reverse pages · Mix / interleave ·
Insert blank pages · Duplicate pages · Crop · Resize · Pages per sheet · Booklet ·
Remove blank pages · Add page border

**Optimise & repair (6)** — Compress · Repair · Grayscale · Invert colours ·
Remove metadata · PDF info

**Convert (6)** — Images to PDF · PDF to JPG · Text to PDF · Scan to PDF (camera,
filters, page editor) · Extract text · PDF to Markdown

**Edit & annotate (16)** — Page numbers · Header & footer · Bates numbering ·
Watermark · Image watermark · Stamps · Add text · Sign · Redact · Edit metadata ·
Fill form · Flatten form · Add bookmarks · Add attachments · Extract attachments · Compare

**Security (2)** — Protect (AES-256) · Unlock

**OCR (1)** — OCR PDF (searchable scans)

### Photos — 51

**Photo editor (8)** — Photo editor (all-in-one) · Photo filters · Adjust image ·
Colour balance · Auto white balance · Sharpen or blur · Draw on image · Add shapes

**Background & objects (4)** — Remove background · Change background ·
Remove object · Blur or pixelate

**Colour & effects (14)** — Colour overlay · Gradient overlay · Duotone ·
Selective colour · Posterize & threshold · Vignette · Film grain · Grayscale ·
Pencil sketch · Cartoon · Glitch · Emboss & edge detect · Tilt-shift · Mirror effect

**Compose & layout (9)** — Overlay image · Blend images · Stitch images ·
Grid split · Collage · Compare images · Watermark image · Add text to image · Add image border

**Transform (6)** — Crop image · Rotate & flip · Resize image · Rounded corners ·
Drop shadow · Upscale image

**Files & output (10)** — Convert image · Compress image · Social media resize ·
Passport / ID photo · Image to Base64 · Favicon generator · Colour picker ·
Colour palette · EXIF viewer · Strip metadata

The whole set is driven by `registry.js` — the nav dropdowns, the home page and
the tools directory all build from that one file.

## Stack

- **[pdf-lib](https://github.com/cantoo-scribe/pdf-lib)** (`@cantoo/pdf-lib` fork, MIT) — PDF structure, forms, metadata, attachments, AES-256 encryption.
- **[pdf.js](https://github.com/mozilla/pdf.js)** (Apache-2.0) — page rendering, thumbnails, text extraction.
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** (Apache-2.0) — OCR in a Web Worker.
- **Canvas 2D + Web Crypto** — every photo tool, and the encryption keys for Protect.
- A ~100-line hand-rolled ZIP writer (`zip.js`).

Everything is **vendored locally** in `vendor/` and served from the same origin —
not from a CDN — so no tool ever reaches the network.

## Layout

```
registry.js                 the tool registry — drives nav, home and directory
index.html / tools.html     landing + full directory
<tool>.html + tools/<tool>.js   one page and one script per tool
app.js                      shared engine + UI kit + photo-editor helpers
zip.js                      store-mode ZIP writer
sw.js + manifest.webmanifest   offline support and installability
style.css                   one stylesheet
vendor/                     pdf-lib, pdf.js, Tesseract, fonts, cmaps, language data
.github/workflows/pages.yml GitHub Pages deployment
```

## Local development

There is **no build step**. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Honest limits

- **Office ⇄ PDF** (Word/Excel/PowerPoint) needs a desktop-class layout engine and is not offered.
- **AI features** — true AI background removal, AI object removal, skin retouch and AI upscaling need ML models. The tools here use honest, model-free approximations instead: background removal matches the edge colour, and Remove object fills from surrounding pixels. They work well on plain backgrounds and simple subjects.
- **Compress, Grayscale and Invert** re-render pages as images, so text stops being selectable — the lossless Compress mode keeps text but saves less.
- **Redact** covers areas visually; run the result through image-mode Compress to also remove the underlying text layer.
- **Sign** places a visual signature, not a cryptographic certificate.

## Licence

MIT for this project — see `LICENSE`. Bundled libraries keep their own licences
(pdf-lib: MIT, pdf.js: Apache-2.0, Tesseract.js: Apache-2.0).

## Not affiliated

This is an independent project. It is not affiliated with, endorsed by, or
connected to iLovePDF, Smallpdf or any other PDF service.
