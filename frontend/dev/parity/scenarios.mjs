/**
 * Parity scenarios. Each one is driven identically on `legacy.html` and
 * `index.html`; every `snap()` call yields one screenshot pair and one DOM
 * comparison (without a call, the end state is snapshotted once).
 *
 * Fields: `name`, `query` (harness config flags, see dev/config.js),
 * `storage` (localStorage entries set before the app starts), `forceError`
 * (HTTP status the mock answers every API request with) and `run(page, h)`.
 * `known` lists differences that are decided deviations: `{ pattern, reason }`
 * entries; a diff line matching `pattern` is reported as known, not as failure.
 * `h` offers `snap(label)`, `settle()`, `item(name)` and `row(name)`.
 */

const VIEW = { icons: 'main-icons.html', table: 'main-table.html', preview: 'main-icons-preview.html' };

/**
 * Multi-select modifier for the context menu cases: on macOS a Ctrl-click is
 * a right-click, so there it is Cmd (the code treats both the same).
 */
const MULTI = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Inventory decision 9.1: the fixed Q-03 shows the permissions entry only for exactly one item. */
const Q03 = {
  pattern: /ul\[0\] > li\[12\] <li>: hidden legacy null vs vue true$/,
  reason: 'Q-03 fixed: permissions entry only for exactly one selected item',
};

/** The same decision moves every entry below the permissions entry by one row, so the menu's boxes differ. */
const Q03_LAYOUT = {
  pattern: /div\[3\] > div\[0\].*: rect legacy/,
  reason: 'Q-03 fixed: the missing permissions entry shifts the boxes of the entries below it',
};

const ALL_FLAGS = 'allow=rename,changePermissions&editable=1&pick=1&custom=1';

/** Names in the list, found through their tooltip (`name (size)`) which both views carry. */
const itemSelector = (name) => `angular-filemanager [title^="${name} ("]`;

const scenarios = [];
const add = (scenario) => scenarios.push(scenario);

// -------------------------------------------------------------------- initial load

for (const view of ['icons', 'table']) {
  add({ name: `initial-${view}`, storage: { viewTemplate: VIEW[view] } });
}
add({ name: 'initial-preview', query: 'preview=1', storage: { viewTemplate: VIEW.preview } });
add({
  name: 'preview-thumbnails-images-folder',
  query: 'preview=1&thumbs=1',
  storage: { viewTemplate: VIEW.preview },
  async run(page, h) {
    await h.enter('Images');
  },
});
add({ name: 'initial-table-permissions-column', query: 'perms=1', storage: { viewTemplate: VIEW.table } });

// The three view switch buttons, with and without the preview view.
add({
  name: 'view-switch-cycle-with-preview',
  query: 'preview=1',
  async run(page, h) {
    await h.snap('icons');
    await page.click('angular-filemanager .fm-table');
    await h.snap('table');
    await page.click('angular-filemanager .fm-preview');
    await h.snap('preview');
    await page.click('angular-filemanager .fm-icons');
    await h.snap('icons-again');
  },
});
add({
  name: 'view-switch-cycle-without-preview',
  async run(page, h) {
    await h.snap('icons');
    await page.click('angular-filemanager .fm-table');
    await h.snap('table');
    await page.click('angular-filemanager .fm-icons');
    await h.snap('icons-again');
  },
});

// -------------------------------------------------------------------- navigation

for (const view of ['icons', 'table']) {
  add({
    name: `subfolder-two-levels-${view}`,
    storage: { viewTemplate: VIEW[view] },
    async run(page, h) {
      await h.enter('Documents');
      await h.enter('Reports');
      await h.snap('two-levels');
      await page.click('angular-filemanager .breadcrumb li:nth-child(2) a');
      await h.settle();
      await h.snap('back-via-breadcrumb');
    },
  });
}
add({
  name: 'subfolder-three-levels-sidebar-click',
  async run(page, h) {
    await h.enter('Documents');
    await h.enter('Reports');
    await h.enter('2024');
    await page.click('angular-filemanager .sidebar a >> text=Images');
    await h.settle();
  },
});
add({
  name: 'long-breadcrumb-truncation',
  async run(page, h) {
    await h.enter('Müller Ärger');
    await h.snap('umlaut-folder');
  },
});
for (const view of ['icons', 'table', 'preview']) {
  add({
    name: `empty-folder-${view}`,
    query: 'preview=1',
    storage: { viewTemplate: VIEW[view] },
    async run(page, h) {
      await h.enter('Empty folder');
    },
  });
  add({ name: `error-${view}`, query: 'preview=1', storage: { viewTemplate: VIEW[view] }, forceError: 500 });
}
add({ name: 'error-404-table', storage: { viewTemplate: VIEW.table }, forceError: 404 });

