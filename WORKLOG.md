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

- 2026-07-23
  - Goal: integrate the desktop social-media content tool into the workbench while keeping text-model calls unchanged and routing image generation through the existing n8n image endpoint.
  - Status: done.
  - Evidence: added `js/social-media-tool.js`, wired the 社媒 top-bar entry in `index.html`, `studio.html`, and `js/index.html`; verified `node --check js/social-media-tool.js`; browser smoke on `index.html` confirmed `window.VeoSocialMediaTool`, `window.VeoApi`, helper parsers, default `stable_channel_1`, and modal rendering; pushed commit `03b8690` to `test/test-main`.
  - Next: test a real Gemini text key plus n8n image run from the UI, then tune prompt presets if the generated copy/image prompts need a stronger house style.

- 2026-07-23
  - Goal: optimize the social-media tool modal with non-overlapping header actions, parallel workspaces, per-image retry, guidance-link input, and copy-with-tags behavior.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; Playwright smoke on local `index.html` confirmed modal open, workspace count 1 -> 2, workspace input restoration, guidance-link input, retry button rendering, copy button text, and no settings/close overlap.
  - Next: push the tested update to `test/test-main`, then run a real n8n image-failure retry from the hosted test page.
