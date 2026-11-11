import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi, type Api } from '../../src/services/api.ts';
import { loadFixture, localizeDates } from '../utils/fixtures.ts';
import { dir, file, flush, makeConfig, makeI18n, makeItem, stubFetch, stubXhr, type FakeReply, type RecordedRequest } from './helpers.ts';

const config = makeConfig();
const i18n = makeI18n();

let requests: RecordedRequest[];
let reply: (request: RecordedRequest) => FakeReply;
let api: Api;

beforeEach(() => {
  reply = () => ({ body: { result: { ok: true } } });
  requests = stubFetch((request) => reply(request));
  api = createApi(config, i18n);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).saveAs;
});

const items = () => [makeItem(file('a.txt'), ['docs']), makeItem(file('b c.txt'), ['docs'])];

/** What the `apiMiddleware` of the AngularJS 1.x frontend sent for the same calls (dates in local-time fields, see `localizeDates`). */
const recorded = loadFixture<{
  post: Array<{ name: string; url: string; body: unknown }>;
  urls: { getUrl: string; getPreviewUrl: string; getPreviewUrlOfPreviewItem: string; downloadMultipleWithoutTimestamp: string };
  upload: { fieldNames: string[]; destination: string; url: string };
  emptyUpload: { calls: number; settled: boolean; inprocess: boolean };
}>('services/api.json');

/** Every POST method, run with the input of the recording and compared with the recorded request. */
const postCases: Array<{
  name: string;
  url: string;
  port: (api: Api, make: typeof items) => Promise<unknown>;
}> = [
  { name: 'list', url: '/api/list', port: (a) => a.list(['docs', 'x']) },
  { name: 'list with recycle', url: '/api/list', port: (a) => a.list(['docs'], undefined, true) },
  { name: 'copy', url: '/api/copy', port: (a, m) => a.copy(m(), ['t']) },
  {
    name: 'copy of one item',
    url: '/api/copy',
    port: (a, m) => {
      const [item] = m();
      item.tempModel.name = 'renamed.txt';
      return a.copy([item], ['t', 'u']);
    },
  },
  { name: 'move', url: '/api/move', port: (a, m) => a.move(m(), ['t']) },
  { name: 'remove', url: '/api/remove', port: (a, m) => a.remove(m()) },
  { name: 'getContent', url: '/api/getContent', port: (a, m) => a.getContent(m()[0]) },
  {
    name: 'edit',
    url: '/api/edit',
    port: (a, m) => {
      const item = m()[0];
      item.tempModel.content = 'new text';
      return a.edit(item);
    },
  },
  {
    name: 'rename',
    url: '/api/rename',
    port: (a, m) => {
      const item = m()[0];
      item.tempModel.name = 'renamed.txt';
      return a.rename(item);
    },
  },
  { name: 'compress', url: '/api/compress', port: (a, m) => a.compress(m(), 'pack', ['t']) },
  { name: 'extract', url: '/api/extract', port: (a, m) => a.extract(m()[0], 'out', ['t']) },
  {
    name: 'changePermissions',
    url: '/api/permissions',
    port: (a, m) => {
      const item = m()[0];
      item.tempModel.authRead = [{ role: 'admin', selected: true }];
      return a.changePermissions(item.tempModel);
    },
  },
  {
    name: 'createFolder',
    url: '/api/createFolder',
    port: (a, m) => {
      const item = m()[0];
      item.tempModel.name = '  New Folder!  ';
      return a.createFolder(item, 'new-folder');
    },
  },
];

