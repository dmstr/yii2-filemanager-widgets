/**
 * Ports of the four legacy AngularJS filters, quirks included.
 */

/**
 * Port of the `strLimit` filter. Legacy `limitTo` semantics for strings:
 * a negative limit keeps the tail and a `NaN` limit keeps everything, while
 * the suffix is still appended. An empty `more` falls back to `...`.
 */
export function strLimit(input: string, limit: number, more?: string): string {
  if (input.length <= limit) {
    return input;
  }
  const part = Number.isNaN(limit) ? input : limit >= 0 ? input.slice(0, limit) : input.slice(limit);
  return part + (more || '...');
}

/**
 * Port of the `fileExtension` filter: the last dot-separated segment cut to
 * three characters plus `..`, or an empty string when there is no dot.
 */
export function fileExtension(input: string): string {
  return (/\./.test(input) && strLimit(input.split('.').pop() as string, 3, '..')) || '';
}

/**
 * Port of the `formatDate` filter.
 *
 * Q-22: dates go through `toISOString`, so the output is shifted to UTC.
 * The legacy filter threw a RangeError for an Invalid Date (which every item
 * without a parsable date has, see `Item`) and for `null`/`undefined`;
 * AngularJS then left the raw `{{ ... }}` text in the cell. A Vue template
 * must not throw, so those inputs yield an empty string.
 */
export function formatDate(input: unknown): string {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return '';
    }
    return input.toISOString().substring(0, 19).replace('T', ' ');
  }
  if (input == null) {
    return '';
  }
  const value = input as { toLocaleString?: () => string; toString: () => string };
  return (value.toLocaleString || value.toString).apply(input);
}

// Q-21: the irregular leading spaces of the decimal units are part of the output.
const DECIMAL_BYTE_UNITS = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
const BINARY_BYTE_UNITS = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

/**
 * Port of the `humanReadableFileSize` filter.
 *
 * Q-21: always divides by 1024, even for decimal units, shows at least
 * `0.1`, and an index past the unit table renders as the text `undefined`.
 * Non-finite input is not guarded, as before: `Infinity` never terminates.
 */
export function humanReadableFileSize(input: number, useBinaryPrefixes: boolean): string {
  let i = -1;
  let size = input;
  do {
    size = size / 1024;
    i++;
  } while (size > 1024);
  const unit = useBinaryPrefixes ? BINARY_BYTE_UNITS[i] : DECIMAL_BYTE_UNITS[i];
  return Math.max(size, 0.1).toFixed(1) + ' ' + unit;
}
