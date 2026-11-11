import { createApp } from 'vue';
import FileManager from './components/FileManager.vue';
import './styles/filemanager.less';

/** Mounts the app into the first <angular-filemanager> element, if the page has one. */
function mount(): void {
  const root = document.querySelector('angular-filemanager');
  if (root) {
    createApp(FileManager).mount(root);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
