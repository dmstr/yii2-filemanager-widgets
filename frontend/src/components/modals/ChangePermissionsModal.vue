<script setup lang="ts">
/**
 * Permissions dialog (`#changepermissions`, F-60): one role multi-select each
 * for read, write and delete. The submit button is never disabled and keeps
 * the id `submit`, as in legacy.
 */
import { computed, type WritableComputedRef } from 'vue';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import MultiSelect, { type MultiSelectItem, type MultiSelectOutputItem } from '../MultiSelect.vue';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();

type RoleKey = 'authRead' | 'authUpdate' | 'authDelete';

/**
 * Output model of one section. Q-29: without a single selection AngularJS
 * bound `undefined` and could not assign through the missing base, so the
 * write is dropped. The input model is passed straight from the model in the
 * template, because a copied array would count as a new input model.
 */
function outputModel(key: RoleKey): WritableComputedRef<MultiSelectOutputItem[] | null | undefined> {
  return computed({
    get: () => fm.singleSelection()?.tempModel[key],
    set: (value) => {
      const item = fm.singleSelection();
      if (item) {
        item.tempModel[key] = value as typeof item.tempModel.authRead;
      }
    },
  });
}

/** The model's own role array, never a copy (a new reference counts as a new input model). */
const inputModel = (key: RoleKey): MultiSelectItem[] | null | undefined =>
  fm.singleSelection()?.model[key] as MultiSelectItem[] | null | undefined;

const authRead = outputModel('authRead');
const authUpdate = outputModel('authUpdate');
const authDelete = outputModel('authDelete');
</script>

<template>
  <BaseModal id="changepermissions" v-slot="{ close }">
    <form @submit.prevent="fm.changePermissions()">
      <input type="hidden">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('change_permissions') }}</h4>
      </div>
      <div class="modal-body">
        <div class="row">
          <div class="col-xs-12">
            <h4>{{ t('read') }}</h4>
            <MultiSelect class="permission-multi-select-button" :input-model="inputModel('authRead')" v-model:output-model="authRead" />
          </div>
        </div>
        <hr>
        <div class="row">
          <div class="col-xs-12">
            <h4>{{ t('write') }}</h4>

            <MultiSelect class="permission-multi-select-button" :input-model="inputModel('authUpdate')" v-model:output-model="authUpdate" />
          </div>
        </div>
        <hr>
        <div class="row">
          <div class="col-xs-12">
            <h4>{{ t('delete') }}</h4>
            <MultiSelect class="permission-multi-select-button" :input-model="inputModel('authDelete')" v-model:output-model="authDelete" />
          </div>
        </div>
        <hr>
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" @click="close()">{{ t('cancel') }}</button>
        <button type="submit" class="btn btn-primary" id="submit">{{ t('change') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
