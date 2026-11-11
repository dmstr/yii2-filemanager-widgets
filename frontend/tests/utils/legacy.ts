/**
 * Loads the real AngularJS 1.5.11, jQuery and the self-contained legacy
 * pieces out of the AngularJS bundle text, so specs can compare the port
 * against the original instead of against hand-written expectations.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

// Vitest runs from ./frontend/, one level below the repository root.
const repo = (relative: string) => resolve(process.cwd(), '..', relative);
const read = (relative: string) => readFileSync(repo(relative), 'utf8');

const bundle = read('frontend/legacy/angular-filemanager.min.js');

let loaded = false;
function load(): void {
  if (loaded) return;
  (0, eval)(read('frontend/node_modules/jquery/dist/jquery.js'));
  (0, eval)(read('frontend/legacy/vendor/angular.min.js'));
  loaded = true;
}

export function angularGlobal(): Any {
  load();
  return (window as Any).angular;
}

/** The text of the IIFE in the bundle that contains `marker`, whether it takes `(angular)` or `(angular, $)`. */
function iife(marker: string): string {
  const at = bundle.indexOf(marker);
  if (at < 0) throw new Error(`legacy marker not found: ${marker}`);
  const start = bundle.lastIndexOf('(function(angular', at);
  const closer = bundle.startsWith('(function(angular)', start) ? '})(angular);' : '})(angular, jQuery);';
  return bundle.slice(start, bundle.indexOf(closer, at) + closer.length);
}

/** Runs the IIFEs that contain the markers against `angular`, with jQuery for those that take it. */
function runIifes(angular: Any, markers: string[]): void {
  const jQuery = (window as Any).jQuery;
  for (const marker of markers) {
    new Function('angular', 'jQuery', '$', iife(marker))(angular, jQuery, jQuery);
  }
}

/** The legacy model classes every service under test needs: `chmod` and `item`. */
const MODEL_MARKERS = ["service('chmod'", "factory('item'"];

/** Registers the legacy module with a config the specs can mutate, then runs the given IIFEs. */
function injector(config: Any, markers: string[]): Any {
  const angular = angularGlobal();
  angular.module('FileManagerApp', []).value('fileManagerConfig', config);
  runIifes(angular, markers);
  return angular.injector(['ng', 'FileManagerApp']);
}

/** The four legacy filters, instantiated by AngularJS itself. */
export function legacyFilters(config: Any = {}): Record<'strLimit' | 'fileExtension' | 'formatDate' | 'humanReadableFileSize', (...args: Any[]) => Any> {
  const $injector = injector(config, ["app.filter('strLimit'"]);
  const $filter = $injector.get('$filter');
  return {
    strLimit: $filter('strLimit'),
    fileExtension: $filter('fileExtension'),
    formatDate: $filter('formatDate'),
    humanReadableFileSize: $filter('humanReadableFileSize'),
  };
}

/** The legacy `chmod` service (the class) and `item` factory (the class). */
export function legacyModels(config: Any): { Chmod: Any; Item: Any } {
  const $injector = injector(config, MODEL_MARKERS);
  return { Chmod: $injector.get('chmod'), Item: $injector.get('item') };
}

/** The legacy `ApiHandler.prototype.slug`, evaluated against the real jQuery. */
export function legacySlug(): (input: Any) => string {
  load();
  const match = bundle.match(/prototype\.slug = (function\(str\) \{[\s\S]*?\n {8}\});/);
  if (!match) throw new Error('legacy slug not found');
  return new Function('$', `return (${match[1]});`)((window as Any).jQuery);
}

/** The real `angular.merge`. */
export function angularMerge(dst: Any, ...src: Any[]): Any {
  return angularGlobal().merge(dst, ...src);
}

/** The real `filter` and `orderBy` filters of AngularJS 1.5.11. */
export function legacyCollectionFilters(): { filter: (...args: Any[]) => Any; orderBy: (...args: Any[]) => Any } {
  const $filter = angularGlobal().injector(['ng']).get('$filter');
  return { filter: $filter('filter'), orderBy: $filter('orderBy') };
}

/**
 * The legacy `fileNavigator` with a stub `apiMiddleware`, enough to run
 * `buildTree` and the navigation helpers against a hand-set `fileList`.
 */
export function legacyNavigator(config: Any): { FileNavigator: Any; Item: Any } {
  const angular = angularGlobal();
  angular.module('FileManagerApp', []).value('fileManagerConfig', config).service('apiMiddleware', function () {
    // Like the real service, hand out the constructor.
    return function () {};
  });
  runIifes(angular, [...MODEL_MARKERS, "service('fileNavigator'"]);
  const $injector = angular.injector(['ng', 'FileManagerApp']);
  return { FileNavigator: $injector.get('fileNavigator'), Item: $injector.get('item') };
}

export interface LegacyReply {
  status: number;
  data: Any;
}

/**
 * The legacy `apiHandler` and `apiMiddleware` on top of recording stubs for
 * `$http` and ng-file-upload: every call is pushed to `calls`, answered with
 * `reply()` once `flush()` runs a digest.
 */