// -------------------------------------------------------------------- search and sort

for (const view of ['icons', 'table']) {
  add({
    name: `search-filters-${view}`,
    storage: { viewTemplate: VIEW[view] },
    async run(page, h) {
      await h.search('er');
      await h.snap('er');
      await h.search('ZZZ no match');
      await h.snap('no-match');
    },
  });
}
add({
  name: 'search-dropdown-open',
  async run(page) {
    await page.click('#dropDownMenuLang');
  },
});
add({
  name: 'search-dropdown-stays-open-in-text-field',
  async run(page, h) {
    await page.click('#dropDownMenuLang');
    await page.click('angular-filemanager .dropdown-menu input');
    await h.snap('after-click-in-input');
  },
});
add({
  name: 'more-dropdown-open',
  async run(page) {
    await page.click('#more');
  },
});
add({
  name: 'more-dropdown-then-search-dropdown',
  async run(page, h) {
    await page.click('#more');
    await page.click('#dropDownMenuLang');
    await h.snap('search-open-more-closed');
  },
});
add({
  name: 'more-dropdown-open-close-again',
  async run(page, h) {
    await page.click('#more');
    await page.click('#more');
    await h.snap('closed-again');
  },
});

for (const [index, column] of ['name', 'size', 'date', 'permissions'].entries()) {
  add({
    name: `sort-${column}`,
    query: 'perms=1',
    storage: { viewTemplate: VIEW.table },
    async run(page, h) {
      const header = page.locator('angular-filemanager thead th a').nth(index);
      await header.click();
      await h.snap('ascending');
      await header.click();
      await h.snap('reversed');
    },
  });
}

// -------------------------------------------------------------------- selection

for (const view of ['icons', 'table']) {
  const storage = { viewTemplate: VIEW[view] };
  add({
    name: `select-single-${view}`,
    storage,
    async run(page, h) {
      await h.item('readme.txt').click();
    },
  });
  add({
    name: `select-ctrl-multi-${view}`,
    storage,
    async run(page, h) {
      await h.item('readme.txt').click();
      await h.item('LICENSE').click({ modifiers: ['Control'] });
      await h.item('Documents').click({ modifiers: ['Control'] });
      await h.snap('three');
      await h.item('LICENSE').click({ modifiers: ['Control'] });
      await h.snap('toggled-off');
    },
  });
  add({
    name: `select-shift-range-${view}`,
    storage,
    async run(page, h) {
      await h.item('Images').click();
      await h.item('LICENSE').click({ modifiers: ['Shift'] });
      await h.snap('forward');
      await h.item('Archive').click({ modifiers: ['Shift'] });
      await h.snap('backward');
    },
  });
}
add({
  name: 'select-meta-multi-icons',
  async run(page, h) {
    await h.item('readme.txt').click();
    await h.item('LICENSE').click({ modifiers: ['Meta'] });
    await h.snap('two');
    await h.item('LICENSE').click({ modifiers: ['Meta'] });
    await h.snap('toggled-off');
  },
});
add({
  name: 'select-free-area-clears-icons',
  async run(page, h) {
    await h.item('readme.txt').click();
    await h.snap('selected');
    await h.freeArea().click({ position: await h.freeAreaPosition() });
    await h.snap('cleared');
  },
});
add({
  name: 'select-shift-after-search-hole',
  async run(page, h) {
    await h.item('readme.txt').click();
    await h.search('LICENSE');
    await h.item('LICENSE').click({ modifiers: ['Shift'] });
  },
});

// -------------------------------------------------------------------- context menu

