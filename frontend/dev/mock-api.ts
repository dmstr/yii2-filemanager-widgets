import type { IncomingMessage, ServerResponse } from 'node:http';
import { crc32, deflateSync } from 'node:zlib';
import type { Plugin } from 'vite';

/**
 * In-memory mock of the filefly API for the dev harness. Shapes follow
 * yii2-filefly-module's ApiController; the five actions filefly lacks
 * (downloadMultiple, getContent, edit, compress, extract) are implemented in
 * the simplest plausible way. Paths are stored like Flysystem does: no leading
 * or trailing slash, '' is the root.
 *
 * Test hooks: list path `/__error__` answers HTTP 500 with `result.error`; the
 * header `X-Mock-Error: <status>` (or query `mockError=<status>`) makes any
 * request fail with `error.message`; `X-Mock-Delay: <ms>` delays the answer.
 * `GET /mock/state` dumps the store (paths, types, sizes, permissions) so the
 * parity tool can compare what both pages changed.
 */

interface Node {
  type: 'dir' | 'file';
  content: Buffer;
  mtime: number;
  thumbnail?: boolean;
  urls?: Record<string, string>;
}

type Json = Record<string, unknown>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super('http error');
  }
}

// ---------------------------------------------------------------- byte helpers

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const be32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
};

