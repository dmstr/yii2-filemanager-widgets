import { createApp } from 'vue';
import FileManager from './components/FileManager.vue';
import { readGlobalConfig } from './config/resolve.ts';
import { createI18n } from './i18n/index.ts';
import { createFileManager } from './services/fileManager.ts';
import { initialLocale } from './services/storage.ts';
import './styles/filemanager.less';

/** Mounts the app into the first <angular-filemanager> element, if the page has one. */
function mount(): void {
  const root = document.querySelector('angular-filemanager');
  if (!root) {
    return;
  }
  const config = readGlobalConfig();
  const i18n = createI18n(initialLocale(config));
  const fileManager = createFileManager(config, i18n);
  createApp(FileManager, { config, i18n, fileManager }).mount(root);
  void fileManager.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