export function legacyApi(config: Any, reply: () => LegacyReply = () => ({ status: 200, data: { result: {} } })) {
  const angular = angularGlobal();
  const calls: Array<{ method: string; url: string; data?: Any }> = [];
  const module = angular.module('FileManagerApp', []).value('fileManagerConfig', config);
  module.factory('$translate', () => ({ instant: (key: string) => key }));
  const answer = ($q: Any) => {
    const deferred = $q.defer();
    const response = reply();
    const settle = response.status >= 200 && response.status < 300 ? deferred.resolve : deferred.reject;
    settle({ data: response.data, status: response.status });
    const promise = deferred.promise;
    promise.success = (fn: Any) => (promise.then((r: Any) => fn(r.data, r.status)), promise);
    promise.error = (fn: Any) => (promise.then(null, (r: Any) => fn(r.data, r.status)), promise);
    return promise;
  };
  module.factory('$http', [
    '$q',
    ($q: Any) => ({
      defaults: { headers: { common: {} as Any } },
      post(url: string, data: Any) {
        calls.push({ method: 'POST', url, data: JSON.parse(angular.toJson(data)) });
        return answer($q);
      },
      get(url: string) {
        calls.push({ method: 'GET', url });
        return answer($q);
      },
    }),
  ]);
  module.factory('Upload', [
    '$q',
    ($q: Any) => ({
      upload(options: { url: string; data: Any }) {
        calls.push({ method: 'UPLOAD', url: options.url, data: options.data });
        return answer($q);
      },
    }),
  ]);
  runIifes(angular, [...MODEL_MARKERS, "service('apiHandler'", "service('apiMiddleware'"]);
  const $injector = angular.injector(['ng', 'FileManagerApp']);
  const ApiMiddleware = $injector.get('apiMiddleware');
  return { middleware: new ApiMiddleware(), Item: $injector.get('item'), calls, flush: () => $injector.get('$rootScope').$digest() };
}

/**
 * The legacy `FileManagerCtrl` instantiated against stub services; returns
 * its `$scope`. `fileList` is normally assigned by the view template, so
 * specs set it themselves; `$digest()` fires the `temps` watcher.
 */
export function legacyController(config: Any): { $scope: Any; Item: Any } {
  const angular = angularGlobal();
  angular
    .module('FileManagerApp', [])
    .value('fileManagerConfig', config)
    .factory('$translate', () => ({ instant: (key: string) => key, use: () => {} }))
    .service('fileNavigator', function () {
      return function (this: Any) {
        this.fileList = [];
        this.currentPath = [];
        this.refresh = () => {};
        this.onRefresh = () => {};
      };
    })
    .service('apiMiddleware', function () {
      return function (this: Any) {
        this.apiHandler = { error: '', inprocess: false, asyncSuccess: false };
      };
    });
  runIifes(angular, [...MODEL_MARKERS, "controller('FileManagerCtrl'"]);
  const $injector = angular.injector(['ng', 'FileManagerApp']);
  const $scope = $injector.get('$rootScope').$new();
  $injector.get('$controller')('FileManagerCtrl', { $scope });
  return { $scope, Item: $injector.get('item') };
}

/** The text of the `isteven-multi-select` 4.0.0 module inside the bundle, directive and template. */
function multiSelectSource(): string {
  const start = bundle.indexOf("angular.module( 'isteven-multi-select'");
  const endMarker = "$templateCache.put( 'isteven-multi-select.htm' , template );\n}]);";
  const end = bundle.indexOf(endMarker, start) + endMarker.length;
  if (start < 0 || end < endMarker.length) throw new Error('legacy multi-select not found');
  return bundle.slice(start, end);
}

export interface LegacyMultiSelect {
  /** The host `div` the directive renders into, attached to `document.body`. */
  element: HTMLElement;
  /** The parent scope: `input` is the input model, `output` the output model. */
  scope: Any;
  /** Runs a digest on the parent scope, as an AngularJS event handler would. */
  digest: () => void;
  /** Destroys the scope and detaches the host. */
  destroy: () => void;
}

/**
 * The real `isteven-multi-select` directive, compiled with exactly the
 * attributes the permissions dialog uses and linked into `document.body`.
 * `$timeout` callbacks run on real timers, so specs wait a macrotask.
 */
export function legacyMultiSelect(input: Any, output?: Any): LegacyMultiSelect {
  const angular = angularGlobal();
  new Function('angular', multiSelectSource())(angular);
  const $injector = angular.injector(['ng', 'isteven-multi-select']);
  const scope = $injector.get('$rootScope').$new();
  scope.input = input;
  scope.output = output;
  const host = document.createElement('div');
  host.innerHTML =
    '<div isteven-multi-select input-model="input" output-model="output" button-label="role" item-label="role"' +
    ' tick-property="selected" output-properties="role selected" class="permission-multi-select-button"></div>';
  document.body.appendChild(host);
  const element = $injector.get('$compile')(host.firstChild)(scope)[0] as HTMLElement;
  scope.$digest();
  return {
    element,
    scope,
    digest: () => scope.$digest(),
    destroy: () => {
      // The directive never unbinds its document listeners on $destroy; drop them so specs stay independent.
      const isolate = angular.element(element).isolateScope();
      angular.element(document).off('click', isolate.externalClickListener).off('keydown', isolate.keyboardListener);
      scope.$destroy();
      host.remove();
    },
  };
}

/** A template of the legacy bundle's `$templateCache` (for example `modals.html`), parsed as the document the AngularJS app rendered its dialogs from. */
export function legacyTemplate(name: string): Document {
  const put: Record<string, string> = {};
  const run = bundle.match(/angular\.module\("FileManagerApp"\)\.run\(\["\$templateCache", function\(\$templateCache\) \{[\s\S]*?\}\]\);/);
  if (!run) throw new Error('legacy template cache not found');
  const cache = { put: (key: string, html: string) => void (put[key] = html) };
  new Function('angular', run[0])({ module: () => ({ run: (list: Any[]) => list[1](cache) }) });
  const html = put[`src/templates/${name}`];
  if (html === undefined) throw new Error(`legacy template not found: ${name}`);
  return new DOMParser().parseFromString(html, 'text/html');
}
