# frontend

Source of the Vue 3 file manager. It replaces the AngularJS bundle behind `FileManagerWidget`. Nothing here is shipped to browsers; `yarn build` writes `../src/assets/dist/filemanager.js` (IIFE, Vue included) and `../src/assets/dist/filemanager.css`, which are committed.

Use Node 20.19+/22.12+ and yarn classic (1.x).

## Commands

- `yarn dev`: Vite dev server with HMR and the mock API.
- `yarn build`: build the two files above. Other files in `dist/` are left untouched.
- `yarn test`: Vitest (jsdom).
- `yarn typecheck`: `vue-tsc --noEmit`.

## Dev harness

Both pages talk to the same in-memory mock of the filefly API (`dev/mock-api.ts`, mounted at `/mock/api`). `POST /mock/reset` restores the seed data.

- http://localhost:5173/dev/index.html: the Vue app.
- http://localhost:5173/dev/legacy.html: the untouched legacy AngularJS app, for side-by-side comparison.

Optional query flags on both pages: `?allow=rename,changePermissions` enables actions the widget switches off by default, `?editable=1` makes `.txt` and `.svg` editable. Error states: list path `/__error__`, or a request header `X-Mock-Error: <status>`.
