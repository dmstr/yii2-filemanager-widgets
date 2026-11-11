# legacy

The AngularJS 1.x frontend of version 1.x of this package and the libraries it needs, kept unmodified as the behavioural reference for the tests (`tests/utils/legacy.ts`, `tests/i18n/locales.spec.ts`) and the legacy dev page and parity tool of the port (removed from the repository, see git history). Nothing in this directory is part of the shipped widget.

- `angular-filemanager.min.js`, `angular-filemanager.min.css`: the minified legacy bundle and stylesheet.
- `angular-filemanager-scoped.less`: wrapper that scopes `../src/styles/base.less` to `<angular-filemanager>`; only the import path differs from the original. Together with `../src/styles/custom.less` it produces the legacy page's stylesheet.
- `vendor/`: the libraries, same file names as in the former `src/assets/bower/angular/`:

| File | Library | Version | Licence (per file header) |
| --- | --- | --- | --- |
| `angular.min.js`, `angular.min.js.map` | AngularJS | 1.5.11 | MIT |
| `angular-sanitize.min.js`, `angular-sanitize.min.js.map` | AngularJS (ngSanitize) | 1.5.11 | MIT |
| `angular-translate.min.js` | angular-translate | 2.9.2 | MIT |
| `ng-file-upload.min.js` | ng-file-upload | 12.2.13 | not stated in the header |
| `clipboard.min.js` | clipboard.js | 1.5.16 | MIT |
| `ngclipboard.min.js` | ngclipboard | 1.1.3 | MIT |
