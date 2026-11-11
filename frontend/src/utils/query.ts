/**
 * Reads one query parameter the way the legacy `getQueryParam` helper did.
 *
 * Kept as is on purpose: the first character is dropped whether or not it is
 * a `?`, values are not URL-decoded, the first match wins and an empty value
 * yields `undefined`.
 */
export function getQueryParam(name: string, search: string = window.location.search): string | undefined {
  const found = search
    .substr(1)
    .split('&')
    .filter((item) => name === item.split('=')[0]);
  return (found[0] && found[0].split('=')[1]) || undefined;
}
