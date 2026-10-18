# PDF Toolkit

A free, **100% client-side** suite of PDF tools that runs entirely in the browser.
Merge, split, organise, rotate, crop, watermark, number, convert, protect and
unlock PDFs — without ever uploading a file. There is no backend: the whole app
is static HTML, CSS and JavaScript, so it deploys to GitHub Pages as-is.

**Live site:** https://merry8989-uk.github.io/pdf-toolkit/

## Why

Most online PDF tools upload your document to their servers to process it.
This one has no server to upload to. Your file is read into the browser tab's
memory, edited there with WebAssembly and JavaScript, and downloaded straight
back to your device. Open the Network tab and watch — nothing goes out.

## Tools

**Organise:** Merge · Split · Remove pages · Extract pages · Organise (reorder) · Rotate · Crop · Pages per sheet · Insert blank pages · Duplicate pages · Resize
**Edit:** Page numbers · Watermark · Edit metadata · Flatten form
**Convert:** Images to PDF · PDF to JPG · Extract text
**Protect:** Protect (AES-256) · Unlock

## Stack

- **[pdf-lib](https://github.com/cantoo-scribe/pdf-lib)** (`@cantoo/pdf-lib` fork, MIT) — reads, edits and writes PDF structure, forms, metadata and encryption.
- **[pdf.js](https://github.com/mozilla/pdf.js)** (Apache-2.0) — renders pages to canvas, drives thumbnails, and extracts text.
- **Web Crypto** — AES-256 keys for the Protect tool.
- A ~100-line hand-rolled ZIP writer (`zip.js`) — no dependency for bundling multi-file output.

Both libraries are **vendored locally** in `vendor/` and served from the same
origin — not from a CDN. pdf.js's `standard_fonts/` and `cmaps/` are vendored
too, so rendering never reaches the network.

## Layout

```
index.html / tools.html     landing + directory
<tool>.html + tools/<tool>.js   one page and one script per tool
app.js                      shared engine + UI kit (mountTool, loaders, helpers)
zip.js                      store-mode ZIP writer
style.css                   one stylesheet
vendor/                     pdf-lib, pdf.js, worker, fonts, cmaps
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
that ES modules and the pdf.js worker load correctly.)

## Deploy

Pushing to `main` triggers `.github/workflows/pages.yml`, which publishes the
repository root to GitHub Pages. In the repo settings, set **Pages → Source →
GitHub Actions**. For a custom domain, add a `CNAME` file and configure DNS.

## Privacy

Files are processed on your device and never transmitted. See `privacy.html`.

## Licence

MIT for this project — see `LICENSE`. Bundled libraries keep their own licences
(pdf-lib: MIT, pdf.js: Apache-2.0).

## Not affiliated

This is an independent project. It is not affiliated with, endorsed by, or
connected to iLovePDF, Smallpdf or any other PDF service.
