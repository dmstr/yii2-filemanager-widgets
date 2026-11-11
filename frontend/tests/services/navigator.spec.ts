import { afterEach, describe, expect, it, vi } from 'vitest';
import { isReactive } from 'vue';
import { Item, type RawItem } from '../../src/models/Item.ts';
import { createNavigator, type TreeNode } from '../../src/services/navigator.ts';
import { loadFixture } from '../utils/fixtures.ts';
import { dir, file, flush, makeConfig, makeI18n, stubFetch, type FakeReply, type RecordedRequest } from './helpers.ts';

afterEach(() => vi.unstubAllGlobals());

const config = makeConfig();

/**
 * Recorded runs of the `fileNavigator` of the AngularJS 1.x frontend: the folder contents by request path
 * (the port gets them through fetch), and for each sequence of folder visits the tree after every visit.
 */
const recorded = loadFixture<{
  tree: Record<string, RawItem[]>;
  walks: Array<{ label: string; visits: string[][]; trees: unknown[] }>;
  failedListError: { afterFailure: string; afterNextHandler: string };
}>('services/navigator.json');
const tree = recorded.tree;

function setup(reply?: (request: RecordedRequest) => FakeReply) {
  const requests = stubFetch(
    reply ||
      ((request) => ({ body: { result: tree[(request.body as { path: string }).path] || [] } })),
  );
  const nav = createNavigator(config, makeI18n());
  return { nav, requests };
}

const strip = (nodes: TreeNode[]): unknown[] => nodes.map((n) => ({ name: n.name, nodes: strip(n.nodes) }));

describe('refresh', () => {
  it('lists the current path and fills fileList with reactive Items', async () => {
    const { nav, requests } = setup();
    const done = nav.refresh();
    expect(nav.requesting).toBe(true);
    expect(nav.fileList).toEqual([]);
    await done;
    expect(requests[0].url).toBe('/api/list');
    expect(requests[0].body).toEqual({ action: 'list', path: '/' });
    expect(nav.requesting).toBe(false);
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['b', 'A', 'c', 'readme.txt']);
    expect(nav.fileList[0]).toBeInstanceOf(Item);
    expect(isReactive(nav.fileList[0])).toBe(true);
  });

  it('sends only the action and the path when listing', async () => {
    const { nav, requests } = setup();
    await nav.refresh();
    expect(requests[0].body).toEqual({ action: 'list', path: '/' });
  });

  it('passes keepState on to onRefresh so a reload can leave the selection alone', async () => {
    const { nav } = setup();
    const onRefresh = vi.fn();
    nav.onRefresh = onRefresh;
    await nav.refresh();
    await nav.refresh(true);
    expect(onRefresh.mock.calls).toEqual([[false], [true]]);
  });

  it('calls onRefresh after the list and tree are built, not on failure', async () => {
    const { nav } = setup();
    let seen: string[] = [];
    nav.onRefresh = () => {
      seen = nav.fileList.map((i) => i.model.name);
      expect(nav.history[0].nodes.length).toBe(3);
    };
    await nav.refresh();
    expect(seen).toHaveLength(4);

    const failing = setup(() => ({ status: 500, body: { x: 1 } }));
    const onRefresh = vi.fn();
    failing.nav.onRefresh = onRefresh;
    await failing.nav.refresh().catch(() => {});
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('copes with a result of null (empty list)', async () => {
    const { nav } = setup(() => ({ body: { result: null } }));
    await nav.refresh();
    expect(nav.fileList).toEqual([]);
  });

  it('keeps its error apart from the api error of other navigators', async () => {
    const a = setup(() => ({ body: { result: { error: 'denied' } } }));
    await a.nav.refresh().catch(() => {});
    expect(a.nav.error).toBe('denied');
    expect(a.nav.requesting).toBe(false);
    expect(a.nav.fileList).toEqual([]);
  });

  it.each([
    ['404', { status: 404, body: '' }, 'Error 404 - Backend bridge is not working, please check the ajax response.'],
    ['non-JSON', { body: '<html>', contentType: 'text/html' }, 'Error 200 - Bridge response error, please check the API docs or this ajax response.'],
    ['error.message', { body: { error: { message: 'bridge down' } } }, 'bridge down'],
    ['other failure', { status: 500, body: { a: 1 } }, 'Unknown error listing, check the response'],
    ['network failure', { networkError: true }, 'Error -1 - Bridge response error, please check the API docs or this ajax response.'],
  ] as Array<[string, FakeReply, string]>)('sets the error for %s', async (_label, answer, message) => {
    const { nav } = setup(() => answer);
    await expect(nav.refresh()).rejects.toBeDefined();
    expect(nav.error).toBe(message);
  });

  it('does not overwrite an existing error with result.error (navigator variant)', async () => {
    const { nav } = setup(() => ({ status: 404, body: { result: { error: 'custom' } } }));
    await nav.refresh().catch(() => {});
    expect(nav.error).toBe('Error 404 - Backend bridge is not working, please check the ajax response.');
  });

  it('Q-02: a failed list no longer poisons the next refresh', async () => {
    let fail = true;
    const { nav } = setup(() => (fail ? { body: { result: { error: 'denied' } } } : { body: { result: [dir('ok')] } }));
    await nav.refresh().catch(() => {});
    expect(nav.error).toBe('denied');
    fail = false;
    await nav.refresh();
    expect(nav.error).toBe('');
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['ok']);
  });

  it('the AngularJS navigator kept a failed error, which is what Q-02 fixes', async () => {
    // Recorded: after a failed list the next successful handler call still saw the error.
    expect(recorded.failedListError).toEqual({ afterFailure: 'denied', afterNextHandler: 'denied' });
    let fail = true;
    const { nav } = setup(() => (fail ? { body: { result: { error: 'denied' } } } : { body: { result: [] } }));
    await nav.refresh().catch(() => {});
    expect(nav.error).toBe(recorded.failedListError.afterFailure);
    fail = false;
    await nav.refresh();
    expect(nav.error).not.toBe(recorded.failedListError.afterNextHandler);
    expect(nav.error).toBe('');
  });
});

