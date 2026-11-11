#!/usr/bin/env node
/**
 * Parity tool: drives the legacy AngularJS page and the Vue page through the
 * same scenarios in headless Chromium and compares them at every step: the
 * DOM inside the root element (structure, attributes, visibility, layout
 * boxes, field values, the focused element), the page around it (body class
 * and inline style, modal backdrops, focus outside the root), the API
 * requests both pages sent, the mock's data afterwards, values a scenario
 * records (clipboard text, for example) and the screenshots pixel by pixel.
 *
 *   node dev/parity/parity.mjs [--base http://localhost:5173] [--only a,b]
 *        [--list] [--exclude-dialogs] [--headed] [--viewport 1280x800]
 *        [--max-diffs 60] [--out dir] [--dump]
 *
 * `--dump` prints the page state, requests and recorded values of every legacy
 * step, to check what a scenario actually exercised.
 *
 * Needs a running dev server (`yarn dev`); see frontend/README.md. Exits 1 if
 * any scenario differs or fails, 2 if the dev server cannot be reached.
 */
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ROOT, scenarios } from './scenarios.mjs';
import { diffSnapshots, EXCLUDE_DIALOGS, takeSnapshot } from './snapshot.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {
    base: 'http://localhost:5173',
    only: null,
    list: false,
    excludeDialogs: EXCLUDE_DIALOGS,
    headed: false,
    viewport: '1280x800',
    maxDiffs: 60,
    out: join(here, 'out'),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') args.base = argv[++i];
    else if (arg === '--only') args.only = argv[++i].split(',');
    else if (arg === '--list') args.list = true;
    else if (arg === '--exclude-dialogs') args.excludeDialogs = true;
    else if (arg === '--include-dialogs') args.excludeDialogs = false;
    else if (arg === '--headed') args.headed = true;
    else if (arg === '--viewport') args.viewport = argv[++i];
    else if (arg === '--max-diffs') args.maxDiffs = Number(argv[++i]);
    else if (arg === '--out') args.out = resolve(argv[++i]);
    else if (arg === '--dump') args.dump = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

const slug = (text) => text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

/** Attribute that marks the focused element inside the root for the DOM snapshot. */
const FOCUS_MARK = 'data-parity-focus';

/**
 * Page side: state outside the root element. Marks the focused element when
 * it is inside the root (the DOM snapshot then carries the mark at its
 * position), otherwise describes it.
 */
function pageState({ mark, root }) {
  const body = document.body;
  const rect = (el) => {
    const box = el.getBoundingClientRect();
    return [box.left, box.top, box.width, box.height].map((n) => Math.round(n));
  };
  const describe = (el) => {
    const classes = Array.from(el.classList).filter((name) => !/^ng-/.test(name)).sort();
    return `${el.localName}${el.id ? '#' + el.id : ''}${classes.length ? '.' + classes.join('.') : ''}`;
  };
  const active = document.activeElement;
  const rootEl = document.querySelector(root);
  let focus;
  if (!active || active === body) {
    focus = 'body';
  } else if (rootEl && rootEl.contains(active)) {
    active.setAttribute(mark, '');
    focus = '(inside the root, marked in the DOM)';
  } else {
    focus = describe(active);
  }
  return {
    bodyClasses: Array.from(body.classList).sort().join(' '),
    bodyStyle: body.getAttribute('style') || '',
    backdrops: Array.from(document.querySelectorAll('.modal-backdrop')).map(
      (el) => `${describe(el)} in ${el.parentElement === body ? 'body' : describe(el.parentElement)} at [${rect(el).join(', ')}]`,
    ),
    scroll: [Math.round(window.scrollX), Math.round(window.scrollY)],
    focus,
  };
}

/** Request of one side, reduced to what the backend sees. */
function describeRequest(request) {
  const url = new URL(request.url());
  const query = [...url.searchParams.entries()].map(([k, v]) => `${k}=${v}`).join('&');
  const type = request.headers()['content-type'] || '';
  let body = '';
  const raw = request.postDataBuffer();
  if (raw && type.startsWith('multipart/form-data')) {
    // Boundary and part order aside, a multipart body is its field names, file names and contents.
    const text = raw.toString('latin1');
    const parts = [...text.matchAll(/Content-Disposition: form-data; name="([^"]*)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: ([^\r]*)\r\n)?\r\n([\s\S]*?)\r\n--/g)];
    body = parts.map(([, name, file, ctype, value]) => (file !== undefined ? `${name}=file(${file}, ${ctype}, ${value.length} bytes)` : `${name}=${value}`)).join(' & ');
  } else if (raw) {
    try {
      body = JSON.stringify(sortKeys(JSON.parse(raw.toString('utf8'))));
    } catch {
      body = raw.toString('utf8');
    }
  }
  const xrw = request.headers()['x-requested-with'] ? ' xrw' : '';
  return `${request.method()} ${url.pathname}${query ? '?' + query : ''}${body ? ' ' + body : ''}${xrw}`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

