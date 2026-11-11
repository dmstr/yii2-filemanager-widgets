# Fixtures

Outputs recorded from the AngularJS 1.x frontend of version 1.x of this package, while that code was still in the repository. The specs replay the same inputs, steps and sequences on the Vue port and compare against these recordings, which pins the behaviour that was carried over from the AngularJS frontend. The 1.x tags of this repository still contain that code.

The fixtures are not regenerated: the code that produced them is gone. When a behaviour is changed on purpose, edit the entry in the fixture, or replace the comparison with an explicit expectation in the spec, and say why in the spec.

Files are JSON, pretty-printed, in the key order the recording had. Values JSON cannot hold are stored as objects with a `$$` key and rebuilt by `decode` in `../utils/fixtures.ts`, which lists the tags (`undefined`, `NaN`, `Infinity`, `Date`, `RegExp`, functions, array holes). Dates parsed as local time are recorded as local-time fields, so the fixtures do not depend on the time zone of the machine.

| File | What it pins | Read by |
| --- | --- | --- |
| `utils/format.json` | arguments and results of the AngularJS filters `strLimit`, `fileExtension` and `formatDate` (strings, numbers and the `RangeError` for an Invalid Date); the file size and date output was changed on purpose and is pinned by tables in the spec | `utils/format.spec.ts` |
| `utils/slug.json` | input and result of the folder-name `slug` function | `utils/slug.spec.ts` |
| `utils/param.json` | data and query string of jQuery 3 `$.param`, used to build download URLs | `utils/param.spec.ts` |
| `models/chmod.json` | input and result (or error message) of the `chmod` service | `models/Chmod.spec.ts` |
| `models/item.json` | models, predicates and paths the `item` factory built for a table of raw models and paths | `models/Item.spec.ts` |
| `config/angular-merge.json` | the configuration `angular.merge(defaults, input)` produced for each input | `config/resolve.spec.ts` |
| `services/collection.json` | result of the AngularJS `filter` and `orderBy` filters over one item list: names for each query, item positions for each ordering | `services/collection.spec.ts` |
| `services/navigator.json` | the sidebar tree of the `fileNavigator` after every folder visit of seven visit sequences, the folder contents it ran on, and its handling of a failed list | `services/navigator.spec.ts` |
| `services/selection.json` | five seeded random walks of 400 selection gestures (click, Ctrl, Cmd, Shift, right click, click on no item) with the selection, the revert of dialog input and the single selection after each step | `services/selection.spec.ts` |
| `services/api.json` | URL and body of every request of the API middleware, the download and preview URLs, the upload field names and the empty upload | `services/api.spec.ts` |
| `components/multi-select.json` | rendered tree, button label, output model, input flags and focused element of the `isteven-multi-select` directive after mount and after every step of 26 scenarios (the scenarios whose search input matched through the removed helper values are expectations in the spec instead); `doms` holds each distinct rendered tree once, as indented lines, including the now unused trees of five removed scenarios for a `null` or `undefined` input model, which the spec expects to behave like an empty array, and of four removed search scenarios | `components/MultiSelect.spec.ts` |
| `components/modals.html` | the `modals.html` template of the AngularJS frontend, the reference for the markup of the dialogs | `components/modals/helpers.ts` and the dialog specs |
| `i18n/locale-keys.json` | the translation keys of each of the 12 languages, in table order (not the translations) | `i18n/locales.spec.ts` |
