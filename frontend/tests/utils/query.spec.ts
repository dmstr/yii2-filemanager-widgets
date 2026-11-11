import { describe, expect, it } from 'vitest';
import { getQueryParam } from '../../src/utils/query.ts';

describe('getQueryParam', () => {
  it('reads a parameter and lets the first match win', () => {
    expect(getQueryParam('lang', '?lang=de&lang=fr')).toBe('de');
    expect(getQueryParam('server', '?a=1&server=Windows')).toBe('Windows');
  });

  it('returns undefined for a missing parameter or an empty value', () => {
    expect(getQueryParam('lang', '?a=1')).toBeUndefined();
    expect(getQueryParam('lang', '?lang=')).toBeUndefined();
    expect(getQueryParam('lang', '?lang')).toBeUndefined();
    expect(getQueryParam('lang', '')).toBeUndefined();
  });

  it('does not decode values and cuts at a second equals sign', () => {
    expect(getQueryParam('p', '?p=a%20b')).toBe('a%20b');
    expect(getQueryParam('p', '?p=a=b')).toBe('a');
  });

  it('drops the first character even when it is not a question mark', () => {
    expect(getQueryParam('lang', 'lang=de')).toBeUndefined();
    expect(getQueryParam('lang', 'xlang=de')).toBe('de');
  });

  it('defaults to window.location.search', () => {
    window.history.replaceState(null, '', '/?lang=it');
    expect(getQueryParam('lang')).toBe('it');
    window.history.replaceState(null, '', '/');
  });
});
