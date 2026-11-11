<script setup lang="ts">
/**
 * Destination folder dialog (AngularJS `#selector`). It has its own
 * navigator and opens on top of the move or copy dialog (Q-32).
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import Breadcrumb from '../Breadcrumb.vue';
import BaseModal from './BaseModal.vue';
import SelectorTable from './SelectorTable.vue';

const fm = useFileManager();
const { t } = useI18n();
</script>

<template>
  <BaseModal id="selector" v-slot="{ close }">
    <div class="modal-header">
      <button type="button" class="close" @click="close">
        <span aria-hidden="true">&times;</span>
        <span class="sr-only">{{ t('close') }}</span>
      </button>
      <h4 class="modal-title">{{ t('select_destination_folder') }}</h4>
    </div>
    <div class="modal-body">
      <div>
        <div><Breadcrumb :navigator="fm.selector.navigator" /></div>
        <div><SelectorTable /></div>
        <hr />
        <button class="btn btn-sm btn-default" @click="fm.selectCurrent()">
          <i class="glyphicon"></i> {{ t('select_this') }}
        </button>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close">{{ t('close') }}</button>
    </div>
  </BaseModal>
</template>