describe('POST requests match the recorded apiMiddleware', () => {
  it.each(postCases)('$name', async ({ name, url, port }) => {
    const old = recorded.post.find((entry) => entry.name === name);
    if (!old) throw new Error(`no recording for ${name}`);
    await port(api, items);

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(url);
    expect(requests[0].url).toBe(old.url);
    expect(requests[0].method).toBe('POST');
    // Same fields in the same order, not just equal objects.
    expect(JSON.stringify(localizeDates(requests[0].body))).toBe(JSON.stringify(old.body));
    expect(requests[0].headers).toEqual({
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
    });
  });

  it('the copy of one item with a changed name carries the trimmed name as newFilename', async () => {
    const [first] = items();
    first.tempModel.name = '  copy.txt ';
    await api.copy([first], ['t']);
    expect(requests[0].body).toEqual({ action: 'copy', items: ['/docs/a.txt'], newPath: '/t', newFilename: 'copy.txt' });
    expect(Object.keys(requests[0].body as object)).toEqual(['action', 'items', 'newPath', 'newFilename']);
  });

  it('the copy of one item sends no name when it is unchanged or differs only by surrounding spaces', async () => {
    const [first] = items();
    await api.copy([first], ['t']);
    first.tempModel.name = ' a.txt  ';
    await api.copy([first], ['t']);
    for (const request of requests) {
      expect(request.body).toEqual({ action: 'copy', items: ['/docs/a.txt'], newPath: '/t' });
    }
  });

  it('the copy of several items sends no name', async () => {
    await api.copy(items(), ['t']);
    expect(requests[0].body).toEqual({ action: 'copy', items: ['/docs/a.txt', '/docs/b c.txt'], newPath: '/t' });
  });

  it('createFolder sends the given name under the item path and leaves the typed name alone', async () => {
    const item = items()[0];
    item.tempModel.name = '  New Folder!  ';
    await api.createFolder(item, 'new-folder');
    expect(item.tempModel.name).toBe('  New Folder!  ');
    expect(requests[0].body).toEqual({ action: 'createFolder', newPath: '/docs/new-folder' });
  });
});

describe('URLs match the recorded apiMiddleware', () => {
  const urlConfig = makeConfig({ downloadFileUrl: '/filefly/api?scope=x', downloadMultipleUrl: '/dl/multi' });

  // The recording joined a handler URL that has a query with a second `?`, which broke every link; the two entries
  // for `/filefly/api?scope=x` in the fixture were changed to the `&` join on purpose.
  it('getUrl and getPreviewUrl of a handler URL with a query', () => {
    const local = createApi(urlConfig, i18n);
    const raw = file('my file & more.txt');
    const withPreview = file('p.png', { preview: '/previews/p.png' });
    expect(local.getUrl(makeItem(raw, ['a b']))).toBe(recorded.urls.getUrl);
    expect(local.getUrl(makeItem(raw, ['a b']))).toBe('/filefly/api?scope=x&action=download&path=%2Fa%20b%2Fmy%20file%20%26%20more.txt');
    expect(local.getPreviewUrl(makeItem(withPreview))).toBe('/previews/p.png');
    expect(recorded.urls.getPreviewUrlOfPreviewItem).toBe('/previews/p.png');
    expect(local.getPreviewUrl(makeItem(raw, ['a b']))).toBe(recorded.urls.getPreviewUrl);
  });

  it('downloadMultiple URL', () => {
    const local = createApi(urlConfig, i18n);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    vi.setSystemTime(new Date('2021-03-04T05:06:07.890Z'));
    local.downloadMultiple(items());
    vi.useRealTimers();
    expect(open).toHaveBeenCalledTimes(1);
    const mine = open.mock.calls[0][0] as string;
    expect(mine).toMatch(/^\/dl\/multi\?action=downloadMultiple&items%5B%5D=%2Fdocs%2Fa\.txt&items%5B%5D=%2Fdocs%2Fb%20c\.txt&toFilename=\d{5}-angular-filemanager\.zip$/);
    // The timestamp prefix depends on the clock; everything else is identical to the recording.
    expect(mine.replace(/toFilename=\d+/, '')).toBe(recorded.urls.downloadMultipleWithoutTimestamp);
  });
});

describe('GET URLs by handler URL shape', () => {
  const build = (handler: string) => {
    const local = createApi(makeConfig({ downloadFileUrl: handler, downloadMultipleUrl: handler }), i18n);
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    local.downloadMultiple(items());
    const zip = open.mock.calls[0][0] as string;
    return {
      download: local.getUrl(makeItem(file('a.txt'))),
      preview: local.getPreviewUrl(makeItem(file('a.txt'))),
      zip: zip.replace(/toFilename=\d+/, 'toFilename=N'),
    };
  };
  const zipParams = 'action=downloadMultiple&items%5B%5D=%2Fdocs%2Fa.txt&items%5B%5D=%2Fdocs%2Fb%20c.txt&toFilename=N-angular-filemanager.zip';

  it('joins with ? for a plain handler URL, as before', () => {
    expect(build('/filefly/api')).toEqual({
      download: '/filefly/api?action=download&path=%2Fa.txt',
      preview: '/filefly/api?action=download&path=%2Fa.txt',
      zip: '/filefly/api?' + zipParams,
    });
  });

  it('joins with & for a handler URL that has a query, the ZIP array parameter included', () => {
    expect(build('/filefly/api?scope=some-scope')).toEqual({
      download: '/filefly/api?scope=some-scope&action=download&path=%2Fa.txt',
      preview: '/filefly/api?scope=some-scope&action=download&path=%2Fa.txt',
      zip: '/filefly/api?scope=some-scope&' + zipParams,
    });
  });
});

