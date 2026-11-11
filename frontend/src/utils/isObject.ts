/** True for anything `typeof` calls an object, including arrays, dates and regular expressions, but not `null`. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
