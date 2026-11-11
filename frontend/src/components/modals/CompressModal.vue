<script setup lang="ts">
/**
 * Compress dialog (`#compress`). Port of the legacy modal markup. With
 * `compressAsync` the dialog stays open after the request and `asyncSuccess`
 * swaps the question for a success note and the footer for a close button.
 */
import { useConfig } from '../../config/injection.ts';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';
import SelectedFilesMsg from './SelectedFilesMsg.vue';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

/** `ng-model="temp.tempModel.name"`; `temp` always exists (Q-25: a computed value here, refreshed on every selection change). */
const name = tempModelField(() => fm.temp, 'name');
</script>

<template>
  <BaseModal id="compress" v-slot="{ close }">
    <form @submit.prevent="fm.compress()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('compress') }}</h4>
      </div>
      <div class="modal-body">
        <div v-show="fm.api.asyncSuccess">
          <div class="label label-success error-msg">{{ t('compression_started') }}</div>
        </div>
        <div v-show="!fm.api.asyncSuccess">
          <div v-show="!config.allowedActions.compressChooseName">
            {{ t('sure_to_start_compression_with') }} <b>{{ fm.singleSelection()?.model.name ?? '' }}</b> ?
          </div>
          <div v-show="config.allowedActions.compressChooseName">
            <label class="radio">
              {{ t('enter_file_name_for_compression') }}
              <SelectedFilesMsg />
            </label>
            <input class="form-control" v-text-model="name" autofocus>
          </div>
        </div>

        <ErrorBar />
      </div>
      <div class="modal-footer">
        <div v-show="fm.api.asyncSuccess">
          <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('close') }}</button>
        </div>
        <div v-show="!fm.api.asyncSuccess">
          <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('compress') }}</button>
        </div>
      </div>
    </form>
  </BaseModal>
</template>
