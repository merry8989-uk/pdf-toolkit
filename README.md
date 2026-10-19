# PDF Toolkit

A free, **100% client-side** suite of PDF and image tools that runs entirely in
the browser. Merge, split, compress, organise, rotate, watermark, sign, redact,
OCR, convert, protect — plus a full set of photo tools. Nothing is ever uploaded:
the whole app is static HTML, CSS and JavaScript, so it deploys to GitHub Pages
as-is.

**Live site:** https://merry8989-uk.github.io/pdf-toolkit/

## Why

Most online PDF tools upload your document to their servers to process it.
This one has no server to upload to. Your file is read into the browser tab's
memory, edited there with WebAssembly and JavaScript, and downloaded straight
back to your device. Open the Network tab and watch — nothing goes out.

## Tools (64)

**PDF · Organise pages (18)** — Merge · Split · Split by size · Split by bookmarks ·
Remove pages · Extract pages · Organise · Rotate · Reverse pages · Mix / interleave ·
Insert blank pages · Duplicate pages · Crop · Resize · Pages per sheet · Booklet ·
Remove blank pages · Add page border

**PDF · Optimise & repair (6)** — Compress · Repair · Grayscale · Invert colours ·
Remove metadata · PDF info

**PDF · Convert (6)** — Images to PDF · PDF to JPG · Text to PDF · Scan to PDF
(camera, with filters and a page editor) · Extract text · PDF to Markdown

**PDF · Edit & annotate (16)** — Page numbers · Header & footer · Bates numbering ·
Watermark · Image watermark · Stamps · Add text · Sign · Redact · Edit metadata ·
Fill form · Flatten form · Add bookmarks · Add attachments · Extract attachments · Compare

**PDF · Security (2)** — Protect (AES-256) · Unlock

**PDF · OCR (1)** — OCR PDF (searchable scans)

**Photos (15)** — Convert image · Image to Base64 · Favicon generator ·
Compress image · Resize image · **Photo filters** · **Adjust image** ·
**Sharpen or blur** · Crop image · Rotate & flip · Grayscale image ·
Watermark image · Add text to image · Add image border · Collage

The whole set is driven by `registry.js` — the nav dropdowns, the home page and
the tools directory all build from that one file.

## Stack

- **[pdf-lib](https://github.com/cantoo-scribe/pdf-lib)** (`@cantoo/pdf-lib` fork, MIT) — reads, edits and writes PDF structure, forms, metadata, attachments and AES-256 encryption.
- **[pdf.js](https://github.com/mozilla/pdf.js)** (Apache-2.0) — renders pages to canvas, drives thumbnails and text extraction.
- **[Tesseract.js](https://github.com/naptha/tesseract.js)** (Apache-2.0) — OCR, running in a Web Worker with WebAssembly.
- **Web Crypto** — AES-256 keys for the Protect tool.
- A ~100-line hand-rolled ZIP writer (`zip.js`) — no dependency for bundling multi-file output.

Everything is **vendored locally** in `vendor/` and served from the same origin —
not from a CDN. pdf.js's `standard_fonts/` and `cmaps/`, and Tesseract's core
WebAssembly and English language data, are vendored too, so no tool ever
reaches the network.

## Layout

```
registry.js                 the tool registry — drives nav, home and directory
index.html / tools.html     landing + full directory
<tool>.html + tools/<tool>.js   one page and one script per tool
app.js                      shared engine + UI kit (mountTool, loaders, helpers)
zip.js                      store-mode ZIP writer
style.css                   one stylesheet
vendor/                     pdf-lib, pdf.js, Tesseract, fonts, cmaps, language data
.github/workflows/pages.yml GitHub Pages deployment
```

Every tool page is a thin shell that imports `tools/<tool>.js`, which calls
`mountTool({...})` from `app.js`. The shared engine builds the header, drop
zone, options, action button, progress bar and download area, so each tool only
has to implement its `run(ctx)` function.

## Local development

There is **no build step**. Serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. (Open it via a server, not `file://`, so
that ES modules and the workers load correctly.)

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`, which publishes the
repository root to GitHub Pages. In the repo settings, set **Pages → Source →
GitHub Actions**. For a custom domain, add a `CNAME` file and configure DNS.

## Honest limits

- **Office ⇄ PDF** (Word/Excel/PowerPoint) needs a desktop-class layout engine and is not offered.
- **AI summarise / translate** needs a model server; there is no server here.
- **Compress, Grayscale and Invert** re-render pages as images, so text stops being selectable — the lossless Compress mode keeps text but saves less.
- **Redact** covers areas visually; run the result through image-mode Compress to also remove the underlying text layer.
- **Sign** places a visual signature, not a cryptographic certificate.

## Privacy

Files are processed on your device and never transmitted. See `privacy.html`.

## Licence

MIT for this project — see `LICENSE`. Bundled libraries keep their own licences
(pdf-lib: MIT, pdf.js: Apache-2.0, Tesseract.js: Apache-2.0).

## Not affiliated

This is an independent project. It is not affiliated with, endorsed by, or
connected to iLovePDF, Smallpdf or any other PDF service.
