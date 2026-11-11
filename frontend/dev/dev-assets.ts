import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));
const nodeModules = join(here, '../node_modules');
const legacy = join(here, '../legacy');

/** URL prefix to directory. Classic scripts and plain files bypass Vite's module pipeline this way. */
const mounts: Record<string, string> = {
  '/vendor/bootstrap/': join(nodeModules, 'bootstrap/dist'),
  '/vendor/jquery/': join(nodeModules, 'jquery/dist'),
  '/legacy/bower/': join(legacy, 'vendor'),
  '/legacy/dist/': legacy,
  '/harness/': here,
};

const types: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.svg': 'image/svg+xml',
};

/** Dev only: serves vendor files, the legacy AngularJS files and shared harness scripts as static files. */
export function devAssetsPlugin(): Plugin {
  return {
    name: 'fm-dev-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '').split('?')[0]);
        const prefix = Object.keys(mounts).find((p) => pathname.startsWith(p));
        if (!prefix) return next();
        const file = normalize(join(mounts[prefix], pathname.slice(prefix.length)));
        if (!file.startsWith(mounts[prefix])) return next();
        try {
          if (!statSync(file).isFile()) return next();
        } catch {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}
