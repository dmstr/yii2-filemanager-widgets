/**
 * Minimal replacement for AngularJS 1.5 `$http`: same request headers, same
 * notion of success (2xx) and the same default response transformation.
 */

/** What `$http` handed to its success and error callbacks. */
export interface HttpResult {
  data: unknown;
  /** The HTTP status; `-1` when the request never produced a response. */
  status: number;
}

export const REQUEST_HEADERS: Readonly<Record<string, string>> = {
  Accept: 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
};

const JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/;
const JSON_START = /^\[|^\{(?!\{)/;
const JSON_ENDS: Record<string, RegExp> = { '[': /]$/, '{': /}$/ };

function isJsonLike(text: string): boolean {
  const start = text.match(JSON_START);
  return !!start && JSON_ENDS[start[0]].test(text);
}

/**
 * AngularJS' default response transform: a string body is parsed when the
 * content type is JSON or the text looks like JSON. Unlike AngularJS, a body
 * that fails to parse stays text instead of failing the request.
 */
export function parseBody(text: string, contentType: string | null): unknown {
  const trimmed = text.replace(JSON_PROTECTION_PREFIX, '').trim();
  if (trimmed && ((contentType && contentType.indexOf('application/json') === 0) || isJsonLike(trimmed))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }
  return text;
}

/** `angular.toJson`: `JSON.stringify` that drops keys starting with `$$`. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (key, entry) => (key.charAt(0) === '$' && key.charAt(1) === '$' ? undefined : entry));
}

export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * Sends a request with same-origin credentials. Resolves for 2xx and rejects
 * with the same `{data, status}` shape for everything else; a network failure
 * rejects with `{data: null, status: -1}` like AngularJS reported it.
 *
 * With `responseType` `'blob'` the body of a 2xx response is handed over as a
 * `Blob`, byte for byte, because reading binary data as text corrupts it; the
 * body of a failed response is still read as text for the error handling.
 */
export async function request(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  responseType: 'text' | 'blob' = 'text',
): Promise<HttpResult> {
  const headers: Record<string, string> = { ...REQUEST_HEADERS };
  const init: RequestInit = { method, headers, credentials: 'same-origin' };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json;charset=utf-8';
    init.body = toJson(body);
  }
  let result: HttpResult;
  try {
    const response = await fetch(url, init);
    if (responseType === 'blob' && isSuccess(response.status)) {
      result = { data: await response.blob(), status: response.status };
    } else {
      const text = await response.text();
      result = { data: parseBody(text, response.headers.get('Content-Type')), status: response.status };
    }
  } catch {
    throw { data: null, status: -1 } satisfies HttpResult;
  }
  if (!isSuccess(result.status)) {
    throw result;
  }
  return result;
}
