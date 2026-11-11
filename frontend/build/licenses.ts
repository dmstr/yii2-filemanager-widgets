import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Name of the notice file emitted next to the bundle. */
export const LICENSES_FILE = 'filemanager.licenses.txt';

const BANNER =
  `/*! Vue 3 file manager widget. Contains Vue (MIT) and code derived from isteven-multi-select (MIT) and ` +
  `angular-filemanager (MIT); their notices are in ${LICENSES_FILE} in the same directory. */\n`;

/** Notices of code that is part of the repository: the `*.license.txt` files next to this plugin, one per work. */
const noticesDir = fileURLToPath(new URL('./', import.meta.url));
const NOTICE_SUFFIX = '.license.txt';

const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'LICENCE'];

interface Dependency {
  name: string;
  version: string;
  license: string;
  text: string;
}

/** Root directory of the npm package a module path belongs to, or `undefined` for the project's own files. */
function packageRoot(moduleId: string): string | undefined {
  const marker = '/node_modules/';
  const at = moduleId.lastIndexOf(marker);
  if (at < 0 || moduleId.includes('\0')) {
    return undefined;
  }
  const rest = moduleId.slice(at + marker.length).split('/');
  const parts = rest[0].startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1);
  return moduleId.slice(0, at + marker.length) + parts.join('/');
}

/** Reads name, version and licence text of an installed package; a package without a licence file fails the build. */
function readDependency(root: string): Dependency {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string; license?: string };
  const file = LICENSE_NAMES.map((name) => join(root, name)).find((path) => existsSync(path));
  if (!file) {
    throw new Error(`${manifest.name} is bundled but ships no licence file; add its notice as a *.license.txt file to frontend/build/ or handle it in build/licenses.ts`);
  }
  return { name: manifest.name, version: manifest.version, license: manifest.license ?? 'see text', text: readFileSync(file, 'utf8').trim() };
}

/**
 * Emits `filemanager.licenses.txt` and points the two bundle files to it with a banner comment.
 * The notices are those of every npm package compiled into the bundle (read from `node_modules`
 * at build time, so they follow the installed version) and the committed texts in
 * `frontend/build/*.license.txt`. No timestamps and no paths, so the output is deterministic.
 */
export function licensesPlugin(): Plugin {
  return {
    name: 'filemanager-licenses',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const roots = new Set<string>();
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') {
          for (const id of chunk.moduleIds) {
            const root = packageRoot(id);
            root && roots.add(root);
          }
        }
      }
      const dependencies = [...roots].map(readDependency).sort((a, b) => a.name.localeCompare(b.name));

      // Packages that share one licence text are listed together under it.
      const byText = new Map<string, Dependency[]>();
      for (const dependency of dependencies) {
        byText.set(dependency.text, [...(byText.get(dependency.text) ?? []), dependency]);
      }
      const sections: string[] = [];
      for (const [text, group] of byText) {
        sections.push(`${group.map((d) => `${d.name} ${d.version} (${d.license})`).join('\n')}\n\n${text}`);
      }
      const own = readdirSync(noticesDir)
        .filter((name) => name.endsWith(NOTICE_SUFFIX))
        .sort()
        .map((name) => readFileSync(join(noticesDir, name), 'utf8').trim());

      const rule = '\n\n' + '-'.repeat(80) + '\n\n';
      const header = `Third-party notices for filemanager.js and filemanager.css`;
      this.emitFile({ type: 'asset', fileName: LICENSES_FILE, source: [header, ...sections, ...own].join(rule) + '\n' });

      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk' && file.fileName === 'filemanager.js') {
          file.code = BANNER + file.code;
        } else if (file.type === 'asset' && file.fileName === 'filemanager.css') {
          file.source = BANNER + String(file.source);
        }
      }
    },
  };
}
