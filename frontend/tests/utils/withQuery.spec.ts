import { describe, expect, it } from 'vitest';
import { withQuery } from '../../src/utils/withQuery.ts';

const table: Array<[string, string, string, string]> = [
  ['no query', '/filefly/api', 'a=1', '/filefly/api?a=1'],
  ['a query', '/filefly/api?scope=s', 'a=1', '/filefly/api?scope=s&a=1'],
  ['a trailing ?', '/filefly/api?', 'a=1', '/filefly/api?a=1'],
  ['a trailing &', '/filefly/api?scope=s&', 'a=1', '/filefly/api?scope=s&a=1'],
  ['a fragment', '/filefly/api#top', 'a=1', '/filefly/api?a=1#top'],
  ['a query and a fragment', '/filefly/api?scope=s#top', 'a=1', '/filefly/api?scope=s&a=1#top'],
  ['a trailing ? and a fragment', '/filefly/api?#top', 'a=1', '/filefly/api?a=1#top'],
  ['a ? only inside the fragment', '/filefly/api#/route?x', 'a=1', '/filefly/api?a=1#/route?x'],
  ['an absolute URL', 'https://example.com/filefly/api', 'a=1', 'https://example.com/filefly/api?a=1'],
  ['an absolute URL with a query', 'https://example.com/api?scope=s', 'a=1', 'https://example.com/api?scope=s&a=1'],
  ['a query that is not re-encoded', '/api?q=a%20b+c&x[]=1', 'a=1', '/api?q=a%20b+c&x[]=1&a=1'],
  ['an empty query', '/filefly/api', '', '/filefly/api'],
  ['an empty query and a query in the URL', '/filefly/api?scope=s#top', '', '/filefly/api?scope=s#top'],
  ['an empty URL', '', 'a=1', '?a=1'],
];

describe('withQuery', () => {
  it.each(table)('handles %s', (_name, url, query, expected) => {
    expect(withQuery(url, query)).toBe(expected);
  });
});