describe('overlapping refreshes', () => {
  /** Answers every list request when the test releases it, so the order of the responses is the test's choice. */
  function gated(answers: Record<string, FakeReply>) {
    const gates: Record<string, Array<() => void>> = {};
    stubFetch(
      (request) =>
        new Promise<FakeReply>((resolve) => {
          const path = (request.body as { path: string }).path;
          (gates[path] ||= []).push(() => resolve(answers[path]));
        }),
    );
    const nav = createNavigator(config, makeI18n());
    const release = async (path: string) => {
      gates[path].shift()!();
      await flush();
    };
    return { nav, release };
  }

  const answers = (): Record<string, FakeReply> => ({
    '/A': { body: { result: [file('a1'), dir('a-sub')] } },
    '/B': { body: { result: [file('b1'), dir('b-sub')] } },
    '/C': { body: { result: [file('c1')] } },
    '/F': { body: { result: { error: 'denied' } } },
    '/': { body: { result: [dir('A'), dir('B')] } },
  });

  const visit = (nav: ReturnType<typeof createNavigator>, path: string[]) => {
    nav.currentPath = path;
    return nav.refresh();
  };

  it('ignores a late answer for A once B was requested', async () => {
    const { nav, release } = gated(answers());
    const root = visit(nav, []);
    await release('/');
    await root;
    const a = visit(nav, ['A']);
    const b = visit(nav, ['B']);
    await release('/B');
    expect(nav.requesting).toBe(false);
    await release('/A');
    await Promise.all([a, b]);
    expect(nav.requesting).toBe(false);
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['b1', 'b-sub']);
    expect(nav.fileList.map((i) => i.model.fullPath())).toEqual(['/B/b1', '/B/b-sub']);
    expect(strip(nav.history)).toEqual([
      { name: '', nodes: [{ name: 'A', nodes: [] }, { name: 'B', nodes: [{ name: 'B/b-sub', nodes: [] }] }] },
    ]);
  });

  it('keeps the loading flag until the latest answer when A answers first', async () => {
    const { nav, release } = gated(answers());
    const a = visit(nav, ['A']);
    const b = visit(nav, ['B']);
    await release('/A');
    await a;
    expect(nav.requesting).toBe(true);
    expect(nav.fileList).toEqual([]);
    await release('/B');
    await b;
    expect(nav.requesting).toBe(false);
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['b1', 'b-sub']);
  });

  it('applies only the last of three overlapping requests', async () => {
    const { nav, release } = gated(answers());
    const all = [visit(nav, ['A']), visit(nav, ['B']), visit(nav, ['C'])];
    await release('/B');
    await release('/C');
    await release('/A');
    await Promise.all(all);
    expect(nav.requesting).toBe(false);
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['c1']);
  });

  it('lets a superseded failure neither set an error nor reject', async () => {
    const { nav, release } = gated(answers());
    const f = visit(nav, ['F']);
    const b = visit(nav, ['B']);
    await release('/B');
    await release('/F');
    await expect(f).resolves.toBeUndefined();
    await b;
    expect(nav.error).toBe('');
    expect(nav.fileList.map((i) => i.model.name)).toEqual(['b1', 'b-sub']);
  });

  it('lets a superseded success not clear the error of a newer failure', async () => {
    const { nav, release } = gated(answers());
    const b = visit(nav, ['B']);
    const f = visit(nav, ['F']);
    await release('/F');
    await expect(f).rejects.toBeDefined();
    expect(nav.error).toBe('denied');
    await release('/B');
    await b;
    expect(nav.error).toBe('denied');
    expect(nav.fileList).toEqual([]);
    expect(nav.requesting).toBe(false);
  });

  it('calls onRefresh once per applied listing', async () => {
    const { nav, release } = gated(answers());
    const onRefresh = vi.fn();
    nav.onRefresh = onRefresh;
    const all = [visit(nav, ['A']), visit(nav, ['B'])];
    await release('/A');
    await release('/B');
    await Promise.all(all);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps two navigators independent', async () => {
    const { nav: main, release } = gated(answers());
    const dialog = createNavigator(config, makeI18n());
    const a = visit(main, ['A']);
    const d = visit(dialog, ['C']);
    await release('/A');
    await release('/C');
    await Promise.all([a, d]);
    expect(main.fileList.map((i) => i.model.name)).toEqual(['a1', 'a-sub']);
    expect(dialog.fileList.map((i) => i.model.name)).toEqual(['c1']);
    expect(main.requesting).toBe(false);
    expect(dialog.requesting).toBe(false);
  });
});

