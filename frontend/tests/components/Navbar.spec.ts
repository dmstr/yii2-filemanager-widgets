import { afterEach, describe, expect, it } from 'vitest';
import { isShown, mountWidget, settle, type Mounted } from './helpers.ts';

let app: Mounted;
afterEach(() => app?.wrapper.unmount());

const VIEWS = ['main-icons.html', 'main-table.html', 'main-icons-preview.html'] as const;
const button = (name: 'fm-icons' | 'fm-table' | 'fm-preview') => app.wrapper.find(`.${name}`);
/** The names of the visible view switch buttons. */
const visibleSwitches = (): string[] =>
  (['fm-icons', 'fm-table', 'fm-preview'] as const).filter((name) => button(name).exists() && isShown(button(name).element));

describe('view switch buttons (F-05)', () => {
  // View to the one button that moves on from it, without and with the preview view.
  const without: Record<string, string[]> = {
    'main-icons.html': ['fm-table'],
    'main-table.html': ['fm-icons'],
    'main-icons-preview.html': [], // not reachable: a stored preview view falls back to icons
  };
  const withPreview: Record<string, string[]> = {
    'main-icons.html': ['fm-table'],
    'main-table.html': ['fm-preview'],
    'main-icons-preview.html': ['fm-icons'],
  };

  for (const view of VIEWS) {
    it(`without the preview view, ${view} shows ${without[view].join() || 'the icons fallback'}`, async () => {
      app = await mountWidget({ view });
      const expected = view === 'main-icons-preview.html' ? ['fm-table'] : without[view];
      expect(visibleSwitches()).toEqual(expected);
      expect(button('fm-preview').exists()).toBe(false);
    });

    it(`with the preview view, ${view} shows ${withPreview[view].join()}`, async () => {
      app = await mountWidget({ view, config: { enableIconPreviewView: true } });
      expect(visibleSwitches()).toEqual(withPreview[view]);
    });
  }

  it('cycles icons, table, preview, icons by clicking the one visible button', async () => {
    app = await mountWidget({ config: { enableIconPreviewView: true } });
    await button('fm-table').trigger('click');
    expect(app.fm.viewTemplate).toBe('main-table.html');
    await button('fm-preview').trigger('click');
    expect(app.fm.viewTemplate).toBe('main-icons-preview.html');
    await button('fm-icons').trigger('click');
    expect(app.fm.viewTemplate).toBe('main-icons.html');
    expect(window.localStorage.getItem('viewTemplate')).toBe('main-icons.html');
  });

  it('keeps legacy titles, including the raw keys of the three missing translations', async () => {
    app = await mountWidget({ config: { enableIconPreviewView: true } });
    expect(button('fm-icons').attributes('title')).toBe('Switch to icons view');
    expect(button('fm-table').attributes('title')).toBe('Switch to table view');
    expect(button('fm-preview').attributes('title')).toBe('Switch to preview view');
  });
});

describe('navbar controls', () => {
  it('refreshes with recycle: true and the Q-05 tooltip', async () => {
    app = await mountWidget();
    const refresh = app.wrapper.find('nav .glyphicon-refresh').element.parentElement!;
    expect(refresh.getAttribute('title')).toBe('Icons');
    refresh.click();
    await settle();
    expect(app.requests[0].body).toMatchObject({ action: 'list', recycle: true });
  });

  it('hides the search and the more dropdown groups according to the config', async () => {
    app = await mountWidget({ config: { searchForm: false }, allowedActions: { createFolder: false, upload: false } });
    const groups = app.wrapper.findAll('.btn-group');
    expect(groups.map((g) => isShown(g.element))).toEqual([false, false]);
  });

  it('shows only the allowed entries of the more menu', async () => {
    app = await mountWidget({ allowedActions: { upload: false } });
    const items = app.wrapper.findAll('#more + ul li');
    expect(items.map((li) => isShown(li.element))).toEqual([true, false]);
  });

  it('hides the breadcrumb wrapper without config.breadcrumb', async () => {
    app = await mountWidget({ config: { breadcrumb: false } });
    expect(isShown(app.wrapper.find('.breadcrumb').element.parentElement!)).toBe(false);
  });

  it('binds the search field to the query and filters the list', async () => {
    app = await mountWidget();
    await app.wrapper.find('.dropdown-menu input').setValue('NOTES');
    expect(app.fm.query).toBe('NOTES');
    expect(app.wrapper.findAll('.col-120')).toHaveLength(1);
    expect(app.fm.fileList.map((i) => i.model.name)).toEqual(['notes.txt']);
  });

  it('opens the new folder dialog state and the phantom selection from the more menu', async () => {
    app = await mountWidget();
    await app.wrapper.find('#more').trigger('click');
    await app.wrapper.find('#more + ul li').trigger('click');
    expect(app.fm.modals.isOpen('newfolder')).toBe(true);
    expect(app.fm.temps).toHaveLength(1);
  });
});

