<script setup lang="ts">
/**
 * Port of the AngularJS `path-selector` partial with its `ng-include` wrapper:
 * the selection and the destination of move/copy plus the link that opens
 * the destination dialog on top.
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import SelectedFilesMsg from './SelectedFilesMsg.vue';

const fm = useFileManager();
const { t } = useI18n();
</script>

<template>
  <div class="clearfix">
    <div class="panel panel-primary mt10 mb0">
      <div class="panel-body">
        <div class="detail-sources">
          <div class="like-code mr5"><b>{{ t('selection') }}:</b>
            <SelectedFilesMsg />
          </div>
        </div>
        <div class="detail-sources">
          <div class="like-code mr5">
            <!-- the trailing {{ ' ' }} keeps the space AngularJS rendered inside this inline element -->
            <b>{{ t('destination') }}:</b> {{ fm.getSelectedPath() }}{{ ' ' }}
          </div>
          <!-- Opens the destination dialog at the MAIN navigator's path, as in the AngularJS frontend -->
          <a href="" class="label label-primary" @click.prevent="fm.openNavigator(fm.navigator.currentPath)">
            {{ t('change') }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