describe('navigation', () => {
  it('folderClick enters a folder, upDir and goTo walk back', async () => {
    const { nav, requests } = setup();
    await nav.refresh();
    nav.folderClick(nav.fileList[0]);
    await flush();
    expect(nav.currentPath).toEqual(['b']);
    expect(requests[requests.length - 1].body).toMatchObject({ path: '/b' });
    nav.folderClick(nav.fileList[0]);
    await flush();
    expect(nav.currentPath).toEqual(['b', 'z']);
    nav.upDir();
    await flush();
    expect(nav.currentPath).toEqual(['b']);
    nav.goTo(-1);
    await flush();
    expect(nav.currentPath).toEqual([]);
    nav.upDir();
    expect(requests).toHaveLength(5);
  });

  it('folderClick without a folder goes to the root; a file does too', async () => {
    const { nav } = setup();
    nav.currentPath = ['b'];
    nav.folderClick();
    expect(nav.currentPath).toEqual([]);
    await flush();
    nav.currentPath = ['b'];
    nav.folderClick(new Item(file('f'), [], config));
    expect(nav.currentPath).toEqual([]);
    await flush();
  });

  it('goTo keeps the first index+1 segments', async () => {
    const { nav } = setup();
    nav.currentPath = ['a', 'b', 'c'];
    nav.goTo(1);
    expect(nav.currentPath).toEqual(['a', 'b']);
    await flush();
  });

  it('fileNameExists trims and compares names; listHasFolders finds a folder', async () => {
    const { nav } = setup();
    await nav.refresh();
    expect(nav.fileNameExists('  readme.txt ')?.model.name).toBe('readme.txt');
    expect(nav.fileNameExists('README.txt')).toBeUndefined();
    expect(nav.fileNameExists('')).toBeUndefined();
    expect(nav.listHasFolders()).toBeDefined();
    const empty = setup(() => ({ body: { result: [file('f')] } }));
    await empty.nav.refresh();
    expect(empty.nav.listHasFolders()).toBeUndefined();
  });
});

