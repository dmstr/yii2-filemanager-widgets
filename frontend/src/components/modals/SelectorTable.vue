<script setup lang="ts">
/**
 * Folder table of the destination dialog. Port of the legacy
 * `main-table-modal.html`, bound to the dialog's own navigator and sort state.
 */
import { useConfig } from '../../config/injection.ts';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { humanReadableFileSize, strLimit } from '../../utils/format.ts';
import Spinner from '../Spinner.vue';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();
const selector = fm.selector;

const sizeOf = (size: number | null | undefined): string => humanReadableFileSize(size as number, config.useBinarySizePrefixes);
</script>

<template>
  <table class="table table-condensed table-modal-condensed mb0">
    <thead>
      <tr>
        <th>
          <a href="" class="table-th-label" @click.prevent="selector.order('model.name')">
            {{ t('name') }}
            <span v-show="selector.predicate[1] === 'model.name'" class="sortorder" :class="{ reverse: selector.reverse }"></span>
          </a>
        </th>
        <th class="text-right"></th>
      </tr>
    </thead>
    <tbody class="file-item">
      <tr v-show="selector.navigator.requesting">
        <td colspan="2">
          <div><Spinner /></div>
        </td>
      </tr>
      <tr v-show="!selector.navigator.requesting && !selector.navigator.listHasFolders() && !selector.navigator.error">
        <td>
          {{ t('no_folders_in_folder') }}...
        </td>
        <td class="text-right">
          <button class="btn btn-sm btn-default" @click="selector.navigator.upDir()">{{ t('go_back') }}</button>
        </td>
      </tr>
      <tr v-show="!selector.navigator.requesting && selector.navigator.error">
        <td colspan="2">
          {{ selector.navigator.error }}
        </td>
      </tr>
      <template v-for="item in selector.fileList" :key="item.model.fullPath()">
        <!-- Rows exist for every item but show only folders; folders of the selection are removed (ng-if) -->
        <tr v-if="!fm.selectedFilesAreChildOfPath(item)" v-show="!selector.navigator.requesting && item.model.type === 'dir'">
          <td>
            <a href="" :title="`${item.model.name} (${sizeOf(item.model.size)})`" @click.prevent="selector.navigator.folderClick(item)">
              <i class="glyphicon glyphicon-folder-close"></i>
              {{ strLimit(item.model.name, 32) }}
            </a>
          </td>
          <td class="text-right">
            <button class="btn btn-sm btn-default" @click="fm.select(item)">
              <i class="glyphicon glyphicon-hand-up"></i> {{ t('select_this') }}
            </button>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
