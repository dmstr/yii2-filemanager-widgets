/**
 * DOM snapshot and comparison for the parity tool.
 *
 * `takeSnapshot` runs inside the page: it turns the subtree of
 * the root element into a plain tree after removing what only AngularJS
 * puts there (comments, ng-* attributes and classes, template scripts), so the
 * legacy and the Vue DOM can be compared as data. `diffSnapshots` runs in Node.
 */

/**
 * Default of the switch for the dialog subtree: when true, the wrapper of the
 * legacy `modals.html` (third child of the root div) is replaced by a stub on
 * both sides. The dialogs are compared by default; `--exclude-dialogs` stubs
 * them for a run that only looks at the main screen.
 */
export const EXCLUDE_DIALOGS = false;

/** Page side. Must stay self-contained: it is serialised into the browser. */
export function takeSnapshot(options) {
  // The legacy page has <angular-filemanager>, the Vue page <hrzg-filemanager>; the two count as equal.
  const ROOT_TAG = 'filemanager-root';
  const root = document.querySelector('angular-filemanager, hrzg-filemanager');
  if (!root) {
    return { tag: ROOT_TAG, missing: true };
  }
  // The ids of the link dialog were renamed from `afm-*-link` to `filemanager-*-link`; the legacy side is mapped.
  const normaliseValue = (name, value) => (name === 'id' ? value.replace(/^afm-(.+-link)$/, 'filemanager-$1') : value);

  // `data-v-app` is the marker Vue puts on the element it mounts into.
  const IGNORED_ATTRIBUTES = /^(ng-|data-ng-|ngf-|data-ngf-|data-toggle$|data-dismiss$|data-v-app$|class$|style$)/;
  const IGNORED_CLASSES = /^ng-/;
  // Configuration attributes of AngularJS directives, ignored only on the element that carries the
  // directive: `ng-include data-src`, the isteven multi-select's options and ngclipboard's target.
  const DIRECTIVE_ATTRIBUTES = [
    ['ng-include', /^data-src$/],
    ['isteven-multi-select', /^(isteven-multi-select|input-model|output-model|button-label|item-label|tick-property|output-properties)$/],
    ['ngclipboard', /^(ngclipboard|data-clipboard-target)$/],
  ];
  const isDirectiveAttribute = (el, name) => DIRECTIVE_ATTRIBUTES.some(([marker, names]) => el.hasAttribute(marker) && names.test(name));
  // Boolean attributes: AngularJS writes `disabled="disabled"`, Vue `disabled=""`; only the presence counts.
  const BOOLEAN_ATTRIBUTES = /^(autofocus|checked|disabled|multiple|readonly|required|selected)$/;
  // Index of the dialogs wrapper among the children of the root div.
  const DIALOGS_INDEX = 2;

  const collapse = (text) => text.replace(/\s+/g, ' ').trim();

  function styleOf(el) {
    const out = {};
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style[i];
      // `display` is compared as the computed `hidden` flag, which also covers ng-hide and v-show alike.
      if (name !== 'display') {
        out[name] = el.style.getPropertyValue(name);
      }
    }
    return out;
  }

  function describe(el) {
    const node = { tag: el.localName };
    const attrs = {};
    for (const attr of Array.from(el.attributes).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!IGNORED_ATTRIBUTES.test(attr.name) && !isDirectiveAttribute(el, attr.name)) {
        attrs[attr.name] = BOOLEAN_ATTRIBUTES.test(attr.name) ? '' : normaliseValue(attr.name, attr.value);
      }
    }
    const classes = Array.from(el.classList).filter((name) => !IGNORED_CLASSES.test(name)).sort();
    if (classes.length) {
      node.classes = classes;
    }
    if (Object.keys(attrs).length) {
      node.attrs = attrs;
    }
    const style = styleOf(el);
    if (Object.keys(style).length) {
      node.style = style;
    }
    if (window.getComputedStyle(el).display === 'none') {
      node.hidden = true;
    } else {
      // Layout, in document coordinates: catches what the structure cannot, such as the
      // whitespace between inline elements that AngularJS keeps and Vue may condense.
      const box = el.getBoundingClientRect();
      node.rect = [box.left + window.scrollX, box.top + window.scrollY, box.width, box.height].map((n) => Math.round(n * 10) / 10);
    }
    if (el.localName === 'input' || el.localName === 'textarea') {
      node.value = el.value;
    }
    return node;
  }

  function walk(el, isControllerRoot) {
    const node = describe(el);
    const children = [];
    let text = '';
    const flush = () => {
      const collapsed = collapse(text);
      if (collapsed) {
        children.push(collapsed);
      }
      text = '';
    };
    let childIndex = 0;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.localName === 'script' && child.getAttribute('type') === 'text/ng-template') {
          continue;
        }
        flush();
        if (isControllerRoot && options.excludeDialogs && childIndex === DIALOGS_INDEX) {
          children.push({ tag: '(dialogs excluded)' });
        } else {
          children.push(walk(child, false));
        }
        childIndex++;
      }
    }
    flush();
    if (children.length) {
      node.children = children;
    }
    return node;
  }

  // The root element holds the controller root div (legacy `ng-controller`, Vue root).
  const node = describe(root);
  node.tag = ROOT_TAG;
  node.children = Array.from(root.children).map((child) => walk(child, true));
  return node;
}

