/**
 * Ports of the two AngularJS 1.5.11 filters the views applied to the file
 * list: `filter: {model: {name: query}}` and `orderBy:predicate:reverse`.
 * They are ported rather than approximated because their edge cases (a
 * leading `!`, mixed types, tie breaking under `reverse`) show up on screen.
 */

import { isObject } from '../../utils/isObject.ts';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Comparator = (actual: Any, expected: Any) => boolean;

const typeOf = (value: unknown): string => (value === null ? 'null' : typeof value);
const hasCustomToString = (value: Any): boolean =>
  typeof value.toString === 'function' && value.toString !== Object.prototype.toString;

/** The default comparator of `filter`: a case-insensitive substring match on primitives. */
const containsText: Comparator = (actual, expected) => {
  if (actual === undefined) return false;
  if (actual === null || expected === null) return actual === expected;
  if (isObject(expected) || (isObject(actual) && !hasCustomToString(actual))) return false;
  return ('' + actual).toLowerCase().indexOf(('' + expected).toLowerCase()) !== -1;
};

function deepCompare(
  actual: Any,
  expected: Any,
  comparator: Comparator,
  anyPropertyKey: string,
  matchAgainstAnyProp?: boolean,
  dontMatchWholeObject?: boolean,
): boolean {
  const actualType = typeOf(actual);
  const expectedType = typeOf(expected);

  if (expectedType === 'string' && expected.charAt(0) === '!') {
    return !deepCompare(actual, expected.substring(1), comparator, anyPropertyKey, matchAgainstAnyProp);
  }
  if (Array.isArray(actual)) {
    return actual.some((item) => deepCompare(item, expected, comparator, anyPropertyKey, matchAgainstAnyProp));
  }
  switch (actualType) {
    case 'object':
      if (matchAgainstAnyProp) {
        for (const key in actual) {
          if (key.charAt(0) !== '$' && deepCompare(actual[key], expected, comparator, anyPropertyKey, true)) {
            return true;
          }
        }
        return dontMatchWholeObject ? false : deepCompare(actual, expected, comparator, anyPropertyKey, false);
      }
      if (expectedType === 'object') {
        for (const key in expected) {
          const expectedValue = expected[key];
          if (typeof expectedValue === 'function' || expectedValue === undefined) continue;
          const matchAnyProperty = key === anyPropertyKey;
          const actualValue = matchAnyProperty ? actual : actual[key];
          if (!deepCompare(actualValue, expectedValue, comparator, anyPropertyKey, matchAnyProperty, matchAnyProperty)) {
            return false;
          }
        }
        return true;
      }
      return comparator(actual, expected);
    case 'function':
      return false;
    default:
      return comparator(actual, expected);
  }
}

/**
 * `array | filter: expression` for object expressions such as
 * `{model: {name: query}}`. An `undefined` leaf matches everything, `null`
 * nothing, and a string starting with `!` negates the match.
 */
export function filterBy<T>(array: readonly T[], expression: object): T[] {
  return array.filter((item) => deepCompare(item, expression, containsText, '$'));
}

/** The names the list views filter on: `{model: {name: query}}`. */
export function filterByName<T>(array: readonly T[], query: unknown): T[] {
  return filterBy(array, { model: { name: query } });
}

type Predicate = string | ((value: Any) => unknown);
interface PredicateValue {
  value: Any;
  type: string;
  index: number;
}

const isPrimitive = (value: unknown): boolean => ['number', 'boolean', 'string'].includes(typeof value);

/** Stand-in for `$parse` on the dotted paths the app uses; missing steps yield `undefined`. */
function pathGetter(path: string): (value: Any) => Any {
  const keys = path.split('.');
  return (value) => keys.reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function toPredicates(sortPredicate: Predicate | Predicate[]): Array<{ get: (value: Any) => Any; descending: number }> {
  const list = Array.isArray(sortPredicate) ? sortPredicate : [sortPredicate];
  return (list.length === 0 ? ['+'] : list).map((predicate) => {
    let descending = 1;
    let get: (value: Any) => Any = (value) => value;
    if (typeof predicate === 'function') {
      get = predicate;
    } else if (typeof predicate === 'string') {
      if (predicate.charAt(0) === '+' || predicate.charAt(0) === '-') {
        descending = predicate.charAt(0) === '-' ? -1 : 1;
        predicate = predicate.substring(1);
      }
      if (predicate !== '') {
        get = pathGetter(predicate);
      }
    }
    return { get, descending };
  });
}

function compare(a: PredicateValue, b: PredicateValue): number {
  let result = 0;
  if (a.type === b.type) {
    let left = a.value;
    let right = b.value;
    if (a.type === 'string') {
      left = left.toLowerCase();
      right = right.toLowerCase();
    } else if (a.type === 'object') {
      if (isObject(left)) left = a.index;
      if (isObject(right)) right = b.index;
    }
    if (left !== right) {
      result = left < right ? -1 : 1;
    }
  } else {
    result = a.type < b.type ? -1 : 1;
  }
  return result;
}

/**
 * `array | orderBy: predicate : reverse`. Keys are compared in turn, the
 * original position breaks ties, and `reverse` flips the whole result
 * including that tie break and the direction of every key.
 */
export function orderBy<T>(array: readonly T[], sortPredicate: Predicate | Predicate[], reverseOrder?: boolean): T[] {
  const predicates = toPredicates(sortPredicate);
  const reverse = reverseOrder ? -1 : 1;

  const entries = Array.prototype.map.call(array, (value: T, index: number) => ({
    value,
    tieBreaker: { value: index, type: 'number', index } as PredicateValue,
    predicateValues: predicates.map((predicate): PredicateValue => {
      let got = predicate.get(value);
      let type: string = typeof got;
      if (got === null) {
        type = 'string';
        got = 'null';
      } else if (type === 'object') {
        // The type stays 'object' even when `valueOf` yields a number (dates sort by time stamp).
        if (typeof got.valueOf === 'function') {
          got = got.valueOf();
        }
        if (!isPrimitive(got) && hasCustomToString(got)) {
          got = got.toString();
        }
      }
      return { value: got, type, index };
    }),
  })) as Array<{ value: T; tieBreaker: PredicateValue; predicateValues: PredicateValue[] }>;

  entries.sort((a, b) => {
    for (let i = 0; i < predicates.length; i++) {
      const result = compare(a.predicateValues[i], b.predicateValues[i]);
      if (result) {
        return result * predicates[i].descending * reverse;
      }
    }
    return compare(a.tieBreaker, b.tieBreaker) * reverse;
  });
  return entries.map((entry) => entry.value);
}
