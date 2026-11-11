<script setup lang="ts">
/**
 * New folder dialog (`#newfolder`, F-58). The input binds to the phantom
 * item that opening the dialog put into the selection (Q-26).
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

/** `ngTrim` and empty-field behaviour as in the rename dialog; ignored without a single selection (Q-29). */
function onNameInput(event: Event): void {
  const item = fm.singleSelection();
  if (item) {
    item.tempModel.name = (event.target as HTMLInputElement).value.trim();
  }
}
</script>

<template>
  <BaseModal id="newfolder" v-slot="{ close }">
    <form @submit.prevent="fm.createFolder()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('new_folder') }}</h4>
      </div>
      <div class="modal-body">
        <label class="radio">{{ t('folder_name') }}</label>
        <input class="form-control" :value="fm.singleSelection()?.tempModel.name ?? ''" autofocus @input="onNameInput">
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('create') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
