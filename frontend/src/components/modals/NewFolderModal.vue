<script setup lang="ts">
/**
 * New folder dialog (`#newfolder`). The input binds to the draft item
 * `prepareNewFolder()` creates, which is not part of the selection.
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

const name = tempModelField(() => fm.newFolder, 'name');
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
        <input class="form-control" v-text-model="name" autofocus>
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" :disabled="fm.api.inprocess">{{ t('create') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
