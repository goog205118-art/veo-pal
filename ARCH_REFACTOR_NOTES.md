# Veo Studio Frontend V2 - Refactor Notes

## Scope
- Slimming pass includes removal of retired image route surfaces and old node-workflow actions.
- Keep existing entry files and runtime behavior.
- Refactor only foundation layers for future modularization.

## Updated Files
- js/store.js
- js/db.js
- js/api-client.js
- js/dom-utils.js
- js/task-cache.js
- js/canvas-camera.js
- js/canvas-selection.js
- js/viewport-culling.js
- js/minimap.js
- js/workspace-io.js
- js/workspace-inputs.js
- js/canvas-context-menu.js
- js/canvas-cards.js
- js/task-actions.js
- js/task-lifecycle.js
- js/canvas-renderer.js
- js/canvas-interactions.js
- js/selection-toolbar.js
- js/media-utils.js
- js/image-core.js
- js/image-request.js
- js/material-library.js

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

## DOM Utility Layer Changes (Compatible)
- Added `window.VeoDom` for shared text escaping, CSS escaping, safe blob URL cleanup, form state sync, and lightweight card DOM morphing.
- Removed those pure DOM helpers from `js/app.js` while preserving the previous global helper names for inline handlers and older modules.
- Entry pages now load `js/dom-utils.js` before media, image UI, and app orchestration scripts.

## Runtime Task Cache Layer Changes (Compatible)
- Added `window.VeoTaskCache` for live task shadows and debounced image prompt draft persistence.
- Removed task shadow maps and prompt draft timers from `js/app.js` while preserving `setTaskShadow`, `getTaskShadow`, `updateImgGenPromptDraft`, and related global handler names.
- Entry pages now load `js/task-cache.js` before image, video, and app orchestration scripts.

## Canvas Camera Layer Changes (Compatible)
- Added `window.VeoCanvasCamera` for shared transform state, coordinate conversion, zoom/pan, dynamic grid updates, camera animation, minimap wake state, and inertia.
- Reduced `js/app.js` camera functions to compatibility adapters while keeping pointer-selection and card-drag orchestration in the app layer for the next extraction pass.
- Entry pages now load `js/canvas-camera.js` before selection toolbar and app orchestration scripts.

## Canvas Selection Layer Changes (Compatible)
- Added `window.VeoCanvasSelection` for selected task state, marquee lifecycle, marquee hit testing, task toggling, and visible-card select-all.
- Reduced `js/app.js` selection state and marquee update logic while preserving `selectedTasks` as the shared Set used by existing business actions.
- Entry pages now load `js/canvas-selection.js` after `js/canvas-camera.js` and before selection toolbar/app orchestration scripts.

## Viewport Culling Layer Changes (Compatible)
- Added `window.VeoViewportCulling` for card bounds cache, viewport culling checks, and delayed culling updates on large boards.
- Reduced `js/app.js` culling functions to compatibility adapters while keeping task-size rules and business triggers in the app layer.
- Entry pages now load `js/viewport-culling.js` after canvas selection and before selection toolbar/app orchestration scripts.

## Minimap Layer Changes (Compatible)
- Added `window.VeoMinimap` for minimap canvas rendering, viewport-box syncing, and click-to-camera navigation.
- Reduced `js/app.js` minimap functions to compatibility adapters so inline HTML handlers and existing app calls keep working.
- Entry pages now load `js/minimap.js` after viewport culling and before selection toolbar/app orchestration scripts.

## Workspace IO Layer Changes (Compatible)
- Added `window.VeoWorkspaceIO` for `.veo` export serialization, import deserialization, retired-node filtering, save handoff, and post-import refresh.
- Reduced `js/app.js` import/export functions to compatibility adapters for existing button and input handlers.
- Entry pages now load `js/workspace-io.js` after minimap and before selection toolbar/app orchestration scripts.

## Workspace Input Layer Changes (Compatible)
- Added `window.VeoWorkspaceInputs` for clipboard image ingest, viewport file drop, DataTransfer image parsing, and console slot drops.
- Reduced `js/app.js` paste/drop handlers and `parseDroppedImage` to compatibility adapters for existing console and card workflows.
- Entry pages now load `js/workspace-inputs.js` after workspace IO and before selection toolbar/app orchestration scripts.

## Canvas Context Menu Layer Changes (Compatible)
- Added `window.VeoCanvasContextMenu` for card right-click menu rendering, reusable-image detection, console send actions, duplicate/focus/delete dispatch, and global menu close.
- Reduced `js/app.js` context menu helpers to compatibility adapters while cleaning menu labels back to readable Chinese.
- Entry pages now load `js/canvas-context-menu.js` after workspace inputs and before selection toolbar/app orchestration scripts.

## Canvas Card Layer Changes (Compatible)
- Added `window.VeoCanvasCards` for image-card frame sizing, resize persistence, refresh fingerprint snapshots, and `data-sync-*` attribute writes.
- Removed duplicate card refresh fingerprint logic from `renderCard` and `renderBoard` while preserving the existing compatibility helper names.
- Entry pages now load `js/canvas-cards.js` after the context menu module and before selection toolbar/app orchestration scripts.

## Task Action Layer Changes (Compatible)
- Added `window.VeoTaskActions` for default image-node creation, selected-card duplication, and image-generation clone cleanup.
- Reduced `js/app.js` task action helpers to compatibility adapters while keeping existing button, menu, and shortcut callers intact.
- Alt-drag cloning now reuses the same duplicate payload builder to avoid divergent shallow-copy behavior.
- Entry pages now load `js/task-actions.js` after canvas cards and before selection toolbar/app orchestration scripts.

