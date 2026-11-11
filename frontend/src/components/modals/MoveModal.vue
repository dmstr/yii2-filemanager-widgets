<script setup lang="ts">
/** Move dialog (`#move`, F-52) with the destination path selector. Port of the legacy modal markup. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';
import PathSelector from './PathSelector.vue';

const fm = useFileManager();
const { t } = useI18n();

/**
 * Cross and Cancel: refresh first, then hide, because legacy bound
 * `ng-click` on the button and Bootstrap's dismiss handler delegated on the
 * modal element, which runs later in the bubbling order.
 */
function dismiss(close: () => void): void {
  fm.refreshLocation();
  close();
}
</script>

<template>
  <BaseModal id="move" v-slot="{ close }">
    <form @submit.prevent="fm.move()">
      <div class="modal-header">
        <button type="button" class="close" @click="dismiss(close)">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('move') }}</h4>
      </div>
      <div class="modal-body">
        <!-- Q-10: the selector's own close button only hides the dialog, no refresh -->
        <PathSelector @close="close()" />
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="dismiss(close)">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('move') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
