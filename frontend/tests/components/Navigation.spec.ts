import { afterEach, describe, expect, it } from 'vitest';
import { dir, file, isShown, mountWidget, settle, type Mounted } from './helpers.ts';

let app: Mounted;
afterEach(() => app?.wrapper.unmount());

/** Folder tree served by path, so navigation builds a nested history. */
const tree: Record<string, unknown[]> = {
  '/': [dir('alpha'), dir('Beta'), file('root.txt')],
  '/alpha': [dir('nested-folder-with-a-long-name'), dir('x'.repeat(40)), file('a.txt')],
  ['/alpha/' + 'x'.repeat(40)]: [],
  '/alpha/nested-folder-with-a-long-name': [dir('deep'), file('n.txt')],
  '/alpha/nested-folder-with-a-long-name/deep': [],
};
const reply = (request: { body: unknown }) => {
  const body = request.body as { action: string; path: string };
  return { body: { result: tree[body.path] ?? [] } };
};

async function goDown(names: string[]) {
  for (const name of names) {
    app.fm.navigator.folderClick(app.fm.navigator.fileList.find((item) => item.model.name === name));
    await settle();
  }
}

describe('Sidebar', () => {
  it('renders the root node and the visited folders of the first listing, sorted without case', async () => {
    app = await mountWidget({ reply });
    const root = app.wrapper.findAll('.file-tree-root > li');
    expect(root).toHaveLength(1);
    const children = root[0].findAll(':scope > ul > li');
    expect(children.map((li) => li.find('a').text())).toEqual(['alpha', 'Beta']);
    expect(root[0].find('a').text()).toBe('/');
  });

  it('marks the current folder active and opens the folders on the current path', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha', 'nested-folder-with-a-long-name']);
    const lis = app.wrapper.findAll('.file-tree-root li');
    const active = lis.filter((li) => li.classes('active'));
    expect(active).toHaveLength(1);
    expect(active[0].find('a').text()).toBe('nested-folder-with-a-long-name');

    const alpha = lis.find((li) => li.find('a').text() === 'alpha')!;
    const link = alpha.find('a');
    expect(isShown(link.find('.glyphicon-chevron-down').element)).toBe(true);
    expect(isShown(link.find('.glyphicon-chevron-right').element)).toBe(false);
    expect(isShown(link.find('.glyphicon-folder-open').element)).toBe(true);
    expect(isShown(link.find('.glyphicon-folder-close').element)).toBe(false);

    // The unrelated folder "Beta" is not on the path.
    const beta = lis.find((li) => li.find('a').text() === 'Beta')!;
    expect(isShown(beta.find('a .glyphicon-chevron-right').element)).toBe(true);
    expect(isShown(beta.find('a .glyphicon-folder-close').element)).toBe(true);
  });

  it('draws only the folders on the current path as open, not siblings whose names are substrings of it', async () => {
    const siblings: Record<string, unknown[]> = {
      '/': [dir('a'), dir('at'), dir('data'), dir('x'), dir('doc'), dir('documents')],
      '/data': [dir('x'), dir('y')],
      '/data/x': [],
    };
    app = await mountWidget({ reply: (request) => ({ body: { result: siblings[(request.body as { path: string }).path] ?? [] } }) });
    await goDown(['data', 'x']);
    const open = (li: { find: (selector: string) => { element: Element } }) => isShown(li.find('a .glyphicon-folder-open').element);
    const lis = app.wrapper.findAll('.file-tree-root li');
    const state = Object.fromEntries(
      lis.map((li) => [li.find('a').text(), open(li)] as const).filter(([label]) => label !== '/'),
    );
    // The two folders named "x" share a label; the one below "data" is on the path, the one at the root is not.
    expect(lis.filter((li) => li.find('a').text() === 'x').map(open)).toEqual([true, false]);
    expect(state).toMatchObject({ a: false, at: false, data: true, doc: false, documents: false, y: false });
    expect(open(app.wrapper.find('.file-tree-root > li'))).toBe(true);
  });

  it('nests the tree three levels deep and truncates names to 30 characters', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha']);
    const labels = app.wrapper.findAll('.file-tree-root ul ul li a').map((a) => a.text());
    expect(labels).toContain('x'.repeat(30) + '...');
  });

  it('shows the tree three levels deep after navigating down', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha', 'nested-folder-with-a-long-name', 'deep']);
    expect(app.wrapper.findAll('.file-tree-root li')).toHaveLength(6);
    expect(app.wrapper.findAll('.file-tree-root ul ul ul li')).toHaveLength(1);
  });

  it('navigates when a node is clicked, and the click does not follow the href', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha']);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    app.wrapper.find('.file-tree-root > li > a').element.dispatchEvent(event);
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(app.fm.navigator.currentPath).toEqual([]);
    expect(app.requests[app.requests.length - 1].body).toMatchObject({ action: 'list', path: '/' });
  });
});

describe('Breadcrumb', () => {
  // Scoped to the navbar: the destination dialog has a breadcrumb of its own.
  const crumbs = () => app.wrapper.find('nav.navbar').findAll('.breadcrumb li');

  it('starts with the app name for the root and nothing else', async () => {
    app = await mountWidget({ reply, config: { appName: 'My files' } });
    expect(crumbs()).toHaveLength(1);
    expect(crumbs()[0].text()).toBe('My files');
  });

  it('shows the default root name when no name is configured', async () => {
    app = await mountWidget({ reply });
    expect(crumbs()[0].text()).toBe('/');
  });

  it('links intermediate folders cut to 8 characters and shows the last one as text cut to 12', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha', 'nested-folder-with-a-long-name']);

    const [, first, last] = crumbs();
    expect(isShown(first.find('a').element)).toBe(true);
    expect(first.find('a').text()).toBe('alpha');
    expect(isShown(first.find('span').element)).toBe(false);
    expect(last.classes()).toContain('active');
    expect(isShown(last.find('a').element)).toBe(false);
    expect(last.find('span').text()).toBe('nested-folde...');
    expect(first.classes()).not.toContain('active');
    expect(first.classes()).toEqual(expect.arrayContaining(['animated', 'fast', 'fadeIn']));
  });

  it('truncates a long intermediate folder to 8 characters', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha', 'nested-folder-with-a-long-name']);
    expect(crumbs()[1].find('a').text()).toBe('alpha');
    await goDown(['deep']);
    expect(crumbs()[2].find('a').text()).toBe('nested-f...');
  });

  it('goes to the root from the first crumb and to a level from an intermediate one', async () => {
    app = await mountWidget({ reply });
    await goDown(['alpha', 'nested-folder-with-a-long-name']);
    await crumbs()[1].find('a').trigger('click');
    await settle();
    expect(app.fm.navigator.currentPath).toEqual(['alpha']);
    await crumbs()[0].find('a').trigger('click');
    await settle();
    expect(app.fm.navigator.currentPath).toEqual([]);
  });
});
