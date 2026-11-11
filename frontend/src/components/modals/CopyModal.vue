<script setup lang="ts">
/** Copy dialog (`#copy`, F-54): new name for a single item plus the destination path selector. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';
import PathSelector from './PathSelector.vue';

const fm = useFileManager();
const { t } = useI18n();

/** Same `ngTrim` and empty-field behaviour as in the rename dialog; ignored without a single selection (Q-29). */
function onNameInput(event: Event): void {
  const item = fm.singleSelection();
  if (item) {
    item.tempModel.name = (event.target as HTMLInputElement).value.trim();
  }
}
</script>

<template>
  <BaseModal id="copy" v-slot="{ close }">
    <form @submit.prevent="fm.copy()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('copy_file') }}</h4>
      </div>
      <div class="modal-body">
        <div v-show="!!fm.singleSelection()">
          <label class="radio">{{ t('enter_new_name_for') }} <b>{{ fm.singleSelection()?.model.name ?? '' }}</b></label>
          <input class="form-control" :value="fm.singleSelection()?.tempModel.name ?? ''" autofocus @input="onNameInput">
        </div>

        <!-- Q-10: the selector's own close button only hides the dialog -->
        <PathSelector @close="close()" />
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('copy') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