/** Opens the page for one side, runs the scenario and returns its steps. */
async function runSide(browser, args, scenario, side) {
  const [width, height] = (scenario.viewport || args.viewport).split('x').map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  if (scenario.clipboard) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: args.base });
  }
  const page = await context.newPage();
  // A selector that matches nothing fails the scenario in seconds instead of Playwright's 30.
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  // A failed request is logged by the browser itself; scenarios with forced API errors expect it.
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(`console.error: ${message.text()}`);
  });
  let requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/mock/api')) requests.push(describeRequest(request));
  });

  await fetch(`${args.base}/mock/reset`, { method: 'POST' });
  if (scenario.storage) {
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
    }, scenario.storage);
  }
  // Mock switches: each rule adds `X-Mock-Error` / `X-Mock-Delay` to the API requests it matches.
  const rules = [];
  if (scenario.forceError) rules.push({ match: () => true, error: scenario.forceError });
  await page.route('**/mock/api**', (route) => {
    const request = route.request();
    const headers = { ...request.headers() };
    for (const rule of rules) {
      if (rule.used || !rule.match(request)) continue;
      if (rule.error) headers['x-mock-error'] = String(rule.error);
      if (rule.delay) headers['x-mock-delay'] = String(rule.delay);
      if (rule.once) rule.used = true;
    }
    return route.continue({ headers });
  });

  const settle = async () => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
  };
  const steps = [];
  const prefix = `${slug(scenario.name)}.${side}`;
  let recorded = {};
  const actionOf = (request) => {
    try {
      const body = request.postData();
      if (!body) return new URL(request.url()).searchParams.get('action');
      if ((request.headers()['content-type'] || '').startsWith('multipart/')) return 'upload';
      return JSON.parse(body).action;
    } catch {
      return null;
    }
  };
  const helpers = {
    page,
    side,
    root: ROOT,
    settle,
    item: (name) => page.locator(`${ROOT} [title^="${name} ("]`).first(),
    row: (name) => page.locator(`${ROOT} tr.item-list`, { has: page.locator(`[title^="${name} ("]`) }),
    freeArea: () => page.locator(`${ROOT} .main-navigation .item-list.clearfix`),
    async freeAreaPosition() {
      const box = await helpers.freeArea().boundingBox();
      return { x: box.width - 12, y: box.height - 8 };
    },
    async enter(name) {
      await helpers.item(name).dblclick();
      await settle();
    },
    async search(text) {
      const input = page.locator(`${ROOT} .dropdown-menu input`);
      if (!(await input.isVisible())) await page.click('#dropDownMenuLang');
      await input.fill(text);
      await page.waitForTimeout(100);
    },
    /**
     * Switches the mock for the API requests whose action is in `actions`
     * (`upload` for the multipart request, `stream`/`download` for GETs):
     * `{ error: status }` and/or `{ delay: ms }`; `once` limits it to the next one.
     */
    mock(actions, options) {
      const list = [].concat(actions);
      rules.push({ ...options, match: (request) => list.includes(actionOf(request)) });
    },
    /** Stores a value under `key` for the next step; both sides must record the same. */
    record(key, value) {
      recorded[key] = value;
    },
    async clipboard() {
      return page.evaluate(() => navigator.clipboard.readText().catch((e) => `(unreadable: ${e.message})`));
    },
    async snap(label) {
      await page.waitForTimeout(Number(process.env.PARITY_WAIT || 150));
      await page.mouse.move(0, 0, { steps: 1 }).catch(() => {});
      const name = `${prefix}${label ? '.' + slug(label) : ''}.png`;
      await page.screenshot({ path: join(args.out, name), animations: 'disabled', caret: 'hide' });
      const state = await page.evaluate(pageState, { mark: FOCUS_MARK, root: ROOT });
      const tree = await page.evaluate(takeSnapshot, { excludeDialogs: args.excludeDialogs });
      await page.evaluate((mark) => document.querySelectorAll(`[${mark}]`).forEach((el) => el.removeAttribute(mark)), FOCUS_MARK);
      const mockState = await (await fetch(`${args.base}/mock/state`)).json();
      steps.push({ label: label || 'final', tree, state, requests, mockState, recorded, screenshot: name });
      requests = [];
      recorded = {};
    },
  };

  const pageName = side === 'legacy' ? 'legacy.html' : 'index.html';
  await page.goto(`${args.base}/dev/${pageName}${scenario.query ? '?' + scenario.query : ''}`);
  // The harness header differs between the pages (hidden, but it keeps its space). Animations would
  // make measurements depend on timing, and an element that ran one may keep its own compositor layer,
  // which rasterises its text differently; every animation used here ends in the static state.
  await page.addStyleTag({
    content:
      'p.small.text-muted { visibility: hidden } *, *::before, *::after { animation: none !important; transition: none !important }',
  });
  await page.waitForSelector(`${ROOT} nav`);
  await settle();
  await page.mouse.move(0, 0);
  // Requests of the initial load are the same on both pages and checked by every scenario once.
  if (scenario.run) {
    try {
      await scenario.run(page, helpers);
    } catch (error) {
      const last = steps.length ? steps[steps.length - 1].label : 'start';
      await page.screenshot({ path: join(args.out, `${prefix}.failed.png`) }).catch(() => {});
      error.message = `${side} page after step "${last}": ${error.message}`;
      throw error;
    }
  }
  if (!steps.length) await helpers.snap('');
  await context.close();
  return { steps, errors };
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Differences between two lists of lines, as `-` (legacy only) and `+` (vue only) entries. */
function diffLists(name, left, right) {
  if (sameJson(left, right)) return [];
  const out = [];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    if (left[i] !== right[i]) {
      if (left[i] !== undefined) out.push(`${name}[${i}] legacy ${left[i]}`);
      if (right[i] !== undefined) out.push(`${name}[${i}] vue    ${right[i]}`);
    }
  }
  return out;
}