describe('buildTree', () => {
  /** Walks the folder visits through the port. */
  async function walk(visits: string[][]) {
    const { nav } = setup();
    const snapshots: Array<{ port: unknown; path: string[] }> = [];
    for (const path of visits) {
      // Navigate by setting the path and refreshing, as upDir/goTo/folderClick do.
      nav.currentPath = path;
      await nav.refresh();
      snapshots.push({ port: strip(nav.history), path });
    }
    return snapshots;
  }

  it('grows lazily and sorts siblings case-insensitively', async () => {
    const [root] = await walk([[]]);
    expect(root.port).toEqual([
      { name: '', nodes: [{ name: 'A', nodes: [] }, { name: 'b', nodes: [] }, { name: 'c', nodes: [] }] },
    ]);
  });

  it.each(recorded.walks.map((entry) => [entry.label, entry] as const))('equals the recorded AngularJS tree after %s', async (_label, entry) => {
    const snapshots = await walk(entry.visits);
    expect(snapshots).toHaveLength(entry.trees.length);
    snapshots.forEach(({ port, path }, step) => {
      expect(port, 'after visiting /' + path.join('/')).toEqual(entry.trees[step]);
    });
  });

  it('prunes branches that are not on the visited path', async () => {
    const snapshots = await walk([[], ['b'], ['b', 'z'], [], ['A']]);
    const last = snapshots[snapshots.length - 1].port as Array<{ nodes: Array<{ name: string; nodes: unknown[] }> }>;
    // Listing the root resets the nodes below it; only A was entered afterwards.
    expect(last[0].nodes.find((n) => n.name === 'b')!.nodes).toEqual([]);
    expect(last[0].nodes.find((n) => n.name === 'A')!.nodes).toHaveLength(2);
  });

  describe('siblings whose names are prefixes of each other', () => {
    const folders: Record<string, RawItem[]> = {
      '/': [dir('doc'), dir('documents'), dir('a'), dir('ab')],
      '/doc': [dir('x')],
      '/documents': [dir('y')],
      '/a': [dir('c')],
      '/ab': [dir('d')],
    };
    async function visitAll(visits: string[][]) {
      const { nav } = setup((request) => ({ body: { result: folders[(request.body as { path: string }).path] || [] } }));
      for (const path of visits) {
        nav.currentPath = path;
        await nav.refresh();
      }
      return strip(nav.history[0].nodes) as Array<{ name: string; nodes: unknown[] }>;
    }
    const children = (nodes: Array<{ name: string; nodes: unknown[] }>, name: string) => nodes.find((n) => n.name === name)!.nodes;

    it('prunes doc when documents is listed after it', async () => {
      const nodes = await visitAll([[], ['doc'], ['documents']]);
      expect(children(nodes, 'doc')).toEqual([]);
      expect(children(nodes, 'documents')).toEqual([{ name: 'documents/y', nodes: [] }]);
    });

    it('prunes a when ab is listed after it', async () => {
      const nodes = await visitAll([[], ['a'], ['ab']]);
      expect(children(nodes, 'a')).toEqual([]);
      expect(children(nodes, 'ab')).toEqual([{ name: 'ab/d', nodes: [] }]);
    });

    it('prunes the longer sibling when the shorter one is listed after it', async () => {
      const nodes = await visitAll([[], ['documents'], ['doc']]);
      expect(children(nodes, 'documents')).toEqual([]);
      expect(children(nodes, 'doc')).toEqual([{ name: 'doc/x', nodes: [] }]);
    });

    it('keeps the branch of the listed folder when its parent is listed through a prefix-named sibling', async () => {
      const nodes = await visitAll([[], ['a'], [], ['a']]);
      expect(children(nodes, 'a')).toEqual([{ name: 'a/c', nodes: [] }]);
      expect(children(nodes, 'ab')).toEqual([]);
    });
  });

  it('keeps the item of every node so the sidebar can navigate by it', async () => {
    const { nav } = setup();
    await nav.refresh();
    const node = nav.history[0].nodes[0];
    expect(node.item).toBeInstanceOf(Item);
    expect(node.item!.model.name).toBe('A');
    expect(nav.history[0].item).toBeUndefined();
  });
});
