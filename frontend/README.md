# frontend

Source of the Vue 3 file manager. It replaces the AngularJS bundle behind `FileManagerWidget`. Nothing here is shipped to browsers; `yarn build` writes `../src/assets/dist/filemanager.js` (IIFE, Vue included) and `../src/assets/dist/filemanager.css`, which are committed.

Use Node 20.19+/22.12+ and yarn classic (1.x).

## Commands

- `yarn dev`: Vite dev server with HMR and the mock API.
- `yarn build`: build the two files above. Other files in `dist/` are left untouched.
- `yarn test`: Vitest (jsdom).
- `yarn typecheck`: `vue-tsc --noEmit`.
- `yarn parity`: legacy-versus-Vue comparison, see below.

## Dev harness

Both pages talk to the same in-memory mock of the filefly API (`dev/mock-api.ts`, mounted at `/mock/api`). `POST /mock/reset` restores the seed data.

- http://localhost:5173/dev/index.html: the Vue app.
- http://localhost:5173/dev/legacy.html: the untouched legacy AngularJS app, for side-by-side comparison.

Optional query flags on both pages: `?allow=rename,changePermissions` enables actions the widget switches off by default, `?editable=1` makes `.txt` and `.svg` editable, `?preview=1` enables the icon preview view, `?thumbs=1` enables image thumbnails, `?perms=1` shows the permissions column, `?pick=1` enables `pickFiles`/`pickFolders` with a logging `pickCallback`, `?custom=1` adds one custom file action and one custom folder action. Error states: list path `/__error__`, or a request header `X-Mock-Error: <status>`.

## Parity tool

`dev/parity/` drives the legacy page and the Vue page through the same scenarios (all three views, navigation, empty and error states, search, sorting, selection gestures, the context menu with its position, the two navbar dropdowns, drag-over) in headless Chromium at the same viewport. For each scenario it saves a screenshot of both pages and compares the DOM inside the root element (`<angular-filemanager>` on the legacy page, `<hrzg-filemanager>` on the Vue page, the two names count as equal): tag names, classes, all attributes, relevant inline style, visibility, normalised text and the layout box of every visible element (tolerance 1 px), which also catches whitespace differences between inline elements. What only AngularJS adds is removed first (comments, `ng-*`/`ngf-*` attributes and classes, template scripts, `data-toggle`), and an element hidden by `ng-hide` equals one hidden by `v-show`. Differences print as a readable diff and make the exit code 1.

```sh
yarn dev                                  # in one terminal, serves the harness on :5173
yarn parity                               # all scenarios
yarn parity --only context-menu,sort-name # scenarios whose name starts with one of these
yarn parity --list                        # names only
node dev/parity/parity.mjs --base http://localhost:5199 --headed
```

Use `--base` when the dev server runs on another port. Screenshots land in `dev/parity/out/` (git-ignored) as `<scenario>.<legacy|vue>[.<step>].png`. Playwright needs its Chromium once: `yarn playwright install chromium`.

The subtree of the dialogs (the legacy `modals.html` wrapper, third child of the root div) is replaced by a stub on both sides as long as `EXCLUDE_DIALOGS` in `dev/parity/snapshot.mjs` is `true`; run with `--include-dialogs` (or flip the constant) to compare it. Decided deviations (`known` in `scenarios.mjs`, currently only Q-03) are listed under their scenario instead of failing it. A Ctrl-click is a right-click on macOS, so the context menu scenarios use Cmd there.

## Continuous integration

`.github/workflows/frontend.yml` runs on pull requests and on pushes to `master` that touch `frontend/`, `src/assets/dist/` or the workflow itself. It installs with `yarn install --frozen-lockfile` on Node 26 (the active LTS line), runs `yarn typecheck`, `yarn test` and `yarn build`, and fails when the fresh `filemanager.js` or `filemanager.css` differs from the committed one, or when the build leaves an untracked file in `src/assets/dist/`. Composer installs the package from the git tag without a build step, so after changing anything under `frontend/` run `yarn build` and commit the two files.
