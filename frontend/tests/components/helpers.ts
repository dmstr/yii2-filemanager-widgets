/** Shared setup for the component specs: a mounted widget on a stubbed API. */
import { mount, type VueWrapper } from '@vue/test-utils';
import FileManagerRoot from '../../src/components/FileManager.vue';
import type { FileManagerConfig } from '../../src/config/types.ts';
import { createFileManager, type FileManager } from '../../src/services/fileManager.ts';
import { dir, file, flush, makeConfig, makeI18n, stubFetch, type FakeReply, type RecordedRequest } from '../services/helpers.ts';
import type { RawItem } from '../../src/models/Item.ts';

export { dir, file };

/** A folder listing with every kind of entry the menu distinguishes. */
export const sampleFiles: RawItem[] = [
  dir('folder'),
  file('notes.txt'),
  file('photo.png', { thumbnail: '/thumbs/photo.png' }),
  file('backup.zip'),
  file('other.txt'),
];

export interface Mounted {
  wrapper: VueWrapper;
  fm: FileManager;
  config: FileManagerConfig;
  requests: RecordedRequest[];
}

/** Lets chained promises, stubbed fetches and the next render finish. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await flush();
  }
}

export interface MountOptions {
  config?: Partial<FileManagerConfig>;
  allowedActions?: Partial<FileManagerConfig['allowedActions']>;
  files?: RawItem[];
  reply?: (request: RecordedRequest) => FakeReply | undefined;
  /** Stored view name, set before the state is created. */
  view?: string;
}

/** Mounts the whole widget attached to the document (the context menu and dropdowns listen on `document`). */
export async function mountWidget(options: MountOptions = {}): Promise<Mounted> {
  window.localStorage.clear();
  if (options.view) {
    window.localStorage.setItem('viewTemplate', options.view);
  }
  const requests = stubFetch((request) => options.reply?.(request) ?? { body: { result: options.files ?? sampleFiles } });
  const base = makeConfig(options.config);
  Object.assign(base.allowedActions, options.allowedActions);
  const i18n = makeI18n();
  const fm = createFileManager(base, i18n);
  const wrapper = mount(FileManagerRoot, { props: { config: base, i18n, fileManager: fm }, attachTo: document.body });
  // A failing first listing rejects; the error state is what the specs look at.
  await fm.init().catch(() => {});
  await settle();
  requests.length = 0;
  return { wrapper, fm, config: base, requests };
}

/** v-show hides through the inline `display`. */
export const isShown = (el: Element): boolean => (el as HTMLElement).style.display !== 'none';

/** Text of the visible entries of the context menu's selection list, in order. */
export function visibleMenuEntries(wrapper: VueWrapper): string[] {
  const list = wrapper.find('#context-menu ul');
  return list
    .findAll('li')
    .filter((li) => isShown(li.element) && !li.classes('divider'))
    .map((li) => li.text());
}

