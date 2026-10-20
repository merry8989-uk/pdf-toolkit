/* ============================================================
   Tool registry — the single source of truth for the whole site.
   Nav dropdowns, the home page and the tools directory all build
   from this file. Every id here must have <id>.html + tools/<id>.js
   ============================================================ */

export const REGISTRY = [
  {
    id: "pdf",
    name: "PDF",
    icon: "▤",
    tagline: "Everything you can do to a PDF document.",
    groups: [
      {
        name: "Organise pages",
        icon: "⇅",
        tools: [
          ["merge", "Merge PDF", "Combine several PDFs into one, in any order"],
          ["split", "Split PDF", "Extract ranges or split into separate files"],
          ["split-by-size", "Split by size", "Cut a PDF into chunks under a size limit"],
          ["split-by-bookmarks", "Split by bookmarks", "One file per bookmark section"],
          ["remove-pages", "Remove pages", "Delete pages and keep the rest"],
          ["extract-pages", "Extract pages", "Save only the pages you select"],
          ["organize", "Organise PDF", "Reorder pages into a new sequence"],
          ["rotate", "Rotate PDF", "Turn pages 90°, 180° or 270°"],
          ["reverse-pages", "Reverse pages", "Flip the page order back to front"],
          ["mix-interleave", "Mix / interleave", "Alternate pages from two PDFs"],
          ["insert-pages", "Insert blank pages", "Add blank pages anywhere"],
          ["duplicate-pages", "Duplicate pages", "Copy pages within the file"],
          ["crop", "Crop PDF", "Trim the visible margins"],
          ["resize", "Resize pages", "Scale pages to a paper size"],
          ["pages-per-sheet", "Pages per sheet", "2 or 4 pages on one sheet"],
          ["booklet", "Booklet / impose", "Reorder for folded booklet printing"],
          ["remove-blank-pages", "Remove blank pages", "Detect and drop empty pages"],
          ["add-border", "Add page border", "Draw a border around every page"],
        ],
      },
      {
        name: "Optimise & repair",
        icon: "⚙",
        tools: [
          ["compress", "Compress PDF", "Hit a target size, or re-render at 40–5000 DPI"],
          ["repair", "Repair PDF", "Best-effort rebuild of a damaged file"],
          ["grayscale", "Grayscale PDF", "Convert pages to black and white"],
          ["invert-colors", "Invert colours", "Invert the colours of every page"],
          ["sanitize-metadata", "Remove metadata", "Strip title, author and producer"],
          ["pdf-info", "PDF info", "Page count, sizes and metadata at a glance"],
        ],
      },
      {
        name: "Convert",
        icon: "⇄",
        tools: [
          ["images-to-pdf", "Images to PDF", "JPG / PNG / WebP into one PDF"],
          ["pdf-to-jpg", "PDF to JPG", "Render pages to images at 40–5000 DPI"],
          ["scan-to-pdf", "Scan to PDF", "Camera scan with filters and a page editor"],
          ["extract-text", "Extract text", "Read the selectable text out of a PDF"],
          ["pdf-to-markdown", "PDF to Markdown", "Convert to headings, lists and tables"],
        ],
      },
      {
        name: "Create & write",
        icon: "✍",
        tools: [
          ["create-pdf", "Create PDF", "Start from a blank page and write with formatting"],
          ["text-to-pdf", "Text to PDF", "Turn pasted text into a clean PDF"],
        ],
      },
      {
        name: "Edit & annotate",
        icon: "✎",
        tools: [
          ["page-numbers", "Page numbers", "Stamp numbering on every page"],
          ["header-footer", "Header & footer", "Add running text at the top or bottom"],
          ["bates-numbering", "Bates numbering", "Legal-style stamped numbering"],
          ["watermark", "Watermark", "Add a text watermark across pages"],
          ["watermark-image", "Image watermark", "Stamp a logo or image on pages"],
          ["stamps", "Stamps", "APPROVED, DRAFT and other rubber stamps"],
          ["annotate-text", "Add text", "Place text anywhere on a page"],
          ["sign", "Sign PDF", "Draw a signature and place it"],
          ["redact", "Redact PDF", "Black out sensitive areas"],
          ["metadata", "Edit metadata", "Set title, author, keywords"],
          ["fill-form", "Fill form", "Type into a PDF's form fields"],
          ["flatten", "Flatten form", "Bake form fields into the page"],
          ["add-bookmarks", "Add bookmarks", "Create a PDF outline / sidebar"],
          ["add-attachments", "Add attachments", "Embed files inside the PDF"],
          ["extract-attachments", "Extract attachments", "Pull embedded files back out"],
          ["compare", "Compare PDFs", "Spot differences between two versions"],
        ],
      },
      {
        name: "Security",
        icon: "🔐",
        tools: [
          ["protect", "Protect PDF", "Encrypt with a password (AES-256)"],
          ["unlock", "Unlock PDF", "Remove a password you already know"],
        ],
      },
      {
        name: "OCR",
        icon: "👁",
        tools: [
          ["ocr", "OCR PDF", "Make a scanned PDF searchable"],
        ],
      },
    ],
  },
  {
    id: "image",
    name: "Photos",
    icon: "🖼",
    tagline: "A photo editor's worth of tools — all running in your browser.",
    groups: [
      {
        name: "Photo editor",
        icon: "✎",
        tools: [
          ["photo-editor", "Photo editor", "One place for edits, text, shapes and drawing"],
          ["image-filters", "Photo filters", "Preset looks with before/after preview"],
          ["adjust-image", "Adjust image", "Brightness, contrast, saturation, hue, blur"],
          ["colour-balance", "Colour balance", "Exposure, temperature, tint and gamma"],
          ["white-balance", "Auto white balance", "One-click colour cast correction"],
          ["sharpen-image", "Sharpen or blur", "Make a photo crisper or softer"],
          ["draw-on-image", "Draw on image", "Freehand pen and highlighter"],
          ["add-shapes", "Add shapes", "Arrows, rectangles, ellipses and lines"],
        ],
      },
      {
        name: "Background & objects",
        icon: "✂",
        tools: [
          ["background-remove", "Remove background", "Make a plain background transparent"],
          ["background-change", "Change background", "Replace it with a colour, gradient or photo"],
          ["remove-object", "Remove object", "Fill over something you want gone"],
          ["blur-region", "Blur or pixelate", "Hide a face, plate or address"],
        ],
      },
      {
        name: "Colour & effects",
        icon: "🎨",
        tools: [
          ["colour-overlay", "Colour overlay", "Tint a photo with any colour"],
          ["gradient-overlay", "Gradient overlay", "Linear or radial gradient wash"],
          ["duotone", "Duotone", "Map tones onto two colours"],
          ["colour-splash", "Selective colour", "Keep one colour, drain the rest"],
          ["posterize", "Posterize & threshold", "Flat tones or pure black and white"],
          ["vignette", "Vignette", "Darken or lighten the edges"],
          ["film-grain", "Film grain", "Analogue grain and digital noise"],
          ["grayscale-image", "Grayscale image", "Turn a colour photo black and white"],
          ["sketch", "Pencil sketch", "Turn a photo into a line drawing"],
          ["cartoon", "Cartoon effect", "Flat colours with outlined edges"],
          ["glitch", "Glitch effect", "RGB split and datamosh"],
          ["emboss-edge", "Emboss & edge detect", "Relief, edges and thin outlines"],
          ["tilt-shift", "Tilt-shift", "Keep a band sharp, blur the rest"],
          ["mirror-image", "Mirror effect", "Symmetry and kaleidoscope"],
        ],
      },
      {
        name: "Compose & layout",
        icon: "⧉",
        tools: [
          ["overlay-image", "Overlay image", "Put a logo or image on top of a photo"],
          ["blend-images", "Blend images", "Double exposure and texture blending"],
          ["stitch-images", "Stitch images", "Join photos into one long image"],
          ["grid-split", "Grid split", "Cut an image into tiles"],
          ["collage", "Collage", "Arrange photos into a grid"],
          ["image-compare", "Compare images", "Side by side, stacked or difference map"],
          ["image-watermark", "Watermark image", "Stamp text across a photo"],
          ["add-text-to-image", "Add text to image", "Write text on a photo"],
          ["image-border", "Add image border", "Frame a photo"],
        ],
      },
      {
        name: "Transform",
        icon: "⤡",
        tools: [
          ["crop-image", "Crop image", "Trim edges by percentage"],
          ["rotate-image", "Rotate & flip", "Rotate and mirror a photo"],
          ["resize-image", "Resize image", "Set width, height or a percentage"],
          ["rounded-corners", "Rounded corners", "Round or circle-crop a photo"],
          ["drop-shadow", "Drop shadow", "Add a soft shadow behind an image"],
          ["upscale-image", "Upscale image", "Enlarge with high-quality smoothing"],
        ],
      },
      {
        name: "Files & output",
        icon: "⇄",
        tools: [
          ["convert-image", "Convert image", "JPG ⇄ PNG ⇄ WebP"],
          ["compress-image", "Compress image", "Hit a target size, or size by print size and DPI"],
          ["social-resize", "Social media resize", "Exact sizes for every platform"],
          ["passport-photo", "Passport / ID photo", "Standard passport and visa sizes"],
          ["image-to-base64", "Image to Base64", "Get a data URI or .txt"],
          ["favicon", "Favicon generator", "Make every icon size you need"],
          ["image-dpi", "Image DPI", "Set print resolution from 40 to 5000 DPI"],
          ["color-picker", "Colour picker", "Read exact colours from a photo"],
          ["palette", "Colour palette", "Extract the dominant colours"],
          ["exif-viewer", "EXIF viewer", "See the metadata hidden in a photo"],
          ["strip-exif", "Strip metadata", "Remove EXIF, GPS and timestamps"],
        ],
      },
    ],
  },
];

/* Flat list with category + group attached, in registry order. */
export const ALL_TOOLS = REGISTRY.flatMap((cat) =>
  cat.groups.flatMap((grp) =>
    grp.tools.map(([id, title, desc]) => ({
      id, title, desc, category: cat.id, categoryName: cat.name, group: grp.name, groupIcon: grp.icon,
    }))
  )
);

export const TOOL_IDS = ALL_TOOLS.map((t) => t.id);

export function toolById(id) {
  return ALL_TOOLS.find((t) => t.id === id);
}
