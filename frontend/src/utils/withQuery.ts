/**
 * Appends a query string to a handler URL for the GET links the client builds.
 *
 * Only the joining is decided here, the existing query is never parsed,
 * reordered or re-encoded:
 * - no query yet: `?` is used, so the result equals `url + '?' + query`;
 * - a query already present: `&`, unless the URL ends in `?` or `&`, then
 *   nothing is inserted (no `??`, no `&&`);
 * - a fragment stays last, the parameters go before the first `#`;
 * - an absolute URL is treated like any other, only its `?` and `#` matter;
 * - an empty `query` returns the URL unchanged instead of leaving a dangling `?`.
 */
export function withQuery(url: string, query: string): string {
  if (query === '') {
    return url;
  }
  const hashAt = url.indexOf('#');
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : url.slice(hashAt);
  let glue = '?';
  if (base.includes('?')) {
    glue = /[?&]$/.test(base) ? '' : '&';
  }
  return base + glue + query + fragment;
}
