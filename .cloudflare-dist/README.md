# CBT Analyzer Pro

## Production fixes in this build

- PDF.js is wired into `pdf-to-cbt.html`.
- PDF extraction preserves reading order for common two-column coaching PDFs.
- PDF questions are parsed from numbered questions with `(1)-(4)` or `A-D` options.
- Optional answer-key PDF import is supported.
- Numeric answers (`1-4`) from imported/legacy data are normalized to option text.
- Imported CBT questions are passed through `sessionStorage` into `cbt.html`.
- Saved `TOPPER_TEST_180` is also detected automatically by the CBT page.
- Test 180 requires 180 valid, answer-complete questions before starting.
- PDF pool de-duplicates by question content, not only generated IDs.
- Clearing the PDF pool also clears the saved Test 180/session state.
- Existing CBT scoring, timer, palette, review, result and history pages are retained.

## Recommended workflow

1. Open `pdf-to-cbt.html` on the deployed GitHub Pages site.
2. Select the question-paper PDF.
3. Optionally select the separate answer-key PDF.
4. Click **Convert PDF → CBT**.
5. Confirm the detected question count and answer-key match count.
6. Create Test 180 when at least 180 answer-complete questions are available.
7. Click **Start Test 180**.
8. The complete question set is transferred to `cbt.html`; no fake fallback questions are used.

## Important

The PDF.js library is loaded from cdnjs in this build. Therefore the PDF-import page needs internet access unless PDF.js is later bundled locally. The CBT engine itself uses browser storage and can operate from the already-imported question data.
