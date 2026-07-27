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

- 2026-07-23
  - Goal: refine the social-media image workflow with double-click preview, visible prompt configuration, and common social aspect-ratio selection.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; Chrome smoke on local `index.html` confirmed default `1:1` ratio options, editable content prompt, readonly high-risk JSON/dynamic prompts, generated `4:5` image result rendering, and double-click image preview.
  - Next: push the tested update to `test/test-main` and run a real n8n generation with each selected social ratio.

- 2026-07-23
  - Goal: restructure the social-media workflow so the text model only generates copy/theme, while image prompts come from user-selected poster/scene templates.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; Chrome smoke on local `index.html` confirmed default 3-slot template assignment, prompt-template add flow, old prompt migration, model response without `imagePrompts`, two template-built n8n image payloads, and result badges.
  - Next: run a real hosted n8n test with one poster slot plus multiple scene slots and tune the default prompt-template wording from real outputs.

- 2026-07-23
  - Goal: move social-media template creation into a complete settings page with standalone template management.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; Chrome smoke on local `index.html` confirmed the main workbench no longer shows the add-template form, settings opens as a full page, templates add/delete correctly, and slot dropdowns sync after template changes.
  - Next: push to `test/test-main` and test the hosted page with real saved template presets.

- 2026-07-24
  - Goal: allow successful social-media images to be regenerated one at a time.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; mocked Chrome smoke generated one image, exposed its regenerate action, and confirmed that clicking it sent one additional image request while retaining a single result card.
  - Next: test a real n8n single-image regeneration from the hosted test page.

- 2026-07-27
  - Goal: upgrade the social-media tool with a simulated social post preview, image loading animation, running-log progress bar, and per-image aspect-ratio controls.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; removed the hardcoded balance account fallback from `js/billing.js` before external push; verified `node --check js/social-media-tool.js`, `node --check js/billing.js`, and `git diff --check`; Chrome smoke on local `index.html` mocked text and n8n calls, confirmed no global ratio select, two per-slot ratio selects, pending loaders, progress at 100%, preview card with generated copy/image, and n8n payloads `1:1 / 1024x1024` plus `9:16 / 720x1280`.
  - Next: push to `test/test-main`, then run one hosted n8n generation with mixed per-image ratios and runtime balance credentials configured.

- 2026-07-27
  - Goal: remove the extra social copy output frame and separate hashtag section so the generated copy and tags live directly inside the simulated post preview.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; verified `git diff --check`; Chrome smoke on local `index.html` confirmed no `社媒文案输出` heading, no `Hashtags` heading, no separate tags node, no outer panel class on the preview output, and generated copy plus tags rendered inside the simulated post.
  - Next: push to `test-main` for hosted visual hand-check.

- 2026-07-27
  - Goal: fix the social-media preview so uploaded product reference images do not appear in the post preview while generation is still pending, and make pending progress/images feel streamed.
  - Status: done.
  - Evidence: updated `js/social-media-tool.js`; verified `node --check js/social-media-tool.js`; verified `git diff --check`; attempted Playwright smoke with bundled runtime, but bundled Chromium was missing and local Chrome run was blocked by the app login overlay before the generate button click.
  - Next: hand-check the hosted test page while running a real social-media image generation.
