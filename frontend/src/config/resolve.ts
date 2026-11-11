import { isObject } from '../utils/isObject.ts';
import { createDefaults } from './defaults.ts';
import type { FileManagerConfig } from './types.ts';

declare global {
  interface Window {
    /** Written by PHP, extended by host scripts, read once at start-up. */
    fileManagerConfig?: unknown;
  }
}

const PATTERN_OPTIONS = ['isEditableFilePattern', 'isImageFilePattern', 'isExtractableFilePattern'] as const;

type Bag = Record<string, unknown>;

/**
 * The deep merge of `angular.merge` as shipped with AngularJS 1.5.11, which
 * the legacy integration used. Plain objects merge recursively, arrays merge
 * index by index into an existing object or array, dates and regular
 * expressions are cloned, functions and primitives (including `undefined`
 * and `null`) are assigned. Non-object sources are ignored.
 */
function merge(target: Bag, source: unknown): void {
  if (!isObject(source) && typeof source !== 'function') {
    return;
  }
  const bag = source as Bag;
  for (const key of Object.keys(bag)) {
    const value = bag[key];
    if (isObject(value)) {
      if (value instanceof Date) {
        target[key] = new Date(value.valueOf());
      } else if (value instanceof RegExp) {
        target[key] = new RegExp(value);
      } else {
        if (!isObject(target[key])) {
          target[key] = Array.isArray(value) ? [] : {};
        }
        merge(target[key] as Bag, value);
      }
    } else {
      target[key] = value;
    }
  }
}

/** Turns `"/\\.png$/i"` into a `RegExp`; anything not in literal notation is a configuration error. */
function parsePattern(option: string, value: string): RegExp {
  const last = value.lastIndexOf('/');
  if (!value.startsWith('/') || last < 1) {
    throw new Error(`Invalid fileManagerConfig.${option}: expected a regular expression literal such as "/\\.png$/i", got "${value}"`);
  }
  try {
    return new RegExp(value.slice(1, last), value.slice(last + 1));
  } catch (error) {
    throw new Error(`Invalid fileManagerConfig.${option}: ${(error as Error).message}`);
  }
}

/**
 * Deep-merges a user object over a fresh copy of the defaults and converts
 * the three pattern options from literal-notation strings to `RegExp`.
 * `undefined` input yields the defaults.
 */
export function resolveConfig(input: unknown): FileManagerConfig {
  const config = createDefaults() as unknown as Bag;
  merge(config, input);
  for (const option of PATTERN_OPTIONS) {
    const value = config[option];
    if (typeof value === 'string') {
      config[option] = parsePattern(option, value);
    }
  }
  return config as unknown as FileManagerConfig;
}

/** Resolves `window.fileManagerConfig`, which PHP and host scripts fill before the bundle runs. */
export function readGlobalConfig(): FileManagerConfig {
  return resolveConfig(window.fileManagerConfig);
}