// ----------------------------------------------------------------------- Node side

const label = (node) =>
  typeof node === 'string'
    ? JSON.stringify(node)
    : `<${node.tag}${node.attrs?.id ? '#' + node.attrs.id : ''}${node.classes ? '.' + node.classes.join('.') : ''}>`;

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Compares two snapshots. Returns one line per difference, with the path of
 * element positions from the root. `legacy` is left, `vue` right.
 */
export function diffSnapshots(legacy, vue, limit = 60) {
  const lines = [];
  let omitted = 0;
  const report = (path, text) => (lines.length < limit ? lines.push(`${path}: ${text}`) : omitted++);

  function compare(a, b, path, index) {
    if (typeof a === 'string' || typeof b === 'string') {
      if (a !== b) {
        report(`${path} > text[${index}]`, `text legacy ${label(a)} vs vue ${label(b)}`);
      }
      return;
    }
    const here = `${path}${path ? ' > ' : ''}${a.tag}${index === undefined ? '' : `[${index}]`}`;
    const where = `${here} ${label(a)}`;
    if (a.tag !== b.tag) {
      report(here, `tag legacy <${a.tag}> vs vue <${b.tag}>`);
      return;
    }
    // Layout may differ by a pixel (sub-pixel text widths); anything more is a difference.
    if (a.rect && b.rect && a.rect.some((n, i) => Math.abs(n - b.rect[i]) > 1)) {
      report(where, `rect legacy [${a.rect.join(', ')}] vs vue [${b.rect.join(', ')}]`);
    }
    for (const field of ['classes', 'attrs', 'style', 'hidden', 'value']) {
      if (!sameJson(a[field], b[field])) {
        report(where, `${field} legacy ${JSON.stringify(a[field] ?? null)} vs vue ${JSON.stringify(b[field] ?? null)}`);
      }
    }
    const left = a.children ?? [];
    const right = b.children ?? [];
    if (left.length !== right.length) {
      report(where, `child count legacy ${left.length} vs vue ${right.length}`);
      const extra = left.length > right.length ? left.slice(right.length) : right.slice(left.length);
      const side = left.length > right.length ? 'legacy only' : 'vue only';
      for (const child of extra.slice(0, 3)) {
        report(where, `${side}: ${label(child)}`);
      }
    }
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      compare(left[i], right[i], here, i);
    }
  }

  compare(legacy, vue, '', undefined);
  if (omitted) {
    lines.push(`... ${omitted} more differences omitted`);
  }
  return lines;
}
