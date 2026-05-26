# Veo Studio Frontend V2 - Refactor Notes

## Scope
- No feature change.
- Keep existing entry files and runtime behavior.
- Refactor only foundation layers for future modularization.

## Updated Files
- js/store.js
- js/db.js

## Store Layer Changes (Compatible)
- Replaced simple EventBus with safer implementation:
  - Added `off`, `once`, `clear`.
  - Added per-listener try/catch to isolate runtime errors.
- Kept globals and API names unchanged:
  - `sysBus`
  - `globalStore`
  - `globalStore.dispatch(...)`
  - `globalStore.getState()`
- Added internal mutation table for stable action routing.
- Added media/state actions for console workflow:
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
- `js/app.js` has been restored to the source-equivalent version to ensure feature completeness and preserve original UI text behavior.

## Runtime Validation
- `node --check js/store.js`: pass
- `node --check js/db.js`: pass
- `node --check js/app.js`: pass (source-equivalent)
- `node --check js/flow/flow-engine.js`: pass

## Compatibility Notes
- `db` starts as `undefined` before `initDB` success, preserving old guard behavior in `flow-engine.js`.
- `globalStore.getState()` still returns live state reference to avoid breaking existing direct mutations.

## Next Suggested Refactor Steps
1. Refactor should proceed from source-equivalent `app.js` baseline to avoid feature drift.
2. Isolate node execution scheduling from DOM rendering in `flow-engine.js`.
3. Split material library logic into dedicated module shared by `app.js` and `flow-engine.js`.
