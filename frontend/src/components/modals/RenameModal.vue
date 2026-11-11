<script setup lang="ts">
/** Rename dialog (`#rename`, F-53). Port of the legacy modal markup. */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

/** `ng-model="singleSelection().tempModel.name"` (Q-29 without a single selection). */
const name = tempModelField(() => fm.singleSelection(), 'name');

/**
 * Legacy `{{singleSelection() && singleSelection().model.name}}`: with no or
 * several items selected the expression is `false`, which AngularJS prints as
 * the text "false"; a selection of one hole (Q-39) prints nothing.
 */
const selectedName = (): string => (fm.temps.length === 1 ? (fm.temps[0]?.model.name ?? '') : 'false');
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
        <label class="radio">{{ t('enter_new_name_for') }} <b>{{ selectedName() }}</b></label>
        <input class="form-control" v-text-model="name" autofocus>

        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('rename') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
