# frontend

Source of the Vue 3 file manager. It replaces the AngularJS bundle behind `FileManagerWidget`. Nothing here is shipped to browsers; `yarn build` writes `../src/assets/dist/filemanager.js` (IIFE, Vue included), `../src/assets/dist/filemanager.css` and `../src/assets/dist/filemanager.licenses.txt`, which are committed. The notice file carries the licence texts of what is compiled into the two bundles (Vue and the other packages found in the bundle, read from `node_modules` at build time, plus the committed texts in `licenses/`), and a banner comment at the top of `filemanager.js` and `filemanager.css` points to it. `FileManagerAsset` publishes it next to them.

Use yarn classic (1.x) and Node `^22.22.2 || ^24.15.0 || >=26`; `jsdom` and a few of its dependencies declare that range, CI runs Node 26. On any other Node (for example the odd-numbered 25.x line) `yarn install` stops with "The engine \"node\" is incompatible with this module"; either switch to a supported Node or install with `yarn install --ignore-engines`. The scripts themselves run on such a Node without the flag.

## Layout

- `src/`: the Vue app. `src/styles/filemanager.less` is the stylesheet entry; it scopes `base.less` (the stylesheet inherited from the AngularJS version) to `<hrzg-filemanager>` and adds `custom.less`.
- `legacy/`: the AngularJS 1.x frontend of version 1.x and its libraries, unmodified, never shipped; see `legacy/README.md`. Read by the tests, the legacy dev page and the parity tool.
- `dev/`: dev harness (mock API, both pages, parity tool). `tests/`: Vitest specs.

## Commands

- `yarn dev`: Vite dev server with HMR and the mock API.
- `yarn build`: build the three files above. Other files in `dist/` are left untouched. To check a build without touching `dist/`: `yarn vite build --outDir <tmpdir> --emptyOutDir`. The output is deterministic (no timestamps, no absolute paths), so two builds are byte-identical.
- `yarn test`: Vitest (jsdom).
- `yarn typecheck`: `vue-tsc --noEmit`.
- `yarn parity`: legacy-versus-Vue comparison, see below.

## Dev harness

Both pages talk to the same in-memory mock of the filefly API (`dev/mock-api.ts`, mounted at `/mock/api`). `POST /mock/reset` restores the seed data.

- http://localhost:5173/dev/index.html: the Vue app.
- http://localhost:5173/dev/legacy.html: the untouched legacy AngularJS app, for side-by-side comparison.

Optional query flags on both pages: `?allow=rename,changePermissions` enables actions the widget switches off by default, `?editable=1` makes `.txt` and `.svg` editable, `?preview=1` enables the icon preview view, `?thumbs=1` enables image thumbnails, `?perms=1` shows the permissions column, `?pick=1` enables `pickFiles`/`pickFolders` with a logging `pickCallback`, `?custom=1` adds one custom file action and one custom folder action, `?deny=compressChooseName` (a comma-separated list) turns those `allowedActions` off, `?async=1` sets `compressAsync` and `extractAsync`. Error states of the mock API: list path `/__error__` (HTTP 500 with `result.error`), a request header `X-Mock-Error: <status>` or the query parameter `mockError=<status>` (any request fails with `error.message`); `X-Mock-Delay: <ms>` delays the answer, and `GET /mock/state` dumps the store (paths, types, sizes, permissions), which the parity tool compares.

## Parity tool

`dev/parity/` drives the legacy page and the Vue page through the same scenarios (all three views, navigation, empty and error states, search, sorting, selection gestures, the context menu with its position, the two navbar dropdowns, drag-over, and every dialog: open, close, submit, error and edge cases) in headless Chromium at the same viewport. At every step it compares the DOM inside the root element (`<angular-filemanager>` on the legacy page, `<hrzg-filemanager>` on the Vue page, the two names count as equal): tag names, classes, all attributes, relevant inline style, visibility, field values, the focused element, normalised text and the layout box of every visible element (tolerance 1 px), which also catches whitespace differences between inline elements. Besides the DOM it compares the page around the root (body class and inline style, modal backdrops, focus outside the root), the API requests both pages sent, the mock's data afterwards, values a scenario records (the clipboard text, for example) and the screenshots pixel by pixel (channel differences of up to 8 levels count as compositing noise). What only AngularJS adds is removed first (comments, `ng-*`/`ngf-*` attributes and classes, template scripts, `data-toggle`), and an element hidden by `ng-hide` equals one hidden by `v-show`. Differences print as a readable diff and make the exit code 1; an unreachable dev server gives exit code 2. A full run takes about 12 minutes.

```sh
yarn dev                                  # in one terminal, serves the harness on :5173
yarn parity                               # all scenarios
yarn parity --only context-menu,sort-name # scenarios whose name starts with one of these
yarn parity --list                        # names only
yarn parity --exclude-dialogs             # stub the dialogs, compare only the main screen
node dev/parity/parity.mjs --base http://localhost:5199 --headed
```

Options: `--base <url>` (default `http://localhost:5173`; use it when the dev server runs on another port), `--only <a,b>`, `--list`, `--exclude-dialogs`, `--headed`, `--viewport <WxH>` (default `1280x800`), `--max-diffs <n>` (default 60 lines per DOM comparison), `--out <dir>` (default `dev/parity/out/`, git-ignored; screenshots land there as `<scenario>.<legacy|vue>[.<step>].png`) and `--dump`, which prints the page state, the requests and the recorded values of every legacy step to show what a scenario really exercised. The environment variable `PARITY_WAIT` sets the pause in milliseconds before each snapshot (default 150). Playwright needs its Chromium once: `yarn playwright install chromium`.

The dialogs are part of the comparison by default. With `--exclude-dialogs` (or `EXCLUDE_DIALOGS` set to `true` in `dev/parity/snapshot.mjs`) the subtree of the dialogs, the legacy `modals.html` wrapper (third child of the root div), is replaced by a stub on both sides. A known difference that is a decided deviation from the legacy behaviour is recorded in the scenario in `dev/parity/scenarios.mjs`: its `known` list holds `{ pattern, reason }` entries, a diff line matching a `pattern` is printed as known with its `reason` instead of failing the scenario, and the pixel comparison of the screenshots runs only on steps where no other difference was found, not even a known one. A Ctrl-click is a right-click on macOS, so the context menu scenarios use Cmd there.

## Continuous integration

`.github/workflows/frontend.yml` runs on pull requests and on pushes to `master` that touch `frontend/`, `src/assets/dist/` or the workflow itself. It installs with `yarn install --frozen-lockfile` on Node 26, runs `yarn typecheck`, `yarn test` and `yarn build`, and fails when `git status` shows any change in `src/assets/dist/`: a fresh `filemanager.js`, `filemanager.css` or `filemanager.licenses.txt` that differs from the committed one, or an untracked file the build left there. Composer installs the package from the git tag without a build step, so after changing anything under `frontend/` run `yarn build` and commit the three files.