describe('response handling', () => {
  it('resolves with the data and keeps error empty on success', async () => {
    await expect(api.remove(items())).resolves.toEqual({ result: { ok: true } });
    expect(api.error).toBe('');
    expect(api.inprocess).toBe(false);
  });

  it('sets inprocess while the request runs and clears it afterwards', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    stubFetch(async () => (await gate, { body: { result: {} } }));
    api = createApi(config, i18n);
    api.error = 'old';
    const promise = api.remove(items());
    expect(api.inprocess).toBe(true);
    expect(api.error).toBe('');
    release();
    await promise;
    await flush();
    expect(api.inprocess).toBe(false);
  });

  it('rejects with result.error and shows it', async () => {
    reply = () => ({ body: { result: { error: 'denied' } } });
    await expect(api.remove(items())).rejects.toEqual({ result: { error: 'denied' } });
    expect(api.error).toBe('denied');
    expect(api.inprocess).toBe(false);
  });

  it('result.error wins over a 404 message', async () => {
    reply = () => ({ status: 404, body: { result: { error: 'gone' } } });
    await expect(api.remove(items())).rejects.toBeDefined();
    expect(api.error).toBe('gone');
  });

  it('falls back to error.message', async () => {
    reply = () => ({ body: { error: { message: 'bridge says no' } } });
    await expect(api.rename(items()[0])).rejects.toBeDefined();
    expect(api.error).toBe('bridge says no');
  });

  it('turns a non-JSON 200 into the bridge response error with the status', async () => {
    reply = () => ({ body: '<html>login</html>', contentType: 'text/html' });
    await expect(api.rename(items()[0])).rejects.toBe('<html>login</html>');
    expect(api.error).toBe('Error 200 - Bridge response error, please check the API docs or this ajax response.');
  });

  it('turns an empty 204 into the bridge response error', async () => {
    reply = () => ({ status: 204, body: '' });
    await expect(api.remove(items())).rejects.toBe('');
    expect(api.error).toBe('Error 204 - Bridge response error, please check the API docs or this ajax response.');
  });

  it('reports a 404 as a dead backend bridge', async () => {
    reply = () => ({ status: 404, body: '' });
    await expect(api.remove(items())).rejects.toBeDefined();
    expect(api.error).toBe('Error 404 - Backend bridge is not working, please check the ajax response.');
  });

  it('uses the translated default text for other failures', async () => {
    reply = () => ({ status: 500, body: { foo: 1 } });
    await expect(api.rename(items()[0])).rejects.toEqual({ foo: 1 });
    expect(api.error).toBe(i18n.t('error_renaming'));
    reply = () => ({ status: 500, body: { foo: 1 } });
    await expect(api.list([])).rejects.toBeDefined();
    expect(api.error).toBe('Unknown error listing, check the response');
  });

  it('shows the raw key where a translation is missing', async () => {
    reply = () => ({ status: 500, body: { foo: 1 } });
    await expect(api.move(items(), [])).rejects.toBeDefined();
    expect(api.error).toBe('error_moving');
  });

  it('does not throw on a network failure and rejects with the bridge error (Q-30)', async () => {
    reply = () => ({ networkError: true });
    await expect(api.remove(items())).rejects.toBeNull();
    expect(api.error).toBe('Error -1 - Bridge response error, please check the API docs or this ajax response.');
    expect(api.inprocess).toBe(false);
  });

  it('a custom handler decides the outcome (navigator use)', async () => {
    reply = () => ({ body: { result: [] } });
    const handler = vi.fn((_data, deferred) => deferred.reject('custom'));
    await expect(api.list(['x'], handler)).rejects.toBe('custom');
    expect(handler).toHaveBeenCalledWith({ result: [] }, expect.anything(), 200);
    expect(api.error).toBe('');
  });
});

