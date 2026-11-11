/**
 * Port of jQuery 3's `$.param` for the shapes the legacy code passes to it:
 * flat objects with scalar values and arrays of scalars (`items[]=a`). Nested
 * objects and the `{name, value}` array form are supported as well because
 * jQuery treats them the same way.
 *
 * Spaces come out as `%20`: jQuery 3 only turns them into `+` inside its own
 * ajax body serialisation, never in `$.param` itself.
 */
const BRACKET_SUFFIX = /\[\]$/;

function isPlainLike(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function buildParams(prefix: string, value: unknown, add: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    // A for loop, not forEach: jQuery visits holes as `undefined`.
    for (let i = 0; i < value.length; i++) {
      const entry = value[i];
      if (BRACKET_SUFFIX.test(prefix)) {
        add(prefix, entry);
      } else {
        buildParams(prefix + '[' + (typeof entry === 'object' && entry != null ? i : '') + ']', entry, add);
      }
    }
  } else if (isPlainLike(value)) {
    for (const name in value) {
      buildParams(prefix + '[' + name + ']', value[name], add);
    }
  } else {
    add(prefix, value);
  }
}

/** Serialises `data` to a query string exactly as jQuery 3 `$.param(data)` does. */
export function param(data: Record<string, unknown> | Array<{ name: string; value: unknown }> | null | undefined): string {
  if (data == null) {
    return '';
  }
  const parts: string[] = [];
  const add = (key: string, valueOrFunction: unknown): void => {
    const value = typeof valueOrFunction === 'function' ? (valueOrFunction as () => unknown)() : valueOrFunction;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value == null ? '' : String(value)));
  };
  if (Array.isArray(data)) {
    for (const entry of data) {
      add(entry.name, entry.value);
    }
  } else {
    for (const prefix in data) {
      buildParams(prefix, data[prefix], add);
    }
  }
  return parts.join('&');
}
