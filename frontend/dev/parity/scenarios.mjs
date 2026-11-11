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

/**
 * The root element: `<angular-filemanager>` on the legacy page, `<hrzg-filemanager>` on the Vue page.
 * Scenarios never name either tag directly.
 */
export const ROOT = ':is(angular-filemanager, hrzg-filemanager)';

const VIEW = { icons: 'main-icons.html', table: 'main-table.html', preview: 'main-icons-preview.html' };

/**
 * Multi-select modifier for the context menu cases: on macOS a Ctrl-click is
 * a right-click, so there it is Cmd (the code treats both the same).
 */
const MULTI = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Decided deviation: the port fixes legacy's JavaScript error (Q-03) by showing the permissions entry only for exactly one item. */
const Q03 = {
  pattern: /ul\[0\] > li\[12\] <li>: hidden legacy null vs vue true$/,
  reason: 'Q-03 fixed: permissions entry only for exactly one selected item',
};

/** The same fix moves every entry below the permissions entry by one row, so the menu's boxes differ. */
const Q03_LAYOUT = {
  pattern: /div\[3\] > div\[0\].*: rect legacy/,
  reason: 'Q-03 fixed: the missing permissions entry shifts the boxes of the entries below it',
};

/**
 * Decided deviation: `temp` is a computed value in the port (Q-25). Legacy refreshed it only when the
 * selection was replaced, so after a Ctrl/Cmd-click the hidden compress dialog still binds the
 * first item and its name field shows that name; the port shows the empty placeholder.
 */
const Q25 = {
  pattern: /> div\[2\] > div\[5\] > .*input\[1\] <input\.form-control>: value legacy "[^"]*" vs vue ""$/,
  reason: 'Q-25 decided: the compress name field follows every selection change (empty for a Ctrl-built selection)',
};

const ALL_FLAGS = 'allow=rename,changePermissions&editable=1&pick=1&custom=1';