describe('resolvePermissions', () => {
  it('posts to permissionsUrl and resolves with the body, without touching the loading state', async () => {
    reply = () => ({ body: { auth: { read: [], update: null, delete: [] } } });
    await expect(api.resolvePermissions('/docs/a.txt')).resolves.toEqual({ auth: { read: [], update: null, delete: [] } });
    expect(requests[0].url).toBe('/api/permissions');
    expect(requests[0].body).toEqual({ action: 'resolvePermissions', path: '/docs/a.txt' });
    expect(api.inprocess).toBe(false);
  });

  it('rejects on a failure and leaves api.error alone', async () => {
    reply = () => ({ status: 500, body: {} });
    await expect(api.resolvePermissions('/x')).rejects.toEqual({ data: {}, status: 500 });
    expect(api.error).toBe('');
  });
});

describe('download', () => {
  it('opens a new window when saveAs is missing (Q-20) and returns its truthiness', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const item = items()[0];
    expect(api.download(item)).toBe(true);
    expect(open).toHaveBeenCalledWith('/api/downloadFile?action=download&path=%2Fdocs%2Fa.txt', '_blank', '');
    open.mockReturnValue(null);
    expect(api.download(item)).toBe(false);
    expect(requests).toHaveLength(0);
  });

  it('returns undefined for a folder', () => {
    const open = vi.spyOn(window, 'open');
    expect(api.download(makeItem(dir('d')))).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it('forces a new window even with saveAs', () => {
    (window as unknown as Record<string, unknown>).saveAs = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    api.download(items()[0], true);
    expect(open).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(0);
  });

  it('opens a new window when downloadFilesByAjax is off', () => {
    (window as unknown as Record<string, unknown>).saveAs = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    createApi(makeConfig({ downloadFilesByAjax: false }), i18n).download(items()[0]);
    expect(open).toHaveBeenCalledOnce();
  });

  it('downloads by ajax when saveAs exists and saves the body', async () => {
    const saveAs = vi.fn();
    (window as unknown as Record<string, unknown>).saveAs = saveAs;
    const open = vi.spyOn(window, 'open');
    reply = () => ({ body: 'file content', contentType: 'application/octet-stream' });
    const result = api.download(items()[0]) as Promise<unknown>;
    expect(api.inprocess).toBe(true);
    await expect(result).resolves.toBe('file content');
    await flush();
    expect(open).not.toHaveBeenCalled();
    expect(requests[0]).toMatchObject({ method: 'GET', url: '/api/downloadFile?action=download&path=%2Fdocs%2Fa.txt' });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), 'a.txt');
    expect(api.inprocess).toBe(false);
  });

  it('reports a failed ajax download with the translated default', async () => {
    (window as unknown as Record<string, unknown>).saveAs = vi.fn();
    reply = () => ({ status: 500, body: 'x', contentType: 'text/plain' });
    await expect(api.download(items()[0]) as Promise<unknown>).rejects.toBe('x');
    expect(api.error).toBe('Error 500 - Bridge response error, please check the API docs or this ajax response.');
  });

  it('downloadMultiple by ajax requests the bare URL without parameters (Q-20)', async () => {
    const saveAs = vi.fn();
    (window as unknown as Record<string, unknown>).saveAs = saveAs;
    reply = () => ({ body: 'zip', contentType: 'application/zip' });
    await (api.downloadMultiple(items()) as Promise<unknown>);
    await flush();
    expect(requests[0]).toMatchObject({ method: 'GET', url: '/api/downloadMultiple' });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^\d{5}-angular-filemanager\.zip$/));
  });

  it('downloadMultiple file name has the timestamp slice of Q-35', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    vi.useFakeTimers();
    vi.setSystemTime(1234567890123);
    api.downloadMultiple(items());
    vi.useRealTimers();
    expect(open.mock.calls[0][0]).toContain('toFilename=' + '1234567890123'.substr(8, 13) + '-angular-filemanager.zip');
  });
});

