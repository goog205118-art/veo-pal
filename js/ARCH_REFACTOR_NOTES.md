# Veo Studio Frontend V2 - Refactor Notes

## Scope
- No feature change.
- Keep existing entry files and runtime behavior.
- Refactor only foundation layers for future modularization.

## Updated Files
- js/store.js
- js/db.js
- js/api-client.js
- js/media-utils.js
- js/material-library.js
- js/billing.js
- js/video-tasks.js
- js/image-request.js

## Store Layer Changes (Compatible)
- Replaced simple EventBus with safer implementation:
  - Added `off`, `once`, `clear`.
  - Added per-listener try/catch to isolate runtime errors.
- Kept globals and API names unchanged:
  - `sysBus`
  - `globalStore`
  - `globalStore.dispatch(...)`
  - `globalStore.getState()`
- Added internal mutation table for predictable action routing.
- Added media/state actions for console control:
  - `SET_FIRST_FRAME`
  - `SET_LAST_FRAME`
  - `SET_REFERENCES`
  - `ADD_REFERENCE`
  - `REMOVE_REFERENCE_AT`
  - `HYDRATE_MEDIA_STATE`
  - `RESET_MEDIA`

## DB Layer Changes (Compatible)
- Kept all previous global APIs unchanged:
  - `initDB`
  - `addBillingRecord`
  - `getBillingStats`
  - `getBlobUrl`
  - `compressImageToBlob`
  - `blobToBase64`
  - `getAllTasksDB`
  - `saveTaskDB`
  - `getTaskDB`
  - `deleteTaskDB`
- Added `VeoDB` repository object for decoupled future integration.
- Added defensive guards and unified transaction wrapper.

## App Layer Note
- `js/app.js` now delegates webhook config, auth headers, endpoint checks, and n8n HTTP calls to `window.VeoApi`.
- Existing constants and helper names remain as compatibility wrappers for inline handlers and older app code.

## API Client Layer Changes (Compatible)
- Added `window.VeoApi` as the shared frontend API layer.
- Centralized video submit/poll and image submit/poll requests.
- Centralized image webhook endpoint normalization and response parsing.
- Entry pages now load `js/api-client.js` between `store.js` and `app.js`.

## Media Utility Layer Changes (Compatible)
- Added `window.VeoMedia` for image generation route config, reference intent metadata, media encoding helpers, and image metadata reads.
- `js/app.js` keeps previous helper names as compatibility wrappers while delegating reusable media logic to `js/media-utils.js`.
- Entry pages now load `js/media-utils.js` before `js/app.js`.

## Image Core Layer Changes (Compatible)
- Added `window.VeoImageCore` for image size rules, route/model adapters, mode detection, usage extraction, and cost calculation.
- `js/app.js` keeps previous helper names while delegating reusable image-generation rules to `js/image-core.js`.
- Entry pages now load `js/image-core.js` after `js/media-utils.js` and before `js/app.js`.

## Material Library Layer Changes (Compatible)
- Added `window.VeoMaterials` for the global material drawer, grouped material rendering, duplicate cleanup, delete, and clear actions.
- `js/app.js` keeps the previous inline handler names while delegating material-library behavior to `js/material-library.js`.
- Entry pages now load `js/material-library.js` before `js/app.js`.

## Billing UI Layer Changes (Compatible)
- Added `window.VeoBilling` for the billing top bar, billing modal, video cost estimate, and batch-count UI.
- `js/app.js` keeps the previous inline handler names while delegating billing UI behavior to `js/billing.js`.
- Entry pages now load `js/billing.js` before `js/app.js`.
- IndexedDB upgraded to version 5 and deletes the retired `flow_workspaces` object store during upgrade.

## Video Task Layer Changes (Compatible)
- Added `window.VeoVideoTasks` for video submission, retry, polling, billing handoff, and active polling state.
- `js/app.js` keeps the previous inline handler names while delegating video task behavior to `js/video-tasks.js`.
- Entry pages now load `js/video-tasks.js` before `js/app.js`.

## Image Request Layer Changes (Compatible)
- Added `window.VeoImageRequest` for prompt context, output compression normalization, encoded payload sizing, unified image payload construction, and single-submit transport.
- `js/image-submit.js` now focuses more on submit orchestration and preview persistence.
- Entry pages now load `js/image-request.js` before `js/image-submit.js`.

## Runtime Validation
- `node --check js/store.js`: pass
- `node --check js/db.js`: pass
- `node --check js/api-client.js`: pass
- `node --check js/media-utils.js`: pass
- `node --check js/image-core.js`: pass
- `node --check js/material-library.js`: pass
- `node --check js/billing.js`: pass
- `node --check js/video-tasks.js`: pass
- `node --check js/image-request.js`: pass
- `node --check js/app.js`: pass
- Retired canvas-flow runtime removed in slimming pass; no legacy runtime check remains.

## Compatibility Notes
- `db` starts as `undefined` before `initDB` success, preserving old guard behavior for app storage paths.
- `globalStore.getState()` still returns live state reference to avoid breaking existing direct mutations.

## Next Suggested Refactor Steps
1. Continue moving app state orchestration out of `js/app.js` behind predictable global adapters.
2. Extract image generation polling modules so model routing and usage tracking can evolve independently.
3. Redesign the studio workspace layout around faster task switching, denser controls, and clearer model routing.
