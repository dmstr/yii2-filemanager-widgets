/** Shared fixtures for the service specs: stubs for `fetch` and `XMLHttpRequest`, a config with distinct URLs. */
import { vi } from 'vitest';
import { createDefaults } from '../../src/config/defaults.ts';
import type { FileManagerConfig } from '../../src/config/types.ts';
import { createI18n } from '../../src/i18n/index.ts';
import { Item, type RawItem } from '../../src/models/Item.ts';

/** A config whose action URLs differ, so a wrong URL in a request is visible. */
export function makeConfig(overrides: Partial<FileManagerConfig> = {}): FileManagerConfig {
  const config = createDefaults();
  for (const key of Object.keys(config) as Array<keyof FileManagerConfig>) {
    if (typeof key === 'string' && key.endsWith('Url')) {
      (config as unknown as Record<string, string>)[key] = '/api/' + key.replace(/Url$/, '');
    }
  }
  return Object.assign(config, overrides);
}

export const makeI18n = () => createI18n('en');

export function makeItem(raw: RawItem, path: string[] = [], config = makeConfig()): Item {
  return new Item(raw, path, config);
}

export const file = (name: string, extra: RawItem = {}): RawItem => ({
  name,
  type: 'file',
  size: 10,
  date: '2021-03-04 05:06:07',
  rights: 'rw-r--r--',
  ...extra,
});
export const dir = (name: string, extra: RawItem = {}): RawItem => ({ ...file(name), type: 'dir', ...extra });

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  credentials?: string;
}

export interface FakeReply {
  status?: number;
  /** Object bodies are sent as JSON, strings as text. */
  body?: unknown;
  contentType?: string;
  /** Rejects the fetch like a network failure does. */
  networkError?: boolean;
}

/** Replaces `fetch`; `reply` decides every answer. Returns the recorded requests. */
export function stubFetch(reply: (request: RecordedRequest) => FakeReply | Promise<FakeReply>): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const request: RecordedRequest = {
        url,
        method: init.method || 'GET',
        headers: init.headers as Record<string, string>,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
        credentials: init.credentials,
      };
      requests.push(request);
      const answer = await reply(request);
      if (answer.networkError) throw new TypeError('Failed to fetch');
      const isText = typeof answer.body === 'string';
      const bodyless = answer.status === 204;
      return new Response(bodyless ? null : isText ? (answer.body as string) : JSON.stringify(answer.body ?? {}), {
        status: answer.status ?? 200,
        headers: { 'Content-Type': answer.contentType ?? (isText ? 'text/html' : 'application/json') },
      });
    }),
  );
  return requests;
}

/** A controllable stand-in for `XMLHttpRequest`. */
export class FakeXhr {
  static instances: FakeXhr[] = [];
  method = '';
  url = '';
  headers: Record<string, string> = {};
  sent: FormData | null = null;
  status = 0;
  responseText = '';
  responseType = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  private uploadListeners: Record<string, Array<(event: Partial<ProgressEvent>) => void>> = {};
  upload = {
    addEventListener: (name: string, fn: (event: Partial<ProgressEvent>) => void) => {
      (this.uploadListeners[name] ||= []).push(fn);
    },
  };

  constructor() {
    FakeXhr.instances.push(this);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  getResponseHeader(name: string) {
    return name.toLowerCase() === 'content-type' ? 'application/json' : null;
  }
  send(form: FormData) {
    this.sent = form;
  }
  emitProgress(loaded: number, total: number, name = 'progress') {
    for (const fn of this.uploadListeners[name] || []) fn({ loaded, total, lengthComputable: true });
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }
}

export function stubXhr(): typeof FakeXhr {
  FakeXhr.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  return FakeXhr;
}

/** Lets pending promise callbacks and stubbed fetches run. */
export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
