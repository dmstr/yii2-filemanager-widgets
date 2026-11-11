<script setup lang="ts">
/** Delete confirmation dialog (`#remove`). Port of the AngularJS modal markup. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';
import SelectedFilesMsg from './SelectedFilesMsg.vue';

const fm = useFileManager();
const { t } = useI18n();

/**
 * Cross and Cancel carried both `data-dismiss="modal"` and
 * `ng-click="$parent.refreshLocation()"`. AngularJS binds `ng-click` on the
 * button itself, Bootstrap binds its dismiss handler delegated on the modal
 * element, so the button's own handler ran first: refresh, then hide.
 */
function dismiss(close: () => void): void {
  fm.refreshLocation();
  close();
}
</script>

<template>
  <BaseModal id="remove" v-slot="{ close }">
    <form @submit.prevent="fm.remove()">
      <div class="modal-header">
        <button type="button" class="close" @click="dismiss(close)">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('confirm') }}</h4>
      </div>
      <div class="modal-body">
        {{ t('sure_to_delete') }} <SelectedFilesMsg />

        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="dismiss(close)">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess" autofocus>{{ t('remove') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
