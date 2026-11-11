<script setup lang="ts">
/** Rename dialog (`#rename`, F-53). Port of the legacy modal markup. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

/**
 * `ng-model` on a text input trims what the user typed (`ngTrim`) and writes
 * the result as is: an empty field gives `''`, not `undefined` (AngularJS
 * 1.5.11, no parser or validator on the input). Without a single selected
 * item the assignment went nowhere (Q-29).
 */
function onNameInput(event: Event): void {
  const item = fm.singleSelection();
  if (item) {
    item.tempModel.name = (event.target as HTMLInputElement).value.trim();
  }
}
</script>

<template>
  <BaseModal id="rename" v-slot="{ close }">
    <form @submit.prevent="fm.rename()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('rename') }}</h4>
      </div>
      <div class="modal-body">
        <label class="radio">{{ t('enter_new_name_for') }} <b>{{ fm.singleSelection()?.model.name ?? '' }}</b></label>
        <input class="form-control" :value="fm.singleSelection()?.tempModel.name ?? ''" autofocus @input="onNameInput">

        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('rename') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
