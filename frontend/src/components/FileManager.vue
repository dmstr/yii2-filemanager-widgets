<script setup lang="ts">
/**
 * Root component. Port of the AngularJS root template: provides the configuration,
 * the translator and the file manager state to all descendants, makes the
 * whole widget a drop zone for uploads (F-70) and lays out navbar, folder
 * tree, the active view, the dialogs and the context menu.
 */
import { computed } from 'vue';
import { provideConfig } from '../config/injection.ts';
import type { FileManagerConfig } from '../config/types.ts';
import { provideI18n, type I18n } from '../i18n/index.ts';
import { provideFileManager, type FileManager } from '../services/fileManager.ts';
import ContextMenu from './ContextMenu.vue';
import IconsPreviewView from './IconsPreviewView.vue';
import IconsView from './IconsView.vue';
import Navbar from './Navbar.vue';
import Sidebar from './Sidebar.vue';
import TableView from './TableView.vue';
import { useFileDrop } from './useFileDrop.ts';
import ModalsHost from './modals/ModalsHost.vue';

const props = defineProps<{ config: FileManagerConfig; i18n: I18n; fileManager: FileManager }>();

provideConfig(props.config);
provideI18n(props.i18n);
provideFileManager(props.fileManager);

const fm = props.fileManager;

const views = {
  'main-icons.html': IconsView,
  'main-table.html': TableView,
  'main-icons-preview.html': IconsPreviewView,
};
const view = computed(() => views[fm.viewTemplate]);

const { dragOver, onDragOver, onDragEnter, onDragLeave, onDrop, onPaste } = useFileDrop((files) => fm.addForUpload(files));
</script>

<template>
  <div
    :class="{ 'upload-dragover': dragOver }"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @paste="onPaste"
  >
    <div>
      <Navbar />
    </div>

    <div class="container-fluid">
      <div class="row">

        <div v-show="config.sidebar && fm.navigator.history[0]" class="col-sm-4 col-md-3 sidebar file-tree animated slow fadeIn">
          <Sidebar />
        </div>

        <div class="main" :class="config.sidebar && fm.navigator.history[0] && 'col-sm-8 col-md-9'">
          <div class="main-navigation clearfix">
            <component :is="view" />
          </div>
        </div>
      </div>
    </div>

    <div>
      <ModalsHost />
    </div>
    <div>
      <ContextMenu />
    </div>
  </div>
</template>
