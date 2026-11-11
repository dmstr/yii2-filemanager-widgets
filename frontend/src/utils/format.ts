/**
 * Ports of the four AngularJS filters, quirks included.
 */

/**
 * Port of the `strLimit` filter. AngularJS `limitTo` semantics for strings:
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
 * The backend sends a zone-less wall-clock time and `Item` parses it as local
 * time, so the local date parts are printed to show exactly what the server
 * sent, whatever the time zone of the browser is.
 * The AngularJS filter threw a RangeError for an Invalid Date (which every item
 * without a parsable date has, see `Item`) and for `null`/`undefined`;
 * AngularJS then left the raw `{{ ... }}` text in the cell. A Vue template
 * must not throw, so those inputs yield an empty string.
 */
export function formatDate(input: unknown): string {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return '';
    }
    const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
    return (
      `${pad(input.getFullYear(), 4)}-${pad(input.getMonth() + 1)}-${pad(input.getDate())} ` +
      `${pad(input.getHours())}:${pad(input.getMinutes())}:${pad(input.getSeconds())}`
    );
  }
  if (input == null) {
    return '';
  }
  const value = input as { toLocaleString?: () => string; toString: () => string };
  return (value.toLocaleString || value.toString).apply(input);
}

const DECIMAL_BYTE_UNITS = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
const BINARY_BYTE_UNITS = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

/**
 * Port of the `humanReadableFileSize` filter.
 *
 * Decimal units divide by 1000 and binary units by 1024. The smallest unit is
 * used below one unit (there is no bytes unit), the next unit starts when the
 * value reaches the divisor, and the last unit is kept for anything larger.
 * Input that is not a finite non-negative number counts as 0.
 */
export function humanReadableFileSize(input: number, useBinaryPrefixes: boolean): string {
  const divisor = useBinaryPrefixes ? 1024 : 1000;
  const units = useBinaryPrefixes ? BINARY_BYTE_UNITS : DECIMAL_BYTE_UNITS;
  let size = Number.isFinite(input) && input > 0 ? input / divisor : 0;
  let i = 0;
  // Compare the rounded value, so 999.96 kB does not print as `1000.0 kB`.
  while (i < units.length - 1 && Number(size.toFixed(1)) >= divisor) {
    size = size / divisor;
    i++;
  }
  return size.toFixed(1) + ' ' + units[i];
}
