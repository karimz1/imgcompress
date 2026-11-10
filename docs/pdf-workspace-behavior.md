# PDF workspace behavior

This is the behavior contract agreed with the user. The PDF workspace is part of ImgCompress and must follow its existing editing and download flows.

## Entry and modes

- PDF modes appear only when PDF is the selected output format. The workspace entry is available after files have been imported.
- **Convert** exposes the existing paper format, margins, fit/fill, pagination and quality/DPI settings. Its workspace previews the prepared output pages.
- **Merge only** preserves original page sizes and does not impose the conversion mode's paper settings.
- Both modes share one page selection. Switching tabs must not discard excluded pages, order, rotation, or the user's saved selection.
- When output settings require preparing pages again, carry the selection forward by source file, source page and generated part. If pagination collapses several parts into one page, include that source page when any of its parts was included.

## Editor and selection lifecycle

- Closing the editor, including X and Escape, applies the current valid selection, like the other ImgCompress editors. An explicit **Apply selection** button may do the same.
- Applying or closing does not generate or download a PDF.
- The workspace is an editor. Start export from the main create/convert action; show finished files in the existing downloads drawer.
- Keep the selection in memory after successful conversion and across both PDF tabs. Only explicit Clear/discard or a full reload removes it.
- The main PDF panel clearly displays that a selection exists, its page count, and a Clear action.
- The normal create/convert action and the merge action use the same current selected pages. Repeated creation must not fall back to all source pages.
- Creating a PDF does not consume the selection. Users can continue editing and create it again.
- Clearing the main file selection clears the PDF selection too. Clearing only the PDF selection may keep the imported source files.
- Reimporting different files with the same filename must not confuse their source identity.
- The upload list is shared by both PDF tabs and the workspace. Importing inside the workspace also adds the source to that list; removing a source there removes its pages from the editor and saved selection. Do not maintain a disconnected second source list.

## Downloads drawer

- The existing drawer shows completed downloadable files only.
- Do not put unbuilt PDF plans, an editor, **Keep editing**, or **Create PDF** controls into the downloads drawer.
- Edit from the normal PDF workspace panel; close the drawer as usual.
- PDF results must be described as files/PDFs, not as a converted image.
- Keep the saved selection after a result appears in the drawer. Recreating the same named PDF should replace its download result rather than accumulate duplicate rows.

## Page editing and preview

- Dragging works on the thumbnail and surrounding non-interactive card area. Cards follow the pointer and neighboring pages animate into place.
- Keep checkbox exclusion, rotation, delete, undo, and move buttons usable independently of dragging. Touch users can hold and drag; Escape cancels a drag without closing the editor.
- Enlarge and delete controls are visible on each thumbnail.
- The enlarged document viewer scrolls through the ordered pages continuously and provides previous/next, a page number field, and a thumbnail navigation rail on wider screens.
- The enlarged viewer's thumbnail rail has an include/exclude checkbox for every page. The same checkbox is available by each full-size page so it works on narrow screens too. Both update the editor's shared selection immediately.
- Provide percentage zoom up to 400%, plus fit page and fit width. Zoomed pages must scroll instead of remaining constrained inside a fixed image box.
- Display actual output paper formats such as A4/Letter, orientation and dimensions. This is a paper-size label, not an AI classification.
- Fetch detailed rasters only near the viewport and bound preview resolution and memory.

## Raster export and OCR

- Rebuild exported pages from raster images. Do not copy source PDF scripts, attachments or interactive objects.
- OCR is optional and off by default. Do not automatically focus/highlight its checkbox or add an extra tooltip.
- Local OCR recognizes the newly rendered pixels and adds a fresh searchable text layer. It does not reuse source PDF text.
- Keep OCR unavailable with a clear inline explanation when Tesseract or language data is missing; do not download models at runtime.

## Errors and validation

- A network or conversion error must keep the selection and remain recoverable in the normal UI. Do not lose the editor state or navigate to a fatal screen for a failed PDF request.
- Test successful and repeated creation, tab changes, Clear, download-only drawer behavior, zoom/navigation, paper-size labels, and failure/retry.
- Keep all supported translations complete. Add focused CI coverage, including real OCR where the engine is installed, alongside the existing full pipeline.

## Delivery for this feature

- Work on `feature/pdf-workspace-selection-viewer` in focused commits.
- Track the work in issue #1032 and milestone v1.1.0.
- Publish a draft pull request; do not merge or deploy the feature as part of this task.
