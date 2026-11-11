# frontend

Source of the Vue 3 file manager. It replaces the AngularJS bundle behind `FileManagerWidget`. Nothing here is shipped to browsers; `yarn build` writes `../src/assets/dist/filemanager.js` (IIFE, Vue included), `../src/assets/dist/filemanager.css` and `../src/assets/dist/filemanager.licenses.txt`, which are committed. The notice file carries the licence texts of what is compiled into the two bundles (Vue and the other packages found in the bundle, read from `node_modules` at build time, plus the committed texts in `licenses/`), and a banner comment at the top of `filemanager.js` and `filemanager.css` points to it. `FileManagerAsset` publishes it next to them.

Use yarn classic (1.x) and Node `^22.22.2 || ^24.15.0 || >=26`; `jsdom` and a few of its dependencies declare that range, CI runs Node 26. On any other Node (for example the odd-numbered 25.x line) `yarn install` stops with "The engine \"node\" is incompatible with this module"; either switch to a supported Node or install with `yarn install --ignore-engines`. The scripts themselves run on such a Node without the flag.

## Layout

- `src/`: the Vue app. `src/styles/filemanager.less` is the stylesheet entry; it scopes `base.less` (the stylesheet inherited from the AngularJS version) to `<hrzg-filemanager>` and adds `custom.less`.
- `legacy/`: the AngularJS 1.x frontend of version 1.x and its libraries, unmodified, never shipped; see `legacy/README.md`. Read by the tests.
- `build/`: the Vite plugin that emits the notice file. `licenses/`: committed licence texts of code derived into the bundle. `tests/`: Vitest specs.

## Commands

- `yarn build`: build the three files above. Other files in `dist/` are left untouched. To check a build without touching `dist/`: `yarn vite build --outDir <tmpdir> --emptyOutDir`. The output is deterministic (no timestamps, no absolute paths), so two builds are byte-identical.
- `yarn test`: Vitest (jsdom).
- `yarn typecheck`: `vue-tsc --noEmit`.

## Continuous integration

`.github/workflows/frontend.yml` runs on pull requests and on pushes to `master` that touch `frontend/`, `src/assets/dist/` or the workflow itself. It installs with `yarn install --frozen-lockfile` on Node 26, runs `yarn typecheck`, `yarn test` and `yarn build`, and fails when `git status` shows any change in `src/assets/dist/`: a fresh `filemanager.js`, `filemanager.css` or `filemanager.licenses.txt` that differs from the committed one, or an untracked file the build left there. Composer installs the package from the git tag without a build step, so after changing anything under `frontend/` run `yarn build` and commit the three files.
