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

## Tools (102)

### PDF — 50

**Organise pages (18)** — Merge · Split · Split by size · Split by bookmarks ·
Remove pages · Extract pages · Organise · Rotate · Reverse pages · Mix / interleave ·
Insert blank pages · Duplicate pages · Crop · Resize · Pages per sheet · Booklet ·
Remove blank pages · Add page border

**Optimise & repair (6)** — Compress · Repair · Grayscale · Invert colours ·
Remove metadata · PDF info

**Convert (5)** — Images to PDF · PDF to JPG · Scan to PDF (camera, filters, page
editor) · Extract text · PDF to Markdown

**Create & write (2)** — Create PDF (blank page + a word processor: headings,
bold/italic/underline, colours, fonts, alignment, lists, page breaks) · Text to PDF

**Edit & annotate (16)** — Page numbers · Header & footer · Bates numbering ·
Watermark · Image watermark · Stamps · Add text · Sign · Redact · Edit metadata ·
Fill form · Flatten form · Add bookmarks · Add attachments · Extract attachments · Compare

**Security (2)** — Protect (AES-256) · Unlock

**OCR (1)** — OCR — PDFs & images (read text from a scanned PDF, a photo or a
screenshot; optionally builds a searchable PDF with an invisible text layer)

### Photos — 52

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

**Files & output (11)** — Convert image · Compress image · Social media resize ·
Passport / ID photo · Image to Base64 · Favicon generator · **Image DPI** ·
Colour picker · Colour palette · EXIF viewer · Strip metadata

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

## Resolution & DPI

Every resolution control accepts **40 DPI to 5000 DPI**.

- **Compress PDF** — lossless rebuild, or re-render each page as a JPEG at any
  DPI from 40 to 5000.
- **PDF to JPG** — render pages to images at 40–5000 DPI, with the DPI written
  into each file.
- **Compress image** — shrink by quality, or work backwards from a print width
  in millimetres at a chosen DPI.
- **Image DPI** — read the DPI already stored in a photo, then tag it with a new
  value (JPEG JFIF and PNG pHYs are written properly, with a valid CRC), or
  resample the pixels so the image really has that resolution at a given size.

**The practical ceiling depends on page size.** A browser canvas can only be so
large, so each tool shows the highest DPI that will actually work for your
document and refuses to start a job that would exhaust memory rather than
freezing the tab. As a guide:

| Format | Largest usable DPI |
| --- | --- |
| A4 page | ~909 DPI |
| A5 page | ~1288 DPI |
| 35 × 45 mm ID photo | 5000 DPI |
| Typical 6 × 4 in photo | ~1700 DPI |

Small formats genuinely reach 5000 DPI; full pages top out lower, because
5000 DPI on A4 would be a 41339 × 58465 pixel image.

## Reducing file size

Both compression tools can now work towards an **exact target size** — the thing
you actually need when a portal or an email says "under 500 KB".

- **Compress PDF → Hit a target file size.** Enter a size in KB or MB. The tool
  renders the pages, then binary-searches for the *highest* JPEG quality that
  fits your budget, dropping the DPI step by step (from your chosen maximum down
  to 40) only when it has to. It re-checks the finished file and tightens the
  budget if the container overhead pushed it over, then reports the exact size
  and the DPI it settled on.
- **Compress image → Hit a target file size.** Searches quality first, then
  shrinks the pixel dimensions, until the file fits. For PNG (which is lossless)
  only the pixel size can be reduced.

If a target genuinely cannot be reached, the tool says so and gives you the
smallest file it could produce rather than silently missing the mark.

The three methods for a PDF, at a glance:

| Method | Keeps text selectable | Typical saving | Best for |
| --- | --- | --- | --- |
| Lossless rebuild | Yes | 5–20% | Archiving, when text must stay searchable |
| Re-render at a DPI | No | 50–95% | When you know the resolution you want |
| Hit a target size | No | Whatever is needed | Upload limits and email |

## Convenience & safety

- **Search.** The home page and the tools directory have a search box covering all
  102 tools — press `/` anywhere to jump to it, `Esc` to clear.
- **Cancel.** Long jobs (compressing, OCR, high-DPI rendering) show a **Cancel**
  button. It is checked once per page, so it stops promptly and saves nothing.
- **Remembered settings.** Each tool remembers your last options, so you don't
  re-enter them on the next visit.
- **Recently used.** The home page shows your last few tools at the top.
- **Friendly errors.** Files are identified by their *contents*, not their
  extension, so dropping a `.docx` on a PDF tool says so plainly instead of
  showing a parser error. Password-protected PDFs are detected and you are told
  to use Unlock PDF first — previously they "worked" and produced junk output.
  Damaged and zero-page files are also reported clearly.

## Unicode text — ₹, Devanagari and more

The PDF text tools (watermark, header & footer, stamps, add text, Bates
numbering, page numbers, Create PDF, Text to PDF) can now draw text in scripts
the built-in PDF fonts cannot handle.

How it works:

- Text made only of WinAnsi characters (Latin-1 plus the em dash, curly quotes,
ellipsis, bullet, degree) keeps using the built-in fonts, so those PDFs stay
small — a one-line document is about 1 KB.
- Text containing anything else — the **rupee sign ₹**, Devanagari, Latin
Extended, arrows, maths symbols — switches to an embedded **Noto Sans** subset
and is shaped properly. Devanagari conjuncts work: क्ष renders as one glyph, not
three.
- Both the font choice and the shaping are decided per text run, so a heading in
Hindi and a paragraph in English can share one document.

**Cost.** Embedding a Unicode font adds roughly 50–90 KB to the output PDF, and
only when such text is actually used. The tool tells you when it has done so.

**What is still not covered:** CJK (Chinese, Japanese, Korean) and emoji. Those
need fonts of many megabytes each, so they are not bundled; the tool names any
characters it could not draw rather than silently dropping them.

Two implementation notes, since they are the kind of thing that is easy to get
wrong:

- pdf-lib's runtime font subsetting throws with the fontkit build we ship, so
the fonts are **pre-subset at build time** with `pyftsubset` (Latin subset
139 KB, Devanagari 119 KB) and embedded whole. The PDF stream is compressed, so
the real cost is the 50–90 KB above.
- fontkit's Indic shaper needs `regeneratorRuntime`, so that 7 KB shim is loaded
before fontkit. Both load lazily, only when Unicode text is first used.

Bookmark titles are a separate case: they are written as UTF-16 strings, so they
already carried ₹, Devanagari and emoji correctly.

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
