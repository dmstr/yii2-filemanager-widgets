<script setup lang="ts">
/**
 * Extract dialog (`#extract`). Port of the AngularJS modal markup; the
 * AngularJS `ng-init="singleSelection().emptyName()"` is dropped (Q-09: the method it calls never existed).
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

/** `ng-model="singleSelection().tempModel.name"` (Q-29 without a single selection). */
const name = tempModelField(() => fm.singleSelection(), 'name');
</script>

<template>
  <BaseModal id="extract" v-slot="{ close }">
    <form @submit.prevent="fm.extract()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('extract_item') }}</h4>
      </div>
      <div class="modal-body">
        <div v-show="fm.api.asyncSuccess">
          <div class="label label-success error-msg">{{ t('extraction_started') }}</div>
        </div>
        <div v-show="!fm.api.asyncSuccess">
          <label class="radio">{{ t('enter_folder_name_for_extraction') }} <b>{{ fm.singleSelection()?.model.name ?? '' }}</b></label>
          <input class="form-control" v-text-model="name" autofocus>
        </div>
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <div v-show="fm.api.asyncSuccess">
          <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('close') }}</button>
        </div>
        <div v-show="!fm.api.asyncSuccess">
          <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('extract') }}</button>
        </div>
      </div>
    </form>
  </BaseModal>
</template>