/** Names in the list, found through their tooltip (`name (size)`) which both views carry. */
const itemSelector = (name) => `${ROOT} [title^="${name} ("]`;

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
    await page.click(`${ROOT} .fm-table`);
    await h.snap('table');
    await page.click(`${ROOT} .fm-preview`);
    await h.snap('preview');
    await page.click(`${ROOT} .fm-icons`);
    await h.snap('icons-again');
  },
});
add({
  name: 'view-switch-cycle-without-preview',
  async run(page, h) {
    await h.snap('icons');
    await page.click(`${ROOT} .fm-table`);
    await h.snap('table');
    await page.click(`${ROOT} .fm-icons`);
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
      await page.click(`${ROOT} .breadcrumb li:nth-child(2) a`);
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
    await page.click(`${ROOT} .sidebar a >> text=Images`);
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
  name: 'search-trims-surrounding-spaces',
  async run(page, h) {
    // ng-model trims the model, not the field: the list filters on the trimmed text, the field keeps the spaces.
    await h.search('  er ');
    await h.snap('leading-and-trailing-space');
  },
});
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
    await page.click(`${ROOT} .dropdown-menu input`);
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
      const header = page.locator(`${ROOT} thead th a`).nth(index);
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
    known: [Q25],
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
  known: [Q25],
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

/** Selection cases of the context menu; each gets the menu opened on its last step. */
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
      known: [Q03, Q03_LAYOUT, Q25],
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
    await page.click(`${ROOT} .navbar-form`, { position: { x: 2, y: 2 } });
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
      page.evaluate(({ eventType, root }) => {
        const zone = document.querySelector(`${root} > div`);
        const transfer = new DataTransfer();
        transfer.items.add(new File(['x'], 'dropped.txt', { type: 'text/plain' }));
        zone.dispatchEvent(new DragEvent(eventType, { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }, { eventType: type, root: ROOT });
    await dispatch('dragover');
    await h.snap('dragover');
    await dispatch('dragleave');
    await page.waitForTimeout(150);
    await h.snap('after-dragleave');
  },
});

// -------------------------------------------------------------------- dialogs

/**
 * Selections the dialogs are opened for. Each one ends with the context menu
 * open. Several items are selected with Shift (a replacement of the
 * selection), so the difference of Q-25 (the compress name field follows
 * every selection change) only shows where a scenario asks for it.
 */
/** Enters `folder` unless `file` is already listed, so a selection can be repeated in one scenario. */
async function enterOnce(h, folder, file) {
  if (!(await h.item(file).count())) await h.enter(folder);
}

const SELECT = {
  none: async (h) => h.freeArea().click({ button: 'right', position: await h.freeAreaPosition() }),
  file: (h) => h.item('readme.txt').click({ button: 'right' }),
  image: async (h) => {
    await enterOnce(h, 'Images', 'photo-red.png');
    await h.item('photo-red.png').click({ button: 'right' });
  },
  archive: async (h) => {
    await enterOnce(h, 'Archive', 'backup.zip');
    await h.item('backup.zip').click({ button: 'right' });
  },
  folder: (h) => h.item('Documents').click({ button: 'right' }),
  files: async (h) => {
    await h.item('readme.txt').click();
    await h.item('LICENSE').click({ modifiers: ['Shift'] });
    await h.item('LICENSE').click({ button: 'right' });
  },
  'files-and-folder': async (h) => {
    await h.item('Müller Ärger').click();
    await h.item('readme.txt').click({ modifiers: ['Shift'] });
    await h.item('readme.txt').click({ button: 'right' });
  },
  'custom-urls': async (h) => {
    await enterOnce(h, 'Documents', 'Annual Report 2024.pdf');
    await h.item('Annual Report 2024.pdf').click({ button: 'right' });
  },
};

/** Clicks the visible context menu entry with exactly this label. */
async function menu(h, label) {
  await h.page
    .locator('#context-menu li:visible > a')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .click();
  await h.page.waitForTimeout(250);
}

/** Opens the "more" dropdown of the navbar and clicks an entry. */
async function more(h, label) {
  await h.page.click('#more');
  await h.page
    .locator(`${ROOT} .dropdown-menu.pull-right li:visible a`)
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .click();
  await h.page.waitForTimeout(250);
}

const dialog = (h, id) => h.page.locator(`#${id}`);
const footerButton = (h, id, text) =>
  dialog(h, id)
    .locator('.modal-content > form > .modal-footer button:visible, .modal-content > .modal-footer button:visible')
    .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

/** Each way to close a dialog without submitting it. */
const CLOSE = {
  cross: (h, id) => dialog(h, id).locator('.modal-header button.close').first().click(),
  button: (h, id, d) => footerButton(h, id, d.closeLabel || 'Cancel').click(),
  escape: (h) => h.page.keyboard.press('Escape'),
  // Focus on the body: Bootstrap listens on the dialog element, so the key does nothing there.
  'escape-outside': async (h) => {
    await h.page.evaluate(() => document.activeElement && document.activeElement.blur());
    await h.page.keyboard.press('Escape');
  },
  // The `.modal` element covers the viewport; its left edge is outside `.modal-dialog`.
  backdrop: (h) => h.page.mouse.click(5, 300),
};

const openMove = async (h) => {
  await SELECT.file(h);
  await menu(h, 'Move');
};

/** How a user opens each dialog with its default selection, and its harness flags. */
const DIALOGS = {
  imagepreview: { closeLabel: 'Close', open: async (h) => (await SELECT.image(h), menu(h, 'View item')) },
  remove: { open: async (h) => (await SELECT.file(h), menu(h, 'Delete')) },
  move: { open: openMove },
  rename: { query: 'allow=rename', open: async (h) => (await SELECT.file(h), menu(h, 'Rename')) },
  copy: { open: async (h) => (await SELECT.file(h), menu(h, 'Copy')) },
  compress: { open: async (h) => (await SELECT.files(h), menu(h, 'Compress')) },
  extract: { open: async (h) => (await SELECT.archive(h), menu(h, 'Extract')) },
  edit: { query: 'editable=1', closeLabel: 'Close', open: async (h) => (await SELECT.file(h), menu(h, 'Edit')) },
  newfolder: { open: async (h) => (await SELECT.none(h), menu(h, 'New folder')) },
  uploadfile: { open: async (h) => (await SELECT.none(h), menu(h, 'Upload files')) },
  changepermissions: { query: 'allow=changePermissions', open: async (h) => (await SELECT.file(h), menu(h, 'Permissions')) },
  downloadlink: { open: async (h) => (await SELECT.file(h), menu(h, 'Copy links')) },
  selector: {
    closeLabel: 'Close',
    async open(h) {
      if (!(await dialog(h, 'move').isVisible())) await openMove(h);
      await dialog(h, 'move').locator('a.label-primary', { hasText: 'Change' }).click();
      await h.settle();
    },
  },
};

const typeInto = async (h, selector, text) => {
  const field = h.page.locator(selector);
  await field.click();
  await field.press('ControlOrMeta+a');
  await field.pressSequentially(text, { delay: 10 });
};

// Every dialog closed every way, reopened in between; remove and move refresh the list on cross and Cancel.
for (const [id, d] of Object.entries(DIALOGS)) {
  add({
    name: `dialog-${id}-close-ways`,
    query: d.query,
    async run(page, h) {
      for (const [way, close] of Object.entries(CLOSE)) {
        await d.open(h);
        await h.snap(`${way}-open`);
        await close(h, id, d);
        await h.settle();
        await h.snap(`${way}-after`);
        // A way that left the dialog open (Escape without focus inside) is followed by the cross.
        if (await dialog(h, id).isVisible()) {
          await CLOSE.cross(h, id);
          await h.settle();
        }
      }
    },
  });
}

// Initial state for the selections each dialog is offered for, with the details list where it exists.
const OPEN_CASES = [
  ['remove', 'Delete', ['file', 'image', 'archive', 'folder', 'files', 'files-and-folder']],
  ['move', 'Move', ['file', 'image', 'archive', 'files']],
  ['copy', 'Copy', ['file', 'image', 'archive', 'files']],
  ['compress', 'Compress', ['folder', 'files', 'files-and-folder']],
  ['rename', 'Rename', ['file', 'image', 'archive'], 'allow=rename'],
  ['extract', 'Extract', ['archive']],
  ['edit', 'Edit', ['file'], 'editable=1'],
  ['imagepreview', 'View item', ['image']],
  ['downloadlink', 'Copy links', ['file', 'image', 'archive', 'custom-urls']],
  ['changepermissions', 'Permissions', ['file', 'folder'], 'allow=changePermissions'],
];
for (const [id, label, selections, query] of OPEN_CASES) {
  for (const selection of selections) {
    add({
      name: `dialog-${id}-open-${selection}`,
      query,
      async run(page, h) {
        await SELECT[selection](h);
        await menu(h, label);
        await h.snap('open');
        const details = dialog(h, id).locator('a.label-primary:visible', { hasText: 'Details' });
        if (await details.count()) {
          await details.first().click();
          await h.snap('details-open');
          await details.first().click();
          await h.snap('details-closed');
        }
      },
    });
  }
}

// The other ways in: "more" menu, double click, drop.
add({ name: 'dialog-newfolder-open-more-menu', run: async (page, h) => more(h, 'New folder') });
add({ name: 'dialog-uploadfile-open-more-menu', run: async (page, h) => more(h, 'Upload files') });
add({
  name: 'dialog-edit-open-double-click',
  query: 'editable=1',
  async run(page, h) {
    await h.item('readme.txt').dblclick();
    await h.settle();
  },
});

/** Drops files on the widget the way a browser does: dragenter, dragover, drop with a DataTransfer. */
async function dropFiles(h, files) {
  await h.page.evaluate(
    ({ root, files }) => {
      const zone = document.querySelector(`${root} > div`);
      const transfer = new DataTransfer();
      for (const [name, text] of files) transfer.items.add(new File([text], name, { type: 'text/plain' }));
      for (const type of ['dragenter', 'dragover', 'drop']) {
        zone.dispatchEvent(new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }
    },
    { root: ROOT, files },
  );
  await h.page.waitForTimeout(400);
}

const UPLOAD_FILES = [
  { name: 'new one.txt', mimeType: 'text/plain', buffer: Buffer.from('first new file\n') },
  { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.alloc(3000, 'x') },
];
const pickFiles = (h, files) => h.page.locator('input[type=file]').setInputFiles(files);

// -------------------------------------------------------------------- submit, validation, errors

/** A dialog's submit button. */
const submit = (h, id) => dialog(h, id).locator('button[type=submit]:visible').click();

add({
  name: 'dialog-remove-submit',
  async run(page, h) {
    await SELECT.files(h);
    await menu(h, 'Delete');
    await submit(h, 'remove');
    await h.settle();
    await h.snap('removed');
  },
});
add({
  name: 'dialog-remove-folder-submit',
  async run(page, h) {
    await SELECT.folder(h);
    await menu(h, 'Delete');
    await submit(h, 'remove');
    await h.settle();
  },
});
add({
  name: 'dialog-rename-submit-enter-and-errors',
  query: 'allow=rename',
  async run(page, h) {
    await DIALOGS.rename.open(h);
    await typeInto(h, '#rename input.form-control', '   ');
    await page.keyboard.press('Enter');
    await h.snap('empty-name-error');
    await typeInto(h, '#rename input.form-control', 'LICENSE');
    await page.keyboard.press('Enter');
    await h.snap('existing-name-error');
    await CLOSE.cross(h, 'rename');
    await DIALOGS.rename.open(h);
    await h.snap('reopened-error-gone');
    h.mock('rename', { error: 500, once: true });
    await typeInto(h, '#rename input.form-control', 'renamed.txt');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('backend-error');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('renamed');
  },
});
add({
  name: 'dialog-copy-submit-and-errors',
  async run(page, h) {
    await DIALOGS.copy.open(h);
    await typeInto(h, '#copy input.form-control', 'readme.txt');
    await page.keyboard.press('Enter');
    await h.snap('same-name-same-folder-error');
    await typeInto(h, '#copy input.form-control', ' ');
    await submit(h, 'copy');
    await h.snap('empty-name-error');
    h.mock('copy', { error: 500, once: true });
    await typeInto(h, '#copy input.form-control', 'copy of readme.txt');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('backend-error');
    await page.locator('#copy a.label-primary', { hasText: 'Change' }).click();
    await h.settle();
    await dialog(h, 'selector').locator('a[title^="Documents ("]').click();
    await h.settle();
    await dialog(h, 'selector').locator('.modal-body > div > button.btn-sm').click();
    await h.snap('destination-documents');
    await submit(h, 'copy');
    await h.settle();
    await h.snap('copied');
  },
});
add({
  name: 'dialog-copy-several-files-submit',
  async run(page, h) {
    await SELECT.files(h);
    await menu(h, 'Copy');
    // No name check for several items: the copy onto themselves succeeds and closes the dialog.
    await submit(h, 'copy');
    await h.settle();
    await h.snap('same-folder');
    await SELECT.files(h);
    await menu(h, 'Copy');
    await page.locator('#copy a.label-primary', { hasText: 'Change' }).click();
    await h.settle();
    await dialog(h, 'selector').locator('tr', { hasText: 'Empty folder' }).locator('button').click();
    await h.snap('destination-row');
    await submit(h, 'copy');
    await h.settle();
    await h.snap('copied');
  },
});
add({
  name: 'dialog-move-submit-and-errors',
  async run(page, h) {
    await openMove(h);
    await submit(h, 'move');
    await h.snap('same-destination-error');
    await CLOSE.cross(h, 'move');
    await h.settle();
    await openMove(h);
    await h.snap('reopened');
    h.mock('move', { error: 500, once: true });
    await DIALOGS.selector.open(h);
    await dialog(h, 'selector').locator('tr', { hasText: 'Archive' }).locator('button').click();
    await submit(h, 'move');
    await h.settle();
    await h.snap('backend-error');
    await submit(h, 'move');
    await h.settle();
    await h.snap('moved');
  },
});
add({
  name: 'dialog-compress-submit-and-errors',
  async run(page, h) {
    await DIALOGS.compress.open(h);
    await page.keyboard.press('Enter');
    await h.snap('empty-name-error');
    await typeInto(h, '#compress input.form-control', 'readme.txt');
    await page.keyboard.press('Enter');
    await h.snap('existing-name-error');
    h.mock('compress', { error: 500, once: true });
    await typeInto(h, '#compress input.form-control', 'bundle ');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('backend-error');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('compressed');
  },
});
add({
  name: 'dialog-compress-folder-submit',
  async run(page, h) {
    await SELECT.folder(h);
    await menu(h, 'Compress');
    await typeInto(h, '#compress input.form-control', 'docs');
    await page.keyboard.press('Enter');
    await h.settle();
  },
});
add({
  name: 'dialog-compress-ctrl-selection',
  known: [Q25],
  async run(page, h) {
    await h.item('readme.txt').click();
    await h.item('LICENSE').click({ modifiers: [MULTI] });
    await h.item('LICENSE').click({ button: 'right' });
    await menu(h, 'Compress');
    await h.snap('open');
  },
});
add({
  name: 'dialog-compress-question-variant',
  query: 'deny=compressChooseName',
  async run(page, h) {
    await SELECT.folder(h);
    await menu(h, 'Compress');
    await h.snap('open-folder');
    await submit(h, 'compress');
    await h.snap('submitted-folder');
    await CLOSE.cross(h, 'compress');
    await SELECT.files(h);
    await menu(h, 'Compress');
    await h.snap('open-files');
    await submit(h, 'compress');
    await h.snap('submitted-files');
  },
});
add({
  name: 'dialog-compress-async',
  query: 'async=1',
  async run(page, h) {
    await DIALOGS.compress.open(h);
    await typeInto(h, '#compress input.form-control', 'later');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('started');
    await footerButton(h, 'compress', 'Close').click();
    await h.snap('closed');
    await DIALOGS.compress.open(h);
    await h.snap('reopened');
  },
});
add({
  name: 'dialog-extract-submit-and-errors',
  async run(page, h) {
    await DIALOGS.extract.open(h);
    await typeInto(h, '#extract input.form-control', ' ');
    await page.keyboard.press('Enter');
    await h.snap('empty-name-error');
    await typeInto(h, '#extract input.form-control', 'backup.zip');
    await page.keyboard.press('Enter');
    await h.snap('existing-name-error');
    h.mock('extract', { error: 500, once: true });
    await typeInto(h, '#extract input.form-control', 'unpacked');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('backend-error');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('extracted');
  },
});
add({
  name: 'dialog-extract-async',
  query: 'async=1',
  async run(page, h) {
    await DIALOGS.extract.open(h);
    await typeInto(h, '#extract input.form-control', 'later');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('started');
    // The focused field was hidden with its block, so Escape would reach no dialog; Close does.
    await CLOSE.escape(h);
    await h.snap('escape-ignored');
    await footerButton(h, 'extract', 'Close').click();
    await DIALOGS.extract.open(h);
    await h.snap('reopened');
  },
});
add({
  name: 'dialog-newfolder-submit-errors-and-slug',
  async run(page, h) {
    await DIALOGS.newfolder.open(h);
    await page.keyboard.press('Enter');
    await h.snap('empty-name-error');
    await typeInto(h, '#newfolder input.form-control', 'Documents');
    await page.keyboard.press('Enter');
    await h.snap('existing-name-error');
    h.mock('createFolder', { error: 500, once: true });
    await typeInto(h, '#newfolder input.form-control', 'My New Folder!');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('backend-error');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('created-slug');
    // Q-28: the check sees "MY new folder", the request the slug of an existing folder.
    await more(h, 'New folder');
    await typeInto(h, '#newfolder input.form-control', 'MY new folder');
    await page.keyboard.press('Enter');
    await h.settle();
    await h.snap('slug-exists-backend-error');
  },
});
add({
  name: 'dialog-newfolder-phantom-selection',
  async run(page, h) {
    await DIALOGS.newfolder.open(h);
    await CLOSE.button(h, 'newfolder', {});
    await h.snap('cancelled');
    await SELECT.none(h);
    await h.snap('context-menu-after-cancel');
    await h.item('readme.txt').click();
    await SELECT.none(h);
    await h.snap('context-menu-after-other-click');
  },
});

// Q-27 and Q-42: typed input survives cancel and reopen, and is lost by clicking the item again.
for (const [id, label, select, query] of [
  ['rename', 'Rename', 'file', 'allow=rename'],
  ['copy', 'Copy', 'file', ''],
  ['extract', 'Extract', 'archive', ''],
]) {
  add({
    name: `dialog-${id}-input-survives-cancel`,
    query,
    async run(page, h) {
      await SELECT[select](h);
      await menu(h, label);
      await typeInto(h, `#${id} input.form-control`, 'typed name ');
      await CLOSE.button(h, id, {});
      await h.item(select === 'archive' ? 'backup.zip' : 'readme.txt').click({ button: 'right' });
      await menu(h, label);
      await h.snap('reopened-with-input');
      await CLOSE.cross(h, id);
      await h.item(select === 'archive' ? 'backup.zip' : 'readme.txt').click();
      await h.item(select === 'archive' ? 'backup.zip' : 'readme.txt').click({ button: 'right' });
      await menu(h, label);
      await h.snap('reopened-after-click');
    },
  });
}

// Typing as in task 1: inner and trailing spaces, a backspace that leaves a trailing space, blur, Enter.
for (const [id, query, open, field] of [
  ['rename', 'allow=rename', DIALOGS.rename.open, '#rename input.form-control'],
  ['copy', '', DIALOGS.copy.open, '#copy input.form-control'],
  ['newfolder', '', DIALOGS.newfolder.open, '#newfolder input.form-control'],
  ['compress', '', DIALOGS.compress.open, '#compress input.form-control'],
  ['extract', '', DIALOGS.extract.open, '#extract input.form-control'],
  ['edit', 'editable=1', DIALOGS.edit.open, '#edit textarea'],
]) {
  add({
    name: `dialog-${id}-typing`,
    query,
    async run(page, h) {
      await open(h);
      await h.settle();
      await typeInto(h, field, 'foo bar');
      for (let i = 0; i < 3; i++) await page.locator(field).press('Backspace');
      await h.snap('backspace-to-trailing-space');
      await page.locator(field).pressSequentially('x y ', { delay: 10 });
      await h.snap('inner-and-trailing-space');
      await dialog(h, id).locator('.modal-title').click();
      await h.snap('after-blur');
      await page.locator(field).press('ControlOrMeta+a');
      await page.keyboard.insertText(' inserted text ');
      await h.snap('inserted-text');
      if (id === 'edit') await submit(h, id);
      else await page.locator(field).press('Enter');
      await h.settle();
      await h.snap('submitted');
    },
  });
}

// -------------------------------------------------------------------- destination dialog (stacked)

// The table view in a low viewport makes the page scroll, so Bootstrap pads the body for the scrollbar.
const STACK_VIEWPORT = '1280x400';
const STACK_STORAGE = { viewTemplate: VIEW.table };
add({
  name: 'dialog-selector-navigate-sort-select-row',
  viewport: STACK_VIEWPORT,
  storage: STACK_STORAGE,
  async run(page, h) {
    await DIALOGS.selector.open(h);
    await h.snap('stacked');
    await dialog(h, 'selector').locator('thead th a').click();
    await h.snap('sorted-reverse');
    await dialog(h, 'selector').locator('thead th a').click();
    await h.snap('sorted-again');
    await dialog(h, 'selector').locator('a[title^="Empty folder ("]').click();
    await h.settle();
    await h.snap('empty-folder');
    await dialog(h, 'selector').locator('button', { hasText: 'Go back' }).click();
    await h.settle();
    await h.snap('went-back');
    await dialog(h, 'selector').locator('a[title^="Documents ("]').click();
    await h.settle();
    await h.snap('in-documents');
    await dialog(h, 'selector').locator('.breadcrumb a').first().click();
    await h.settle();
    await h.snap('breadcrumb-root');
    await dialog(h, 'selector').locator('a[title^="Documents ("]').click();
    await h.settle();
    await dialog(h, 'selector').locator('tr', { hasText: 'Reports' }).locator('button').click();
    await h.snap('row-selected');
    await submit(h, 'move');
    await h.settle();
    await h.snap('moved');
  },
});
add({
  name: 'dialog-selector-select-current',
  viewport: STACK_VIEWPORT,
  storage: STACK_STORAGE,
  async run(page, h) {
    await DIALOGS.selector.open(h);
    await dialog(h, 'selector').locator('a[title^="Images ("]').click();
    await h.settle();
    await dialog(h, 'selector').locator('.modal-body > div > button.btn-sm').click();
    await h.snap('current-selected');
    await DIALOGS.selector.open(h);
    await h.snap('reopened-at-main-path');
    await CLOSE.cross(h, 'selector');
    await submit(h, 'move');
    await h.settle();
    await h.snap('moved');
  },
});
for (const [way, close] of Object.entries(CLOSE)) {
  add({
    name: `dialog-selector-stacked-${way}`,
    viewport: STACK_VIEWPORT,
    storage: STACK_STORAGE,
  storage: STACK_STORAGE,
    async run(page, h) {
      await DIALOGS.selector.open(h);
      await page.waitForTimeout(200);
      await close(h, 'selector', DIALOGS.selector);
      await h.settle();
      await h.snap('selector-closed');
      await close(h, 'move', DIALOGS.move);
      await h.settle();
      await h.snap('move-closed');
    },
  });
}

// -------------------------------------------------------------------- upload

add({
  name: 'dialog-uploadfile-list-remove-cancel-reopen-upload',
  async run(page, h) {
    await more(h, 'Upload files');
    await pickFiles(h, UPLOAD_FILES);
    await h.snap('two-picked');
    await pickFiles(h, [{ name: 'third.txt', mimeType: 'text/plain', buffer: Buffer.from('3') }]);
    await h.snap('three-picked');
    await dialog(h, 'uploadfile').locator('.list-group-item button').first().click();
    await h.snap('first-removed');
    await CLOSE.button(h, 'uploadfile', {});
    await SELECT.none(h);
    await menu(h, 'Upload files');
    await h.snap('reopened-keeps-list');
    await submit(h, 'uploadfile');
    await h.settle();
    await h.snap('uploaded');
    await more(h, 'Upload files');
    await h.snap('reopened-empty');
  },
});
add({
  name: 'dialog-uploadfile-drop',
  async run(page, h) {
    await dropFiles(h, [['dropped one.txt', 'one'], ['dropped two.txt', 'two two']]);
    await h.snap('dropped');
    await dropFiles(h, [['dropped three.txt', '3']]);
    await h.snap('dropped-again');
    await submit(h, 'uploadfile');
    await h.settle();
    await h.snap('uploaded');
  },
});
add({
  name: 'dialog-uploadfile-in-subfolder',
  async run(page, h) {
    await h.enter('Documents');
    await more(h, 'Upload files');
    await pickFiles(h, UPLOAD_FILES.slice(0, 1));
    await submit(h, 'uploadfile');
    await h.settle();
  },
});
add({
  name: 'dialog-uploadfile-rejected',
  async run(page, h) {
    await more(h, 'Upload files');
    await pickFiles(h, [UPLOAD_FILES[0], { name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('dup') }]);
    await submit(h, 'uploadfile');
    await h.settle();
    await h.snap('rejected');
    await CLOSE.cross(h, 'uploadfile');
    await more(h, 'Upload files');
    await h.snap('reopened');
  },
});
add({
  name: 'dialog-uploadfile-backend-error',
  async run(page, h) {
    h.mock('upload', { error: 500 });
    await more(h, 'Upload files');
    await pickFiles(h, UPLOAD_FILES.slice(0, 1));
    await submit(h, 'uploadfile');
    await h.settle();
  },
});
add({
  name: 'dialog-uploadfile-progress',
  async run(page, h) {
    h.mock('upload', { delay: 1500 });
    await more(h, 'Upload files');
    await pickFiles(h, UPLOAD_FILES);
    await submit(h, 'uploadfile');
    await page.waitForTimeout(500);
    await h.snap('in-progress');
    await h.settle();
    await page.waitForTimeout(1200);
    await h.snap('done');
  },
});

// -------------------------------------------------------------------- image preview

add({
  name: 'dialog-imagepreview-loading-reopen-other',
  async run(page, h) {
    await h.enter('Images');
    h.mock('stream', { delay: 1500, once: true });
    await h.item('photo-red.png').dblclick();
    await page.waitForTimeout(400);
    await h.snap('loading');
    await page.waitForTimeout(1500);
    await h.snap('loaded');
    await CLOSE.button(h, 'imagepreview', DIALOGS.imagepreview);
    await h.item('photo-red.png').dblclick();
    await page.waitForTimeout(400);
    await h.snap('same-image-again');
    await CLOSE.cross(h, 'imagepreview');
    await h.item('photo-blue.png').dblclick();
    await page.waitForTimeout(400);
    await h.snap('other-image');
    // The double-clicked item keeps the focus (the dialog has no field), so Escape would not reach it.
    await page.keyboard.press('Escape');
    await h.snap('escape-ignored');
    await CLOSE.cross(h, 'imagepreview');
    await h.item('vector.svg').click({ button: 'right' });
    await menu(h, 'View item');
    await page.waitForTimeout(400);
    await h.snap('svg-via-menu');
  },
});

// -------------------------------------------------------------------- permissions

const PERMS = 'allow=changePermissions';
const multiSelectButton = (h, n) => dialog(h, 'changepermissions').locator('.multiSelect > button').nth(n);
const roleRow = (h, n, role) =>
  dialog(h, 'changepermissions').locator('.multiSelect').nth(n).locator('.multiSelectItem', { hasText: role });
add({
  name: 'dialog-changepermissions-change-submit-reopen',
  query: PERMS,
  async run(page, h) {
    await DIALOGS.changepermissions.open(h);
    await h.snap('open');
    await multiSelectButton(h, 1).click();
    await h.snap('write-list-open');
    await roleRow(h, 1, 'Authenticated').click();
    await roleRow(h, 1, 'Editor').click();
    await h.snap('write-changed');
    await multiSelectButton(h, 1).click();
    await multiSelectButton(h, 2).click();
    await roleRow(h, 2, 'Editor').click();
    await multiSelectButton(h, 2).click();
    await h.snap('delete-changed');
    await submit(h, 'changepermissions');
    await h.settle();
    await h.snap('submitted');
    await DIALOGS.changepermissions.open(h);
    await h.snap('reopened');
  },
});
add({
  name: 'dialog-changepermissions-load-fails-first',
  query: PERMS,
  async run(page, h) {
    h.mock('resolvePermissions', { error: 500, once: true });
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    await h.snap('open-after-failure');
    await multiSelectButton(h, 0).click();
    await h.snap('button-clicked');
  },
});
add({
  name: 'dialog-changepermissions-load-fails-second',
  query: PERMS,
  async run(page, h) {
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    await CLOSE.cross(h, 'changepermissions');
    h.mock('resolvePermissions', { error: 500, once: true });
    await h.item('LICENSE').click({ button: 'right' });
    await menu(h, 'Permissions');
    await h.settle();
    await h.snap('second-file-after-failure');
    await submit(h, 'changepermissions');
    await h.settle();
    await h.snap('submitted');
  },
});
add({
  name: 'dialog-changepermissions-submit-error',
  query: PERMS,
  async run(page, h) {
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    h.mock('changePermissions', { error: 500, once: true });
    await submit(h, 'changepermissions');
    await h.settle();
    await h.snap('error');
    await CLOSE.cross(h, 'changepermissions');
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    await h.snap('reopened');
  },
});
add({
  name: 'dialog-changepermissions-escape-with-list-open',
  query: PERMS,
  async run(page, h) {
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    await multiSelectButton(h, 0).click();
    await page.keyboard.press('Escape');
    await h.settle();
    await h.snap('after-escape');
    await DIALOGS.changepermissions.open(h);
    await h.settle();
    await h.snap('reopened');
  },
});

// -------------------------------------------------------------------- link dialog

/** Q-04 fixed: legacy's custom URL buttons copy `#afm-download-link`, which is missing there. */
const Q04 = {
  pattern: /^recorded clipboard after button \d: legacy/,
  reason: 'Q-04 fixed: each custom URL copy button copies its own field',
};
/** The same fix selects (and so focuses) the copied field; legacy found no target and left the focus on the button. */
const Q04_FOCUS = {
  pattern: /> div\[11\] > .*: attrs legacy .*vue .*"data-parity-focus"|> div\[11\] > .*: attrs legacy \{[^}]*"data-parity-focus"[^}]*\} vs vue/,
  reason: 'Q-04 fixed: the custom URL copy button focuses and selects its own field',
};
for (const selection of ['file', 'custom-urls']) {
  add({
    name: `dialog-downloadlink-copy-buttons-${selection}`,
    clipboard: true,
    known: selection === 'custom-urls' ? [Q04, Q04_FOCUS] : [],
    async run(page, h) {
      await page.evaluate(() => navigator.clipboard.writeText('(empty)'));
      await SELECT[selection](h);
      await menu(h, 'Copy links');
      await h.snap('open');
      const buttons = dialog(h, 'downloadlink').locator('.input-group-btn button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        await buttons.nth(i).click();
        await page.waitForTimeout(200);
        h.record(`clipboard after button ${i}`, await h.clipboard());
        await h.snap(`button-${i}`);
      }
    },
  });
}

