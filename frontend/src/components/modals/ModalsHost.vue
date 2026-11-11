<script setup lang="ts">
/**
 * Mounts every dialog once, in the legacy order of `modals.html`. The DOM
 * order matters: stacked dialogs share z-index 1050, so the later one in the
 * document is painted on top (the selector comes last).
 */
import ChangePermissionsModal from './ChangePermissionsModal.vue';
import CompressModal from './CompressModal.vue';
import CopyModal from './CopyModal.vue';
import DownloadLinkModal from './DownloadLinkModal.vue';
import EditModal from './EditModal.vue';
import ExtractModal from './ExtractModal.vue';
import ImagePreviewModal from './ImagePreviewModal.vue';
import MoveModal from './MoveModal.vue';
import NewFolderModal from './NewFolderModal.vue';
import RemoveModal from './RemoveModal.vue';
import RenameModal from './RenameModal.vue';
import SelectorModal from './SelectorModal.vue';
import UploadModal from './UploadModal.vue';
</script>

<template>
  <ImagePreviewModal />
  <RemoveModal />
  <MoveModal />
  <RenameModal />
  <CopyModal />
  <CompressModal />
  <ExtractModal />
  <EditModal />
  <NewFolderModal />
  <UploadModal />
  <ChangePermissionsModal />
  <DownloadLinkModal />
  <SelectorModal />
</template>
