/**
 * Deep copy with the semantics of `angular.copy`, which the AngularJS item
 * factory relies on: dates and regular expressions are cloned, class
 * instances keep their prototype, functions are shared by reference and
 * cycles are preserved.
 */
export function deepCopy<T>(source: T, seen: WeakMap<object, unknown> = new WeakMap()): T {
  if (source === null || typeof source !== 'object') {
    return source;
  }
  const known = seen.get(source);
  if (known !== undefined) {
    return known as T;
  }
  if (source instanceof Date) {
    return new Date(source.getTime()) as T;
  }
  if (source instanceof RegExp) {
    const copy = new RegExp(source.source, source.flags);
    copy.lastIndex = source.lastIndex;
    return copy as T;
  }
  if (Array.isArray(source)) {
    const copy: unknown[] = [];
    seen.set(source, copy);
    for (const entry of source) {
      copy.push(deepCopy(entry, seen));
    }
    return copy as T;
  }
  const copy = Object.create(Object.getPrototypeOf(source)) as Record<string, unknown>;
  seen.set(source, copy);
  for (const key of Object.keys(source)) {
    copy[key] = deepCopy((source as Record<string, unknown>)[key], seen);
  }
  return copy as T;
}
