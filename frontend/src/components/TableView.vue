<script setup lang="ts">
/** Table view of the current folder. Port of the legacy `main-table.html`. */
import { useConfig } from '../config/injection.ts';
import { useI18n } from '../i18n/index.ts';
import { useFileManager } from '../services/fileManager.ts';
import { formatDate, humanReadableFileSize, strLimit } from '../utils/format.ts';
import Spinner from './Spinner.vue';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

const sizeOf = (size: number | null | undefined): string => humanReadableFileSize(size as number, config.useBinarySizePrefixes);
</script>

<template>
  <table class="table mb0 table-files noselect">
    <thead>
      <tr>
        <th>
          <a href="" class="table-th-label" @click.prevent="fm.order('model.name')">
            {{ t('name') }}
            <span v-show="fm.predicate[1] === 'model.name'" class="sortorder" :class="{ reverse: fm.reverse }"></span>
          </a>
        </th>
        <!-- Q-07: hideSize hides only the header cell, never the body cells -->
        <th v-show="!config.hideSize" class="hidden-xs">
          <a href="" @click.prevent="fm.order('model.size')">
            {{ t('size') }}
            <span v-show="fm.predicate[1] === 'model.size'" class="sortorder" :class="{ reverse: fm.reverse }"></span>
          </a>
        </th>
        <th v-show="!config.hideDate" class="hidden-sm hidden-xs">
          <a href="" @click.prevent="fm.order('model.date')">
            {{ t('date') }}
            <span v-show="fm.predicate[1] === 'model.date'" class="sortorder" :class="{ reverse: fm.reverse }"></span>
          </a>
        </th>
        <th v-show="!config.hidePermissions" class="hidden-sm hidden-xs">
          <!-- Q-06: sorts by `model.permissions`, which no item has -->
          <a href="" @click.prevent="fm.order('model.permissions')">
            {{ t('permissions') }}
            <span v-show="fm.predicate[1] === 'model.permissions'" class="sortorder" :class="{ reverse: fm.reverse }"></span>
          </a>
        </th>
      </tr>
    </thead>
    <tbody class="file-item">
      <tr v-show="fm.navigator.requesting">
        <td colspan="5">
          <div>
            <Spinner />
          </div>
        </td>
      </tr>
      <tr v-show="!fm.navigator.requesting && fm.navigator.fileList.length < 1 && !fm.navigator.error">
        <td colspan="5">
          {{ t('no_files_in_folder') }}...
        </td>
      </tr>
      <tr v-show="!fm.navigator.requesting && fm.navigator.error">
        <td colspan="5">
          {{ fm.navigator.error }}
        </td>
      </tr>
      <tr
        v-for="item in fm.fileList"
        :key="item.model.fullPath()"
        v-show="!fm.navigator.requesting"
        class="item-list"
        :class="{ selected: fm.isSelected(item) }"
        @click="fm.selectOrUnselect(item, $event)"
        @dblclick="fm.smartClick(item)"
        @contextmenu.prevent="fm.selectOrUnselect(item, $event)"
      >
        <td>
          <a href="" :title="item.model.name + ' (' + sizeOf(item.model.size) + ')'" @click.prevent>
            <i v-show="item.model.type === 'dir'" class="glyphicon glyphicon-folder-close"></i>
            <i v-show="item.model.type === 'file'" class="glyphicon glyphicon-file"></i>
            {{ strLimit(item.model.name, 64) }}
          </a>
        </td>
        <td class="hidden-xs">
          <span v-show="item.model.type !== 'dir' || config.showSizeForDirectories">
            {{ sizeOf(item.model.size) }}
          </span>
        </td>
        <td v-show="!config.hideDate" class="hidden-sm hidden-xs">
          {{ formatDate(item.model.date) }}
        </td>
        <td v-show="!config.hidePermissions" class="hidden-sm hidden-xs">
          {{ item.model.perms.toCode(item.model.type === 'dir' ? 'd' : '-') }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