## Task Lifecycle Layer Changes (Compatible)
- Added `window.VeoTaskLifecycle` for selected-task deletion, single-card removal, runtime cleanup, and post-delete canvas refresh.
- Reduced `js/app.js` delete helpers to compatibility adapters while preserving toolbar, shortcut, card-button, and context-menu callers.
- Batch delete now fetches all tasks once before removing direct children, avoiding repeated IndexedDB scans on large workspaces.
- Entry pages now load `js/task-lifecycle.js` after task actions and before selection toolbar/app orchestration scripts.

## Canvas Renderer Layer Changes (Compatible)
- Added `window.VeoCanvasRenderer` for card HTML dispatch, single-card refresh, board reconciliation, polling resume, and post-render canvas refresh.
- Reduced `js/app.js` `renderCard`, `generateCardHTML`, and `renderBoard` to compatibility adapters while preserving global callers from image/video modules.
- Canvas rendering is now a replaceable layer for the upcoming workspace UI redesign.
- Entry pages now load `js/canvas-renderer.js` after task lifecycle and before selection toolbar/app orchestration scripts.

## Canvas Interaction Layer Changes (Compatible)
- Added `window.VeoCanvasInteractions` for pointer tracking, canvas pan/marquee, wheel zoom/pan, resize refresh, keyboard shortcuts, and card header drag orchestration.
- Reduced `js/app.js` mouse, wheel, resize, keyboard, and card-drag blocks to compatibility adapters while keeping Alt-drag clone behavior intact.
- Entry pages now load `js/canvas-interactions.js` after canvas renderer and before selection toolbar/app orchestration scripts.

## Selection Toolbar Layer Changes (Compatible)
- Added `window.VeoSelectionToolbar` for selected-card lookup, toolbar creation, action dispatch, positioning, and animation-frame update scheduling.
- Reduced `js/app.js` to selection context adapters so future workspace layout changes can replace the toolbar without touching canvas selection state.
- Entry pages now load `js/selection-toolbar.js` immediately before `js/app.js`.

## Media Utility Layer Changes (Compatible)
- Added `window.VeoMedia` for image generation route config, reference intent metadata, media encoding helpers, and image metadata reads.
- `js/app.js` keeps previous helper names as compatibility wrappers while delegating reusable media logic to `js/media-utils.js`.
- Entry pages now load `js/media-utils.js` before `js/app.js`.

## Image Core Layer Changes (Compatible)
- Added `window.VeoImageCore` for image size rules, route/model adapters, mode detection, usage extraction, and cost calculation.
- `js/app.js` keeps the previous helper names while delegating reusable image-generation rules to `js/image-core.js`.
- Entry pages now load `js/image-core.js` after `js/media-utils.js` and before `js/app.js`.

## Image Request Layer Changes (Compatible)
- Added `window.VeoImageRequest` for prompt context, output compression normalization, encoded payload sizing, unified image payload construction, and single-submit transport.
- `js/image-submit.js` now focuses more on submit orchestration and preview persistence.
- Entry pages now load `js/image-request.js` before `js/image-submit.js`.

## Image Route Slimming
- Removed the retired image channel from UI labels, task defaults, request payloads, polling payloads, and billing metadata.
- Image generation now normalizes to the GPT Image 2 unified route only.
- Removed V1-4 variant node creation and preview-to-cropper actions to avoid spawning retired frame/cropper workflow nodes.
- Kept `RETIRED_NODE_TYPES` as a migration guard so existing old node data stays filtered.

## Material Library Layer Changes (Compatible)
- Added `window.VeoMaterials` for the global material drawer, grouped material rendering, duplicate cleanup, delete, and clear actions.
- `js/app.js` keeps the previous inline handler names while delegating material-library behavior to `js/material-library.js`.
- Entry pages now load `js/material-library.js` before `js/app.js`.

## Runtime Validation
- `node --check js/store.js`: pass
- `node --check js/db.js`: pass
- `node --check js/api-client.js`: pass
- `node --check js/dom-utils.js`: pass
- `node --check js/task-cache.js`: pass
- `node --check js/canvas-camera.js`: pass
- `node --check js/canvas-selection.js`: pass
- `node --check js/viewport-culling.js`: pass
- `node --check js/minimap.js`: pass
- `node --check js/workspace-io.js`: pass
- `node --check js/workspace-inputs.js`: pass
- `node --check js/canvas-context-menu.js`: pass
- `node --check js/canvas-cards.js`: pass
- `node --check js/task-actions.js`: pass
- `node --check js/task-lifecycle.js`: pass
- `node --check js/canvas-renderer.js`: pass
- `node --check js/selection-toolbar.js`: pass
- `node --check js/media-utils.js`: pass
- `node --check js/image-core.js`: pass
- `node --check js/image-request.js`: pass
- `node --check js/image-preview-actions.js`: pass
- `node --check js/image-ui.js`: pass
- `node --check js/material-library.js`: pass
- `node --check js/app.js`: pass
- Retired canvas-flow runtime removed in slimming pass; no legacy runtime check remains.

## Compatibility Notes
- `db` starts as `undefined` before `initDB` success, preserving old guard behavior for app storage paths.
- `globalStore.getState()` still returns live state reference to avoid breaking existing direct mutations.

## Next Suggested Refactor Steps
1. Continue moving app state orchestration out of `js/app.js` behind predictable global adapters.
2. Extract billing/task polling modules so model routing and usage tracking can evolve independently.
3. Redesign the studio workspace layout around faster task switching, denser controls, and clearer model routing.