/** Valid truecolor PNG with a diagonal gradient, so thumbnails are recognisable. */
function makePng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const f = 0.4 + 0.6 * ((x + y) / (width + height));
      row[1 + x * 3] = Math.round(rgb[0] * f);
      row[2 + x * 3] = Math.round(rgb[1] * f);
      row[3 + x * 3] = Math.round(rgb[2] * f);
    }
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    return Buffer.concat([be32(data.length), head, be32(crc32(head))]);
  };
  const ihdr = Buffer.concat([be32(width), be32(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 1x1 baseline JPEG. */
const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

const svg = (fill: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="${fill}"/></svg>`,
  );

/** Minimal one-page PDF with a text line. */
function makePdf(text: string): Buffer {
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** ZIP archive using the "stored" method only; enough for compress, extract and downloadMultiple. */
function makeZip(entries: { name: string; data: Buffer }[]): Buffer {
  const dosDate = ((2024 - 1980) << 9) | (1 << 5) | 1;
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(dosDate),
      u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), nameBuf, data,
    ]);
    centrals.push(
      Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(dosDate),
        u32(crc), u32(data.length), u32(data.length), u16(nameBuf.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), nameBuf,
      ]),
    );
    locals.push(local);
    offset += local.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...locals, central, end]);
}

/** Reads archives written by makeZip; returns [] for anything else. */
function readZip(buf: Buffer): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  let pos = 0;
  while (pos + 30 <= buf.length && buf.readUInt32LE(pos) === 0x04034b50) {
    const method = buf.readUInt16LE(pos + 8);
    const size = buf.readUInt32LE(pos + 22);
    const nameLen = buf.readUInt16LE(pos + 26);
    const extraLen = buf.readUInt16LE(pos + 28);
    const start = pos + 30 + nameLen + extraLen;
    if (method !== 0) return [];
    out.push({ name: buf.toString('utf8', pos + 30, pos + 30 + nameLen), data: buf.subarray(start, start + size) });
    pos = start + size;
  }
  return out;
}

// ------------------------------------------------------------------- the store

const norm = (p: unknown): string => {
  const raw = Array.isArray(p) ? p.join('/') : String(p ?? '');
  return raw.split('/').filter(Boolean).join('/');
};
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const dirName = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const joinPath = (...parts: string[]) => parts.filter(Boolean).join('/');
const extOf = (name: string) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '');

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain; charset=utf-8',
};
const mimeOf = (name: string) => MIME[extOf(name).toLowerCase()] ?? 'application/octet-stream';

function formatDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

interface RoleEntry {
  role: string;
  selected: boolean;
}
type Perms = { read: RoleEntry[]; update: RoleEntry[]; delete: RoleEntry[] };

class Store {
  nodes = new Map<string, Node>();
  perms = new Map<string, Perms>();

  constructor() {
    this.seed();
  }

  private addDir(path: string, mtime: number) {
    const parent = dirName(path);
    if (parent && !this.nodes.has(parent)) this.addDir(parent, mtime);
    this.nodes.set(path, { type: 'dir', content: Buffer.alloc(0), mtime });
  }

  put(path: string, content: Buffer, extra: Partial<Node> = {}, mtime = Date.now()) {
    const parent = dirName(path);
    if (parent && !this.nodes.has(parent)) this.addDir(parent, mtime);
    this.nodes.set(path, { type: 'file', content, mtime, ...extra });
  }

  seed() {
    this.nodes.clear();
    this.perms.clear();
    const t = (s: string) => Date.parse(`${s}Z`);
    for (const d of [
      'Documents', 'Documents/Reports', 'Documents/Reports/2024', 'Images', 'Images/Holiday',
      'Archive', 'Empty folder', 'Müller Ärger',
    ]) {
      this.addDir(d, t('2024-03-01T09:00:00'));
    }
    this.put('readme.txt', Buffer.from('Mock file manager.\nSecond line.\n'), {}, t('2024-03-02T10:15:00'));
    this.put('LICENSE', Buffer.from('MIT\n'), {}, t('2024-03-02T10:16:00'));
    this.put(
      'this-is-an-extremely-long-file-name-that-should-overflow-the-table-cell-and-test-truncation-1234567890.txt',
      Buffer.from('long name\n'), {}, t('2024-03-03T08:00:00'),
    );
    this.put('Müller Übersicht Größe.txt', Buffer.from('Umlaute: äöüß\n'), {}, t('2024-03-04T12:30:00'));
    this.put('Ärger mit Leerzeichen.txt', Buffer.from('spaces\n'), {}, t('2024-03-04T12:31:00'));
    this.put('Müller Ärger/Nachricht für Frau Köhler.txt', Buffer.from('Hallo\n'), {}, t('2024-03-05T07:45:00'));
    this.put('Documents/Annual Report 2024.pdf', makePdf('Annual Report 2024'), {
      urls: { 'Public URL': 'https://example.com/media/annual-report-2024.pdf' },
    }, t('2024-02-20T16:00:00'));
    this.put('Documents/Reports/2024/summary notes.txt', Buffer.from('Q1 summary\n'), {}, t('2024-04-01T09:00:00'));
    this.put('Documents/Reports/2024/data.txt', Buffer.from('a;b;c\n1;2;3\n'), {}, t('2024-04-02T09:00:00'));
    this.put('Images/photo-red.png', makePng(160, 120, [220, 40, 40]), { thumbnail: true }, t('2024-01-10T11:00:00'));
    this.put('Images/photo-blue.png', makePng(120, 160, [40, 80, 220]), { thumbnail: true }, t('2024-01-11T11:00:00'));
    this.put('Images/pixel.jpg', JPEG_1X1, {}, t('2024-01-12T11:00:00'));
    this.put('Images/vector.svg', svg('#2a9d8f'), {}, t('2024-01-13T11:00:00'));
    this.put('Images/Holiday/sunset over the lake.png', makePng(200, 100, [240, 140, 40]), {}, t('2023-08-14T20:30:00'));
    this.put('Images/Holiday/Strand Größe 1.jpeg', JPEG_1X1, {}, t('2023-08-15T10:00:00'));
    this.put('Archive/backup.zip', makeZip([
      { name: 'notes/one.txt', data: Buffer.from('one\n') },
      { name: 'notes/two.txt', data: Buffer.from('two\n') },
    ]), {}, t('2024-02-01T00:00:00'));
  }

  isDir(path: string) {
    return path === '' || this.nodes.get(path)?.type === 'dir';
  }
  exists(path: string) {
    return path === '' || this.nodes.has(path);
  }
  /** The path itself plus everything below it. */
  subtree(path: string): string[] {
    return [...this.nodes.keys()].filter((k) => k === path || k.startsWith(`${path}/`));
  }
  children(path: string): string[] {
    return [...this.nodes.keys()].filter((k) => dirName(k) === path);
  }
  remove(path: string) {
    for (const k of this.subtree(path)) {
      this.nodes.delete(k);
      this.perms.delete(k);
    }
  }
  move(from: string, to: string) {
    for (const k of this.subtree(from)) {
      const target = to + k.slice(from.length);
      this.nodes.set(target, this.nodes.get(k)!);
      this.nodes.delete(k);
      const p = this.perms.get(k);
      if (p) {
        this.perms.set(target, p);
        this.perms.delete(k);
      }
    }
  }
}

// ------------------------------------------------------------------- HTTP glue

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

interface UploadedFile {
  field: string;
  filename: string;
  data: Buffer;
}

/** Just enough multipart/form-data parsing for the upload action. */
function parseMultipart(body: Buffer, contentType: string) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  if (!boundary) return { fields, files };
  const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  let pos = body.indexOf(delimiter);
  while (pos !== -1) {
    const start = pos + delimiter.length;
    if (body.subarray(start, start + 2).toString() === '--') break;
    const next = body.indexOf(delimiter, start);
    if (next === -1) break;
    const part = body.subarray(start + 2, next - 2); // skip leading CRLF and trailing CRLF
    const split = part.indexOf('\r\n\r\n');
    const head = part.subarray(0, split).toString('utf8');
    const data = part.subarray(split + 4);
    const name = /name="([^"]*)"/.exec(head)?.[1] ?? '';
    const filename = /filename="([^"]*)"/.exec(head)?.[1];
    if (filename !== undefined) files.push({ field: name, filename, data });
    else fields[name] = data.toString('utf8');
    pos = next;
  }
  return { fields, files };
}

/** Parses a query string the way PHP and jQuery.param use it, including `items[]=a&items[]=b`. */
function parseQuery(search: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [rawKey, value] of new URLSearchParams(search)) {
    const key = rawKey.endsWith('[]') ? rawKey.slice(0, -2) : rawKey;
    if (rawKey.endsWith('[]')) {
      const list = (out[key] as string[] | undefined) ?? [];
      list.push(value);
      out[key] = list;
    } else {
      out[key] = value;
    }
  }
  return out;
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};
const sendBytes = (res: ServerResponse, data: Buffer, type: string, disposition?: string) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Length', data.length);
  if (disposition) res.setHeader('Content-Disposition', disposition);
  res.end(data);
};
const result = (error = '', extra: Json = {}) => ({ result: { success: error === '', error, ...extra } });

const ROLES = ['Admin', 'Editor', 'Authenticated'];
const defaultPerms = (): Perms => ({
  read: ROLES.map((role) => ({ role, selected: true })),
  update: ROLES.map((role) => ({ role, selected: role !== 'Authenticated' })),
  delete: ROLES.map((role) => ({ role, selected: role === 'Admin' })),
});

function createHandler() {
  let store = new Store();
  const streamUrl = (path: string) => `/mock/api?action=stream&path=${encodeURIComponent(`/${path}`)}`;

  const listEntry = (path: string) => {
    const n = store.nodes.get(path)!;
    const withImages = n.thumbnail === true;
    return {
      name: baseName(path),
      dirname: dirName(path),
      path,
      urls: n.urls ?? [],
      thumbnail: withImages ? streamUrl(path) : '',
      preview: withImages ? streamUrl(path) : '',
      size: n.type === 'dir' ? 0 : n.content.length,
      date: formatDate(n.mtime),
      type: n.type,
      extension: n.type === 'file' ? extOf(baseName(path)) : '',
    };
  };

  /** Files and folders as zip entries, relative to their own name. */
  const zipEntries = (paths: string[]) => {
    const entries: { name: string; data: Buffer }[] = [];
    for (const p of paths) {
      for (const k of store.subtree(p)) {
        const n = store.nodes.get(k)!;
        if (n.type === 'file') entries.push({ name: joinPath(baseName(p), k.slice(p.length + 1)), data: n.content });
      }
    }
    return entries;
  };

  const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(norm) : v ? [norm(v)] : []);

  function post(res: ServerResponse, body: Json) {
    const action = String(body.action ?? '');
    switch (action) {
      case 'list': {
        const path = norm(body.path);
        if (path === '__error__') throw new HttpError(500, result('Mock error: listing failed'));
        return send(res, 200, { result: store.children(path).map(listEntry) });
      }
      case 'createFolder': {
        const path = norm(body.newPath);
        if (store.exists(path)) return send(res, 200, result('exists'));
        store.nodes.set(path, { type: 'dir', content: Buffer.alloc(0), mtime: Date.now() });
        return send(res, 200, result());
      }
      case 'rename': {
        const from = norm(body.item);
        const to = norm(body.newItemPath);
        if (!store.exists(from)) return send(res, 200, result('file_not_found'));
        if (store.exists(to)) return send(res, 200, result('renaming_failed'));
        store.move(from, to);
        return send(res, 200, result());
      }
      case 'move': {
        const target = norm(body.newPath);
        let moved = false;
        for (const item of asList(body.items)) {
          if (!store.exists(item)) return send(res, 200, result('notfound'));
          const to = joinPath(target, baseName(item));
          if (store.exists(to) || to === item || to.startsWith(`${item}/`)) return send(res, 200, result('movefailed'));
          store.move(item, to);
          moved = true;
        }
        return send(res, 200, moved ? result() : result('notfound'));
      }
      case 'copy': {
        const target = norm(body.newPath);
        // filefly reads `newFilename`, which the legacy client never sends (it sends singleFilename); mirrored on purpose.
        const newName = body.newFilename ? String(body.newFilename) : null;
        let copied = false;
        for (const item of asList(body.items)) {
          const node = store.nodes.get(item);
          // filefly returns a bare `false` for anything that is not a file
          if (!node || node.type !== 'file') return send(res, 200, false);
          store.nodes.set(joinPath(target, newName ?? baseName(item)), { ...node, content: Buffer.from(node.content), mtime: Date.now() });
          copied = true;
        }
        return send(res, 200, copied ? result() : result('copyfailed'));
      }
      case 'remove': {
        let removed = false;
        for (const item of asList(body.items)) {
          if (!store.exists(item) || item === '') continue;
          store.remove(item);
          removed = true;
        }
        return send(res, 200, removed ? result() : result('permission_delete_error'));
      }
      case 'resolvePermissions':
        return send(res, 200, { auth: store.perms.get(norm(body.path)) ?? defaultPerms() });
      case 'changePermissions': {
        const item = (body.item ?? {}) as Json;
        const current = store.perms.get(norm(body.path)) ?? defaultPerms();
        store.perms.set(norm(body.path), {
          read: (item.authRead as RoleEntry[] | null) ?? current.read,
          update: (item.authUpdate as RoleEntry[] | null) ?? current.update,
          delete: (item.authDelete as RoleEntry[] | null) ?? current.delete,
        });
        return send(res, 200, result());
      }
      case 'getContent': {
        const node = store.nodes.get(norm(body.item));
        if (!node || node.type !== 'file') return send(res, 200, result('file_not_found'));
        return send(res, 200, { result: node.content.toString('utf8') });
      }
      case 'edit': {
        const node = store.nodes.get(norm(body.item));
        if (!node || node.type !== 'file') return send(res, 200, result('file_not_found'));
        node.content = Buffer.from(String(body.content ?? ''), 'utf8');
        node.mtime = Date.now();
        return send(res, 200, result());
      }
      case 'compress': {
        const items = asList(body.items);
        if (!items.length || !items.every((i) => store.exists(i))) return send(res, 200, result('file_not_found'));
        let name = String(body.compressedFilename || 'archive');
        if (!name.toLowerCase().endsWith('.zip')) name += '.zip';
        const target = joinPath(norm(body.destination), name);
        if (store.exists(target)) return send(res, 200, result('file_already_exists'));
        store.put(target, makeZip(zipEntries(items)));
        return send(res, 200, result());
      }
      case 'extract': {
        const archive = store.nodes.get(norm(body.item));
        if (!archive || archive.type !== 'file') return send(res, 200, result('file_not_found'));
        const target = joinPath(norm(body.destination), String(body.folderName ?? '').replace(/\//g, ''));
        if (!baseName(target) || store.exists(target)) return send(res, 200, result('exists'));
        store.nodes.set(target, { type: 'dir', content: Buffer.alloc(0), mtime: Date.now() });
        const entries = readZip(archive.content);
        // Anything that is not a zip written by this mock gets a placeholder so the folder is not empty.
        if (!entries.length) entries.push({ name: 'extracted.txt', data: Buffer.from('placeholder\n') });
        for (const e of entries) store.put(joinPath(target, e.name), e.data);
        return send(res, 200, result());
      }
      default:
        throw new HttpError(404, { name: 'Not Found', message: 'Unknown action', status: 404 });
    }
  }

  function upload(res: ServerResponse, fields: Record<string, string>, files: UploadedFile[]) {
    const destination = norm(fields.destination);
    let error = '';
    const uploaded: string[] = [];
    for (const f of files) {
      const path = joinPath(destination, f.filename.replace(/\//g, ''));
      if (!baseName(path) || store.exists(path)) {
        error = 'file_already_exists';
        continue;
      }
      store.put(path, f.data);
      uploaded.push(path);
    }
    // filefly answers 400 as soon as any file failed
    send(res, error ? 400 : 200, result(error, { uploadedFiles: uploaded }));
  }

  function get(res: ServerResponse, query: Record<string, string | string[]>) {
    const action = String(query.action ?? '');
    if (action === 'downloadMultiple') {
      const items = asList(query.items);
      const name = String(query.toFilename || 'filemanager.zip');
      return sendBytes(res, makeZip(zipEntries(items)), 'application/zip', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    }
    if (action === 'download' || action === 'stream') {
      const path = norm(query.path);
      const node = store.nodes.get(path);
      if (!node || node.type !== 'file') throw new HttpError(404, { name: 'Not Found', message: 'File not found', status: 404 });
      const kind = action === 'download' ? 'attachment' : 'inline';
      return sendBytes(res, node.content, mimeOf(baseName(path)), `${kind}; filename*=UTF-8''${encodeURIComponent(baseName(path))}`);
    }
    throw new HttpError(404, { name: 'Not Found', message: 'Unknown action', status: 404 });
  }

  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (req.headers['x-mock-delay']) await new Promise((r) => setTimeout(r, Number(req.headers['x-mock-delay']) || 0));
    try {
      if (url.pathname === '/mock/reset') {
        if (req.method !== 'POST') throw new HttpError(405, { message: 'POST only' });
        store = new Store();
        return send(res, 200, { result: { success: true } });
      }
      if (url.pathname === '/mock/state') {
        const nodes = [...store.nodes.entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([path, node]) => `${node.type} ${path} ${node.content.length}`);
        const perms = Object.fromEntries([...store.perms.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
        return send(res, 200, { nodes, perms });
      }
      const forced = req.headers['x-mock-error'] ?? url.searchParams.get('mockError');
      if (forced) {
        throw new HttpError(Number(forced) || 500, { error: { message: `Mock error (forced ${forced})` } });
      }
      if (req.method === 'GET') return get(res, parseQuery(url.search));
      if (req.method !== 'POST') throw new HttpError(405, { message: 'Method not allowed' });
      const raw = await readBody(req);
      const type = String(req.headers['content-type'] ?? '');
      if (type.startsWith('multipart/form-data')) {
        const { fields, files } = parseMultipart(raw, type);
        return upload(res, fields, files);
      }
      let body: Json = {};
      try {
        body = raw.length ? (JSON.parse(raw.toString('utf8')) as Json) : {};
      } catch {
        throw new HttpError(400, { message: 'Invalid JSON body' });
      }
      return post(res, body);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, e.body);
      console.error(e);
      return send(res, 500, { error: { message: String(e) } });
    }
  };
}

/** Dev only: mounts the mock at `/mock/api`, `/mock/reset` and `/mock/state`. */
export function mockApiPlugin(): Plugin {
  return {
    name: 'fm-mock-api',
    apply: 'serve',
    configureServer(server) {
      const handle = createHandler();
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/mock/api' || url.pathname === '/mock/reset' || url.pathname === '/mock/state') {
          void handle(req, res, url);
        } else {
          next();
        }
      });
    },
  };
}
