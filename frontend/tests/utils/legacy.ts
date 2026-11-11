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

const bundle = read('src/assets/dist/angular-filemanager.min.js');

let loaded = false;
function load(): void {
  if (loaded) return;
  (0, eval)(read('frontend/node_modules/jquery/dist/jquery.js'));
  (0, eval)(read('src/assets/bower/angular/angular.min.js'));
  loaded = true;
}

export function angularGlobal(): Any {
  load();
  return (window as Any).angular;
}

/** The text of the IIFE in the bundle that contains `marker`. */
function iife(marker: string): string {
  const at = bundle.indexOf(marker);
  if (at < 0) throw new Error(`legacy marker not found: ${marker}`);
  const start = bundle.lastIndexOf('(function(angular)', at);
  const end = bundle.indexOf('})(angular);', at) + '})(angular);'.length;
  return bundle.slice(start, end);
}

/** Registers the legacy module with a config the specs can mutate, then runs the given IIFEs. */
function injector(config: Any, markers: string[]): Any {
  const angular = angularGlobal();
  angular.module('FileManagerApp', []).value('fileManagerConfig', config);
  for (const marker of markers) {
    new Function('angular', iife(marker))(angular);
  }
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
  const $injector = injector(config, ["service('chmod'", "factory('item'"]);
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