/** Everything but the DOM: page state, requests, mock data and recorded values. */
function diffStep(a, b) {
  const lines = [];
  for (const key of Object.keys(a.state)) {
    if (!sameJson(a.state[key], b.state[key])) lines.push(`page ${key}: legacy ${JSON.stringify(a.state[key])} vs vue ${JSON.stringify(b.state[key])}`);
  }
  lines.push(...diffLists('request', a.requests, b.requests));
  lines.push(...diffLists('mock', a.mockState.nodes, b.mockState.nodes));
  if (!sameJson(a.mockState.perms, b.mockState.perms)) {
    lines.push(`mock perms: legacy ${JSON.stringify(a.mockState.perms)} vs vue ${JSON.stringify(b.mockState.perms)}`);
  }
  for (const key of new Set([...Object.keys(a.recorded), ...Object.keys(b.recorded)])) {
    if (!sameJson(a.recorded[key], b.recorded[key])) {
      lines.push(`recorded ${key}: legacy ${JSON.stringify(a.recorded[key])} vs vue ${JSON.stringify(b.recorded[key])}`);
    }
  }
  return lines;
}

/** Compares two screenshots pixel by pixel in the browser; returns null when equal. */
async function diffScreenshots(page, args, legacyFile, vueFile) {
  const [left, right] = await Promise.all([legacyFile, vueFile].map((file) => readFile(join(args.out, file), 'base64')));
  return page.evaluate(
    async ({ left, right }) => {
      const load = (data) =>
        new Promise((done, fail) => {
          const img = new Image();
          img.onload = () => done(img);
          img.onerror = fail;
          img.src = `data:image/png;base64,${data}`;
        });
      const [a, b] = await Promise.all([load(left), load(right)]);
      if (a.width !== b.width || a.height !== b.height) return `size ${a.width}x${a.height} vs ${b.width}x${b.height}`;
      const pixels = (img) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const pa = pixels(a);
      const pb = pixels(b);
      let count = 0;
      let maxDelta = 0;
      let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
      for (let i = 0; i < pa.length; i += 4) {
        const delta = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        // A channel off by a few levels is compositing noise (an element that ran a fade-in animation is
        // drawn through its own layer with rounded opacity); anything visible differs by far more.
        if (delta > 8) {
          maxDelta = Math.max(maxDelta, delta);
          count++;
          const x = (i / 4) % a.width;
          const y = Math.floor(i / 4 / a.width);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      return count ? `${count} pixels differ by up to ${maxDelta} within [${x0}, ${y0}, ${x1 - x0 + 1}, ${y1 - y0 + 1}]` : null;
    },
    { left, right },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = scenarios.filter((s) => !args.only || args.only.some((name) => s.name === name || s.name.startsWith(name)));
  if (args.list) {
    console.log(selected.map((s) => s.name).join('\n'));
    return 0;
  }
  try {
    await fetch(`${args.base}/dev/index.html`);
  } catch {
    console.error(`Cannot reach ${args.base}; start the dev server first (yarn dev).`);
    return 2;
  }
  await rm(args.out, { recursive: true, force: true });
  await mkdir(args.out, { recursive: true });

  const started = Date.now();
  // Grayscale text antialiasing: LCD antialiasing depends on whether text sits on its own compositor
  // layer (an element that ran an animation, for example), which made identical pages differ in pixels.
  // Headless Chromium hides scrollbars (or overlays them, on macOS); with classic ones shown, a scrolling page has a 15 px
  // scrollbar and Bootstrap's body padding for it (and the padding the stacked dialogs leak) shows up.
  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--disable-lcd-text', '--force-color-profile=srgb', '--disable-features=OverlayScrollbar'],
    ignoreDefaultArgs: ['--hide-scrollbars'],
  });
  const pixelPage = await (await browser.newContext()).newPage();
  let failed = 0;
  for (const scenario of selected) {
    const report = [];
    const known = [];
    try {
      const legacy = await runSide(browser, args, scenario, 'legacy');
      const vue = await runSide(browser, args, scenario, 'vue');
      if (legacy.steps.length !== vue.steps.length) report.push('  step count differs between the sides');
      if (args.dump) {
        for (const step of legacy.steps) console.log(`  dump [${step.label}] ${JSON.stringify({ state: step.state, requests: step.requests, recorded: step.recorded })}`);
      }
      for (let i = 0; i < Math.min(legacy.steps.length, vue.steps.length); i++) {
        const a = legacy.steps[i];
        const b = vue.steps[i];
        const all = [...diffSnapshots(a.tree, b.tree, args.maxDiffs), ...diffStep(a, b)];
        const lines = [];
        for (const line of all) {
          const decided = (scenario.known || []).find((entry) => entry.pattern.test(line));
          if (decided) known.push(`  known [${a.label}] ${decided.reason}`);
          else lines.push(line);
        }
        // Pixels are only compared where everything else matched, decided differences included;
        // otherwise they only repeat what the other lines say.
        if (!all.length) {
          const pixels = await diffScreenshots(pixelPage, args, a.screenshot, b.screenshot);
          const line = pixels && `screenshot: ${pixels}`;
          const decided = line && (scenario.known || []).find((entry) => entry.pattern.test(line));
          if (decided) known.push(`  known [${a.label}] ${decided.reason}`);
          else if (line) lines.push(line);
        }
        if (lines.length) report.push(`  [${a.label}]`, ...lines.map((l) => `    ${l}`));
      }
      // Console errors on the legacy side are AngularJS noise; on the Vue side they are failures.
      report.push(...vue.errors.map((e) => `  vue page ${e}`));
    } catch (error) {
      report.push(`  scenario failed: ${error.message.split('\n').filter((l) => !/^\s*-\s+(waiting|locator resolved|attempting|scrolling|done scrolling|element is|retrying|\d+ × )/.test(l.replace(/\x1b\[\d+m/g, ''))).slice(0, 8).join(' | ')}`);
    }
    if (report.length) {
      failed++;
      console.log(`FAIL ${scenario.name}`);
      console.log(report.join('\n'));
    } else {
      console.log(`ok   ${scenario.name}${known.length ? ' (with decided differences)' : ''}`);
    }
    if (known.length) console.log([...new Set(known)].join('\n'));
  }
  await browser.close();
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`\n${selected.length - failed}/${selected.length} scenarios match in ${seconds} s. Screenshots: ${args.out}`);
  return failed ? 1 : 0;
}

process.exit(await main());