// -------------------------------------------------------------------- edit

add({
  name: 'dialog-edit-load-fullscreen-save-reopen',
  query: 'editable=1',
  async run(page, h) {
    h.mock('getContent', { delay: 1200, once: true });
    await h.item('readme.txt').dblclick();
    await page.waitForTimeout(400);
    await h.snap('loading');
    await h.settle();
    await page.waitForTimeout(1000);
    await h.snap('loaded');
    await dialog(h, 'edit').locator('button.fullscreen').click();
    await h.snap('fullscreen');
    await dialog(h, 'edit').locator('button.fullscreen').click();
    await h.snap('fullscreen-off');
    await page.locator('#edit textarea').press('ControlOrMeta+End');
    await page.locator('#edit textarea').pressSequentially('Third line.\n', { delay: 10 });
    await h.snap('typed');
    await submit(h, 'edit');
    await h.settle();
    await h.snap('saved');
    await h.item('readme.txt').dblclick();
    await h.settle();
    await h.snap('reopened');
    h.mock('edit', { error: 500, once: true });
    await submit(h, 'edit');
    await h.settle();
    await h.snap('save-error');
  },
});
add({
  name: 'dialog-edit-svg-via-menu',
  query: 'editable=1',
  async run(page, h) {
    await h.enter('Images');
    await h.item('vector.svg').click({ button: 'right' });
    await menu(h, 'Edit');
    await h.settle();
  },
});

export { scenarios };
