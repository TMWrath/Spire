# Image preparation

Image uploads from the main editor's Media upload, template Media upload, and rich-editor `@img` commands open **Prepare image** before upload. Non-image attachments retain their existing flow.

- Click **Insert image** without changing anything to insert the original bytes.
- Crop with edge controls or square, portrait, landscape, widescreen, A4, and Letter presets. Presets apply a centered crop; subsequent manual crop or rotation switches back to Freeform. Rotate first, then choose a preset to retain that crop aspect ratio.
- Fine rotation supports 0.1-degree increments, plus 90-degree steps and horizontal/vertical flips.
- **Diagram scan** estimates local paper brightness, converts marks to black, and removes the paper to transparency in one step. Use **Ink strength** to recover faint strokes or suppress paper texture. The checkerboard indicates transparency. This mode is intended for dark ink/pencil on light paper, not arbitrary foreground segmentation. A smooth synthetic lighting gradient, faint strokes, thick filled shapes, transparent borders, and exported PNG alpha are covered by tests; real photographed diagrams still require hands-on quality review.
- Document and Whiteboard modes estimate local paper illumination to lighten shadows. Black and white and Line art isolate dark marks with a threshold; optional transparency removes the light background.
- Adjust brightness, contrast, saturation, exposure and sharpness. Compare toggles between the untouched original and current edits; it does not change what Insert saves.
- Cancel/Escape causes no upload or document mutation. Reset restores all settings.

Processing runs in the browser. The source photo is never overwritten. Edited copies are PNG with `-edited` in the filename, scaled to at most 4096 pixels on the source's longest edge before rotation; rotation can enlarge the canvas. Edited PNGs exceeding the existing 10 MB attachment limit remain in the dialog with an error. Preview is downscaled; export uses higher resolution. GIF/other animation is preserved only when inserted unchanged; editing creates a still.

This is pixel cleanup, not OCR, handwriting recognition, general object segmentation, page-edge detection, or perspective correction. Crop away the desk/surroundings manually. Faint pencil, colored ink, heavy shadows and textured paper can require threshold/brightness adjustment. Line art is intended for dark marks on a light background. Real camera-photo quality still needs hands-on review.

Verification: `npx tsc --noEmit`; production Vite build; Playwright `image-preparation.spec.ts` (desktop and 390px) and `quick-image.spec.ts` (rich command range/alignment/save-reopen). Existing `image-size.spec.ts` failures were reproduced against unchanged HEAD separately, not classified as new preparation regressions.