describe('upload', () => {
  const files = () => [new File(['a'], 'one.txt'), new File(['b'], 'two.txt')];

  it('sends destination and file-n as multipart form data with the AngularJS headers', async () => {
    const Xhr = stubXhr();
    // The AngularJS handler never initialised it: the hidden upload block renders "... %" until the first upload.
    expect(api.progress).toBeUndefined();
    const promise = api.upload(files(), ['docs']);
    const xhr = Xhr.instances[0];
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('/api/upload');
    expect(xhr.headers).toEqual({ Accept: 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' });
    expect([...xhr.sent!.keys()]).toEqual(['destination', 'file-0', 'file-1']);
    expect(xhr.sent!.get('destination')).toBe('/docs');
    expect((xhr.sent!.get('file-1') as File).name).toBe('two.txt');
    expect(api.inprocess).toBe(true);
    expect(api.progress).toBe(0);
    xhr.respond(200, { result: { ok: true } });
    await expect(promise).resolves.toEqual({ result: { ok: true } });
    expect(api.inprocess).toBe(false);
  });

  it('matches the recorded field names', async () => {
    const Xhr = stubXhr();
    const promise = api.upload(files(), ['docs']);
    const xhr = Xhr.instances[0];
    expect([...xhr.sent!.keys()]).toEqual(recorded.upload.fieldNames);
    expect(xhr.sent!.get('destination')).toBe(recorded.upload.destination);
    expect(xhr.url).toBe(recorded.upload.url);
    xhr.respond(200, { result: {} });
    await promise;
  });

  it('reports progress as the percentage minus one and resets it afterwards (Q-34)', async () => {
    const Xhr = stubXhr();
    const promise = api.upload(files(), []);
    const xhr = Xhr.instances[0];
    xhr.emitProgress(50, 200);
    expect(api.progress).toBe(24);
    xhr.emitProgress(199, 200);
    expect(api.progress).toBe(98);
    xhr.emitProgress(200, 200);
    expect(api.progress).toBe(99);
    xhr.emitProgress(250, 200);
    expect(api.progress).toBe(99);
    xhr.emitProgress(0, 200);
    expect(api.progress).toBe(-1);
    xhr.respond(200, { result: {} });
    await promise;
    expect(api.progress).toBe(0);
  });

  it('rejects with result.error from a failed upload', async () => {
    const Xhr = stubXhr();
    const promise = api.upload(files(), []);
    Xhr.instances[0].respond(400, { result: { error: 'too big' } });
    await expect(promise).rejects.toEqual({ result: { error: 'too big' } });
    expect(api.error).toBe('too big');
    expect(api.inprocess).toBe(false);
  });

  it('uses the default message for a failure without error text', async () => {
    const Xhr = stubXhr();
    const promise = api.upload(files(), []);
    Xhr.instances[0].respond(500, { foo: 1 });
    await expect(promise).rejects.toBeDefined();
    expect(api.error).toBe('Unknown error uploading files');
  });

  it('turns a network failure into the bridge error without throwing (Q-30)', async () => {
    const Xhr = stubXhr();
    const promise = api.upload(files(), []);
    Xhr.instances[0].onerror!();
    await expect(promise).rejects.toBeNull();
    expect(api.error).toContain('Error -1 - Bridge response error');
    expect(api.inprocess).toBe(false);
  });

  it('with an empty file list sends nothing and never settles while inprocess stays true (carried over from the AngularJS frontend)', async () => {
    const Xhr = stubXhr();
    const settled = vi.fn();
    api.upload([], ['docs']).then(settled, settled);
    await flush();
    expect(Xhr.instances).toHaveLength(0);
    expect(settled).not.toHaveBeenCalled();
    expect(api.inprocess).toBe(true);
    expect(api.progress).toBe(0);
  });

  it('the AngularJS code did the same for an empty list', async () => {
    const Xhr = stubXhr();
    const settled = vi.fn();
    api.upload([], ['docs']).then(settled, settled);
    await flush();
    expect(Xhr.instances).toHaveLength(recorded.emptyUpload.calls);
    expect(settled.mock.calls.length > 0).toBe(recorded.emptyUpload.settled);
    expect(api.inprocess).toBe(recorded.emptyUpload.inprocess);
  });
});
