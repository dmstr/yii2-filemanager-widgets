<script setup lang="ts">
/** Copy dialog (`#copy`): new name for a single item plus the destination path selector. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';
import PathSelector from './PathSelector.vue';

const fm = useFileManager();
const { t } = useI18n();

/** `ng-model="singleSelection().tempModel.name"` (Q-29 without a single selection). */
const name = tempModelField(() => fm.singleSelection(), 'name');
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
          <input class="form-control" v-text-model="name" autofocus>
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
