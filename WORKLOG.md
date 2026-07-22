# WORKLOG

- 2026-07-22
  - Goal: simplify the image-gen card by removing seed/retry controls, making prompt Enter-to-submit, and dropping the extra running animations.
  - Status: in progress.
  - Evidence: inspected `js/image-ui.js`, `js/image-submit.js`, `js/image-interactions.js`, `js/image-normalize.js`, `js/image-preview-ui.js`, and both CSS entry points.
  - Next: patch the image-gen state/request/UI flow, then verify the rendered card and submit path.

- 2026-07-22
  - Goal: keep manual retry after image failures, remove advanced auto-retry, and let prompt Enter submit directly.
  - Status: done.
  - Evidence: updated `js/image-ui.js`, `js/image-preview-ui.js`, `js/image-interactions.js`, `css/style.css`, and `js/css/style.css`; verified with `node --check` on `js/image-ui.js`, `js/image-preview-ui.js`, `js/image-interactions.js`, and `js/image-submit.js`.
  - Next: smoke-test the image-gen card in the browser and confirm the failed preview retry button still submits a fresh run.
