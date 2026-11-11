#!/usr/bin/env node
/**
 * Parity tool: drives the legacy AngularJS page and the Vue page through the
 * same scenarios in headless Chromium, saves a screenshot of each and compares
 * the DOM inside <angular-filemanager> structurally.
 *
 *   node dev/parity/parity.mjs [--base http://localhost:5173] [--only a,b]
 *        [--list] [--include-dialogs] [--headed] [--viewport 1280x800]
 *        [--max-diffs 60]
 *
 * Needs a running dev server (`yarn dev`); see frontend/README.md. Exits 1 if
 * any scenario differs or fails, 2 if the dev server cannot be reached.
 */
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { scenarios } from './scenarios.mjs';
import { diffSnapshots, EXCLUDE_DIALOGS, takeSnapshot } from './snapshot.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');

function parseArgs(argv) {
  const args = { base: 'http://localhost:5173', only: null, list: false, includeDialogs: false, headed: false, viewport: '1280x800', maxDiffs: 60 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') args.base = argv[++i];
    else if (arg === '--only') args.only = argv[++i].split(',');
    else if (arg === '--list') args.list = true;
    else if (arg === '--include-dialogs') args.includeDialogs = true;
    else if (arg === '--headed') args.headed = true;
    else if (arg === '--viewport') args.viewport = argv[++i];
    else if (arg === '--max-diffs') args.maxDiffs = Number(argv[++i]);
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

const slug = (text) => text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

/** Opens the page for one side, runs the scenario and returns its snapshots. */
async function runSide(browser, args, scenario, side) {
  const [width, height] = args.viewport.split('x').map(Number);
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  // A failed request is logged by the browser itself; scenarios with forced API errors expect it.
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(`console.error: ${message.text()}`);
  });

  await fetch(`${args.base}/mock/reset`, { method: 'POST' });
  if (scenario.storage) {
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
    }, scenario.storage);
  }
  if (scenario.forceError) {
    await page.route('**/mock/api**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-mock-error': String(scenario.forceError) } }));
  }

  const settle = async () => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(250);
  };
  const snaps = [];
  const prefix = `${slug(scenario.name)}.${side}`;
  const helpers = {
    settle,
    item: (name) => page.locator(`angular-filemanager [title^="${name} ("]`).first(),
    row: (name) => page.locator('angular-filemanager tr.item-list', { has: page.locator(`[title^="${name} ("]`) }),
    freeArea: () => page.locator('angular-filemanager .main-navigation .item-list.clearfix'),
    async freeAreaPosition() {
      const box = await helpers.freeArea().boundingBox();
      return { x: box.width - 12, y: box.height - 8 };
    },
    async enter(name) {
      await helpers.item(name).dblclick();
      await settle();
    },
    async search(text) {
      const input = page.locator('angular-filemanager .dropdown-menu input');
      if (!(await input.isVisible())) await page.click('#dropDownMenuLang');
      await input.fill(text);
      await page.waitForTimeout(100);
    },
    async snap(label) {
      await page.waitForTimeout(150);
      await page.mouse.move(0, 0, { steps: 1 }).catch(() => {});
      const file = join(outDir, `${prefix}${label ? '.' + slug(label) : ''}.png`);
      await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
      const tree = await page.evaluate(takeSnapshot, { excludeDialogs: !args.includeDialogs && EXCLUDE_DIALOGS });
      snaps.push({ label: label || 'final', tree });
    },
  };

  const page_ = side === 'legacy' ? 'legacy.html' : 'index.html';
  await page.goto(`${args.base}/dev/${page_}${scenario.query ? '?' + scenario.query : ''}`);
  // The harness header differs between the pages (hidden, but it keeps its space), and animations
  // would make layout measurements depend on timing.
  await page.addStyleTag({
    content:
      'p.small.text-muted { visibility: hidden } *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important }',
  });
  await page.waitForSelector('angular-filemanager nav');
  await settle();
  await page.mouse.move(0, 0);
  if (scenario.run) await scenario.run(page, helpers);
  if (!snaps.length) await helpers.snap('');
  await context.close();
  return { snaps, errors };
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
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: !args.headed });
  let failed = 0;
  for (const scenario of selected) {
    const report = [];
    const known = [];
    try {
      const legacy = await runSide(browser, args, scenario, 'legacy');
      const vue = await runSide(browser, args, scenario, 'vue');
      if (legacy.snaps.length !== vue.snaps.length) report.push('snapshot count differs between the sides');
      for (let i = 0; i < Math.min(legacy.snaps.length, vue.snaps.length); i++) {
        const all = diffSnapshots(legacy.snaps[i].tree, vue.snaps[i].tree, args.maxDiffs);
        const lines = [];
        for (const line of all) {
          const decided = (scenario.known || []).find((entry) => entry.pattern.test(line));
          if (decided) known.push(`  known [${legacy.snaps[i].label}] ${decided.reason}`);
          else lines.push(line);
        }
        if (lines.length) report.push(`  [${legacy.snaps[i].label}]`, ...lines.map((l) => `    ${l}`));
      }
      // Console errors on the legacy side are AngularJS noise; on the Vue side they are failures.
      report.push(...vue.errors.map((e) => `  vue page ${e}`));
    } catch (error) {
      report.push(`  scenario failed: ${error.message.split('\n').slice(0, 6).join(' | ')}`);
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
  console.log(`\n${selected.length - failed}/${selected.length} scenarios match. Screenshots: ${outDir}`);
  return failed ? 1 : 0;
}

process.exit(await main());