/** test-utils cannot set `which`, so the key event is built by hand. */
async function press(target: Element, code: number): Promise<void> {
  target.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, which: code, bubbles: true, cancelable: true }));
  await settle();
}

describe('dropdown behaviour (Bootstrap 3.4.1 rules)', () => {
  const group = (id: 'more' | 'dropDownMenuLang') => app.wrapper.find(`#${id}`).element.parentElement!;
  const toggle = (id: 'more' | 'dropDownMenuLang') => app.wrapper.find(`#${id}`);

  it('ships aria-expanded="true" and no data-toggle', async () => {
    app = await mountWidget();
    expect(toggle('more').attributes('aria-expanded')).toBe('true');
    expect(toggle('more').attributes('data-toggle')).toBeUndefined();
    expect(group('more').classList.contains('open')).toBe(false);
  });

  it('opens on a click on the button and closes on a second click', async () => {
    app = await mountWidget();
    await toggle('more').trigger('click');
    expect(group('more').classList.contains('open')).toBe(true);
    expect(toggle('more').attributes('aria-expanded')).toBe('true');
    await toggle('more').trigger('click');
    expect(group('more').classList.contains('open')).toBe(false);
    expect(toggle('more').attributes('aria-expanded')).toBe('false');
  });

  it('closes when another dropdown opens', async () => {
    app = await mountWidget();
    await toggle('more').trigger('click');
    await toggle('dropDownMenuLang').trigger('click');
    expect(group('more').classList.contains('open')).toBe(false);
    expect(group('dropDownMenuLang').classList.contains('open')).toBe(true);
  });

  it('closes on any click outside', async () => {
    app = await mountWidget();
    await toggle('more').trigger('click');
    document.body.click();
    await settle();
    expect(group('more').classList.contains('open')).toBe(false);
  });

  it('closes when a menu item is clicked', async () => {
    app = await mountWidget();
    await toggle('more').trigger('click');
    await app.wrapper.find('#more + ul li a').trigger('click');
    expect(group('more').classList.contains('open')).toBe(false);
  });

  it('stays open on a click into the search text field', async () => {
    app = await mountWidget();
    await toggle('dropDownMenuLang').trigger('click');
    await app.wrapper.find('.dropdown-menu input').trigger('click');
    expect(group('dropDownMenuLang').classList.contains('open')).toBe(true);
  });

  it('closes on Escape on the toggle or in the menu, but not from inside the text field', async () => {
    app = await mountWidget();
    await toggle('dropDownMenuLang').trigger('click');
    await press(app.wrapper.find('.dropdown-menu input').element, 27);
    expect(group('dropDownMenuLang').classList.contains('open')).toBe(true);
    await press(toggle('dropDownMenuLang').element, 27);
    expect(group('dropDownMenuLang').classList.contains('open')).toBe(false);

    await toggle('more').trigger('click');
    await press(app.wrapper.find('#more + ul').element, 27);
    expect(group('more').classList.contains('open')).toBe(false);
  });

  it('opens a closed menu on space on the toggle', async () => {
    app = await mountWidget();
    await press(toggle('more').element, 32);
    expect(group('more').classList.contains('open')).toBe(true);
  });

  it('does not let the toggle click reach the document', async () => {
    app = await mountWidget();
    let reached = false;
    const listener = () => (reached = true);
    document.addEventListener('click', listener);
    await toggle('more').trigger('click');
    document.removeEventListener('click', listener);
    expect(reached).toBe(false);
  });
});
