import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSuccess, parseBody, request, toJson } from '../../src/services/http.ts';
import { stubFetch } from './helpers.ts';

afterEach(() => vi.unstubAllGlobals());

describe('parseBody', () => {
  it('parses a JSON content type', () => {
    expect(parseBody('{"a":1}', 'application/json; charset=utf-8')).toEqual({ a: 1 });
    expect(parseBody('"text"', 'application/json')).toBe('text');
  });

  it('parses JSON-looking text whatever the content type', () => {
    expect(parseBody('{"a":1}', 'text/html')).toEqual({ a: 1 });
    expect(parseBody(' [1,2] ', null)).toEqual([1, 2]);
  });

  it('strips the XSSI prefix', () => {
    expect(parseBody(")]}',\n{\"a\":1}", 'application/json')).toEqual({ a: 1 });
  });

  it('keeps everything else as text', () => {
    expect(parseBody('<html>', 'text/html')).toBe('<html>');
    expect(parseBody('{{ template }}', 'text/html')).toBe('{{ template }}');
    expect(parseBody('', 'application/json')).toBe('');
  });

  it('keeps unparsable JSON as text instead of failing', () => {
    expect(parseBody('{broken', 'application/json')).toBe('{broken');
  });
});

describe('toJson', () => {
  it('drops $$-prefixed keys like angular.toJson', () => {
    expect(toJson({ a: 1, $$hashKey: 'x', $b: 2 })).toBe('{"a":1,"$b":2}');
  });
});

describe('isSuccess', () => {
  it('is true for 2xx only', () => {
    expect([199, 200, 204, 299, 300, 404, -1].map(isSuccess)).toEqual([false, true, true, true, false, false, false]);
  });
});

describe('request', () => {
  it('posts JSON with the AngularJS headers and same-origin credentials', async () => {
    const requests = stubFetch(() => ({ body: { result: 1 } }));
    const result = await request('POST', '/x', { a: 1 });
    expect(result).toEqual({ data: { result: 1 }, status: 200 });
    expect(requests[0]).toMatchObject({
      url: '/x',
      method: 'POST',
      credentials: 'same-origin',
      body: { a: 1 },
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
  });

  it('sends a GET without body and content type', async () => {
    const requests = stubFetch(() => ({ body: 'plain' }));
    await request('GET', '/y');
    expect(requests[0].method).toBe('GET');
    expect(requests[0].body).toBeUndefined();
    expect(requests[0].headers).toEqual({ Accept: 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' });
  });

  it('rejects non-2xx with the parsed body and status', async () => {
    stubFetch(() => ({ status: 500, body: { error: { message: 'boom' } } }));
    await expect(request('POST', '/x', {})).rejects.toEqual({ data: { error: { message: 'boom' } }, status: 500 });
  });

  it('rejects a network failure with null data and status -1', async () => {
    stubFetch(() => ({ networkError: true }));
    await expect(request('POST', '/x', {})).rejects.toEqual({ data: null, status: -1 });
  });
});
