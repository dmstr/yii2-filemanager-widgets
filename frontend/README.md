# frontend

Source of the Vue 3 file manager behind `FileManagerWidget`. Nothing here is shipped to browsers; `yarn build` writes `../src/assets/dist/filemanager.js` (IIFE, Vue included), `../src/assets/dist/filemanager.css` and `../src/assets/dist/filemanager.licenses.txt`, which are committed. The notice file carries the licence texts of what is compiled into the two bundles (Vue and the other packages found in the bundle, read from `node_modules` at build time, plus the `build/*.license.txt` texts of the code the stylesheet and components derive from), and a banner comment at the top of `filemanager.js` and `filemanager.css` points to it. `FileManagerAsset` publishes it next to them.

The file manager is the port of the AngularJS frontend of version 1.x of this package; the 1.x tags of this repository still contain that code.

Use yarn classic (1.x) and Node `^22.22.2 || ^24.15.0 || >=26`; `jsdom` and a few of its dependencies declare that range, CI runs Node 26. On any other Node (for example the odd-numbered 25.x line) `yarn install` stops with "The engine \"node\" is incompatible with this module"; either switch to a supported Node or install with `yarn install --ignore-engines`. The scripts themselves run on such a Node without the flag.

## Layout

- `src/`: the Vue app. `src/styles/filemanager.less` is the stylesheet entry; it scopes `base.less` (the stylesheet inherited from the AngularJS version) to `<hrzg-filemanager>` and adds `custom.less`.
- `build/`: the Vite plugin `licenses.ts` that emits the notice file, and the notice texts `angular-filemanager.license.txt` and `isteven-multi-select.license.txt` it appends (every `*.license.txt` in this directory is picked up).
- `tests/`: Vitest specs, their helpers (`tests/utils/`, `tests/services/helpers.ts`, `tests/components/helpers.ts`) and the recorded fixtures in `tests/fixtures/`.

## Commands

- `yarn build`: build the three files above. Other files in `dist/` are left untouched. To check a build without touching `dist/`: `yarn vite build --outDir <tmpdir> --emptyOutDir`. The output is deterministic (no timestamps, no absolute paths), so two builds are byte-identical.
- `yarn test`: Vitest (jsdom).
- `yarn typecheck`: `vue-tsc --noEmit`.

There is no dev server. To try a change in a running application, run `yarn build` and reload the page: the Yii2 asset bundle loads the built files from `src/assets/dist/` (when the host application publishes assets by copy, clear its published asset directory first). The unit tests cover the components and services without a browser.

## Tests and fixtures

Specs sit in `tests/`, in the same layout as `src/`. They mount components with `@vue/test-utils` in jsdom and stub `fetch` and `XMLHttpRequest`; no spec talks to a server.

The behaviour carried over from the AngularJS frontend is pinned by fixtures in `tests/fixtures/`: outputs recorded from that frontend while its code was still in the repository (filter and helper results, request bodies, selection sequences, the navigator tree, the rendered states of the multi-select directive, the dialog markup, the translation keys). A spec replays the same inputs on the port and compares against the recording. The fixtures are not regenerated; when a behaviour is changed on purpose, the fixture entry is edited or replaced by an explicit expectation in the spec. `tests/fixtures/README.md` lists the files, `tests/utils/fixtures.ts` reads them.

Quirks of the AngularJS frontend that the port keeps, or deliberately fixes, are marked in code and specs with a `Q-<number>` and a description of the quirk.

## Continuous integration

`.github/workflows/frontend.yml` runs on pull requests and on pushes to `master` that touch `frontend/`, `src/assets/dist/` or the workflow itself. It installs with `yarn install --frozen-lockfile` on Node 26, runs `yarn typecheck`, `yarn test` and `yarn build`, and fails when `git status` shows any change in `src/assets/dist/`: a fresh `filemanager.js`, `filemanager.css` or `filemanager.licenses.txt` that differs from the committed one, or an untracked file the build left there. Composer installs the package from the git tag without a build step, so after changing anything under `frontend/` run `yarn build` and commit the three files.
