<script setup lang="ts">
/**
 * Edit dialog (`#edit`, F-57): large modal with a fullscreen toggle. The
 * toggle is local state, as `fullscreen` lived on the legacy scope and
 * nothing else read it.
 */
import { ref } from 'vue';
import { useConfig } from '../../config/injection.ts';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { tempModelField, vTextModel } from '../modelTrim.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

const fullscreen = ref(false);

/**
 * `ng-model="singleSelection().tempModel.content"`: a textarea is trimmed like
 * a text input (`ngTrim`), so leading and trailing whitespace never reaches
 * the model (Q-29 without a single selection).
 */
const content = tempModelField(() => fm.singleSelection(), 'content');
</script>

<template>
  <BaseModal id="edit" size="lg" :class="{ 'modal-fullscreen': fullscreen }" v-slot="{ close }">
    <form @submit.prevent="fm.edit()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <button type="button" class="close fullscreen" @click="fullscreen = !fullscreen">
          <i class="glyphicon glyphicon-fullscreen"></i>
          <span class="sr-only">{{ t('toggle_fullscreen') }}</span>
        </button>
        <h4 class="modal-title">{{ t('edit_file') }}</h4>
      </div>
      <div class="modal-body">
        <label class="radio bold">{{ fm.singleSelection()?.model.fullPath() ?? '' }}</label>
        <span class="label label-warning" v-show="fm.api.inprocess">{{ t('loading') }} ...</span>
        <textarea class="form-control code" v-text-model="content" v-show="!fm.api.inprocess" autofocus></textarea>
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('close') }}</button>
        <button type="submit" class="btn btn-primary" v-show="config.allowedActions.edit" :disabled="fm.api.inprocess">{{ t('edit') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
