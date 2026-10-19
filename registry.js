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
          ["compress", "Compress PDF", "Shrink file size with quality presets"],
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
          ["pdf-to-jpg", "PDF to JPG", "Render pages to images"],
          ["text-to-pdf", "Text to PDF", "Turn pasted text into a clean PDF"],
          ["scan-to-pdf", "Scan to PDF", "Camera scan with filters and a page editor"],
          ["extract-text", "Extract text", "Read the selectable text out of a PDF"],
          ["pdf-to-markdown", "PDF to Markdown", "Convert to headings, lists and tables"],
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
    tagline: "Everything you can do to photos and images.",
    groups: [
      {
        name: "Convert",
        icon: "⇄",
        tools: [
          ["convert-image", "Convert image", "JPG ⇄ PNG ⇄ WebP"],
          ["image-to-base64", "Image to Base64", "Get a data URI or .txt"],
          ["favicon", "Favicon generator", "Make every icon size you need"],
        ],
      },
      {
        name: "Optimise",
        icon: "⚙",
        tools: [
          ["compress-image", "Compress image", "Shrink photos with quality control"],
          ["resize-image", "Resize image", "Set width, height or a percentage"],
        ],
      },
      {
        name: "Edit & filters",
        icon: "✎",
        tools: [
          ["image-filters", "Photo filters", "Preset looks with before/after preview"],
          ["adjust-image", "Adjust image", "Brightness, contrast, saturation, hue, blur"],
          ["sharpen-image", "Sharpen or blur", "Make a photo crisper or softer"],
          ["crop-image", "Crop image", "Trim edges by percentage"],
          ["rotate-image", "Rotate & flip", "Rotate and mirror an image"],
          ["grayscale-image", "Grayscale image", "Turn a photo black and white"],
          ["image-watermark", "Watermark image", "Stamp text across a photo"],
          ["add-text-to-image", "Add text", "Write text on a photo"],
          ["image-border", "Add border", "Frame a photo"],
          ["collage", "Collage", "Arrange photos into a grid"],
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