/** Selection cases of the brief; each gets the menu opened on its last step. */
const contextCases = [
  {
    name: 'none',
    async run(h) {
      await h.freeArea().click({ button: 'right', position: await h.freeAreaPosition() });
    },
  },
  { name: 'one-file', run: async (h) => h.item('readme.txt').click({ button: 'right' }) },
  {
    name: 'one-image',
    async run(h) {
      await h.enter('Images');
      await h.item('photo-red.png').click({ button: 'right' });
    },
  },
  {
    name: 'one-archive',
    async run(h) {
      await h.enter('Archive');
      await h.item('backup.zip').click({ button: 'right' });
    },
  },
  { name: 'one-folder', run: async (h) => h.item('Documents').click({ button: 'right' }) },
  {
    name: 'several-files',
    async run(h) {
      await h.item('readme.txt').click();
      await h.item('LICENSE').click({ modifiers: [MULTI] });
      await h.item('LICENSE').click({ button: 'right' });
    },
  },
  {
    name: 'files-and-folder',
    async run(h) {
      await h.item('readme.txt').click();
      await h.item('Documents').click({ modifiers: [MULTI] });
      await h.item('Documents').click({ button: 'right' });
    },
  },
  {
    name: 'selection-with-hole',
    async run(h) {
      await h.item('readme.txt').click();
      await h.search('LICENSE');
      await h.item('LICENSE').click({ modifiers: ['Shift'] });
      await h.item('LICENSE').click({ button: 'right' });
    },
  },
];

for (const [config, query] of [['default', ''], ['all-actions', ALL_FLAGS]]) {
  for (const entry of contextCases) {
    add({
      name: `context-menu-${entry.name}-${config}`,
      query,
      known: [Q03, Q03_LAYOUT],
      async run(page, h) {
        await entry.run(h);
      },
    });
  }
}
for (const view of ['table', 'preview']) {
  add({
    name: `context-menu-one-file-${view}`,
    query: `preview=1&${ALL_FLAGS}`,
    storage: { viewTemplate: VIEW[view] },
    async run(page, h) {
      await h.item('readme.txt').click({ button: 'right' });
    },
  });
}
add({
  name: 'context-menu-position-middle-table',
  storage: { viewTemplate: VIEW.table },
  async run(page, h) {
    await h.row('LICENSE').click({ button: 'right' });
  },
});
add({
  name: 'context-menu-position-right-edge-table',
  storage: { viewTemplate: VIEW.table },
  async run(page, h) {
    const box = await h.row('LICENSE').boundingBox();
    await h.row('LICENSE').click({ button: 'right', position: { x: box.width - 12, y: 8 } });
  },
});
add({
  name: 'context-menu-position-below-scrolled',
  storage: { viewTemplate: VIEW.table },
  async run(page, h) {
    await page.evaluate(() => window.scrollTo(0, 60));
    await h.row('readme.txt').click({ button: 'right', position: { x: 300, y: 5 } });
  },
});
add({
  name: 'context-menu-hides-on-click',
  async run(page, h) {
    await h.item('readme.txt').click({ button: 'right' });
    await h.snap('open');
    await page.click('angular-filemanager .navbar-form', { position: { x: 2, y: 2 } });
    await h.snap('hidden-after-click');
  },
});
add({
  name: 'context-menu-second-right-click-moves',
  async run(page, h) {
    await h.item('readme.txt').click({ button: 'right' });
    await h.item('Documents').click({ button: 'right' });
  },
});

// -------------------------------------------------------------------- drag and drop

add({
  name: 'drag-over-state',
  async run(page, h) {
    const dispatch = (type) =>
      page.evaluate((eventType) => {
        const zone = document.querySelector('angular-filemanager > div');
        const transfer = new DataTransfer();
        transfer.items.add(new File(['x'], 'dropped.txt', { type: 'text/plain' }));
        zone.dispatchEvent(new DragEvent(eventType, { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }, type);
    await dispatch('dragover');
    await h.snap('dragover');
    await dispatch('dragleave');
    await page.waitForTimeout(150);
    await h.snap('after-dragleave');
  },
});

export { scenarios };
