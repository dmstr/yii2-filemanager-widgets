<script setup lang="ts">
/** Icon view with image thumbnails. Port of the legacy `main-icons-preview.html`. */
import { useConfig } from '../config/injection.ts';
import { useI18n } from '../i18n/index.ts';
import { useFileManager } from '../services/fileManager.ts';
import { fileExtension, strLimit } from '../utils/format.ts';
import Spinner from './Spinner.vue';
import { useFileSize } from './useFileSize.ts';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

const sizeOf = useFileSize();
</script>

<template>
  <div class="iconset noselect">
    <!-- F-23: a click or right-click on the free area (target carries `prevent`) clears the selection -->
    <div class="item-list clearfix" prevent="true" @click="fm.selectOrUnselect(null, $event)" @contextmenu.prevent="fm.selectOrUnselect(null, $event)">
      <div v-for="item in fm.fileList" :key="item.model.fullPath()" v-show="!fm.navigator.requesting && !fm.navigator.error" class="col-120 preview">
        <a
          href=""
          class="thumbnail text-center"
          :class="{ selected: fm.isSelected(item) }"
          :title="item.model.name + ' (' + sizeOf(item.model.size) + ')'"
          @click.prevent="fm.selectOrUnselect(item, $event)"
          @dblclick="fm.smartClick(item)"
          @contextmenu.prevent="fm.selectOrUnselect(item, $event)"
        >
          <div class="item-icon">
            <i v-show="item.model.type === 'dir'" class="glyphicon glyphicon-folder-open"></i>
            <div
              v-if="item.model.type === 'file' && item.isImage() && config.enableThumbnails && item.model.thumbnail !== ''"
              class="image-preview-thumbnail"
            >
              <img :src="item.model.thumbnail" :alt="item.model.name" loading="lazy" />
            </div>
            <!-- Q-08: an image with thumbnails on but an empty `thumbnail` gets no icon at all -->
            <i
              v-if="!config.enableThumbnails && item.model.type === 'file' && item.isImage()"
              class="glyphicon glyphicon-picture"
              :class="{ 'item-extension': config.showExtensionIcons }"
              :data-ext="fileExtension(item.model.name)"
            ></i>
            <i
              v-show="item.model.type === 'file' && !item.isImage()"
              class="glyphicon glyphicon-file"
              :class="{ 'item-extension': config.showExtensionIcons }"
              :data-ext="fileExtension(item.model.name)"
            ></i>
          </div>
          <div class="item-name">
            {{ strLimit(item.model.name, 11) }}
          </div>
        </a>
      </div>
    </div>

    <div v-show="fm.navigator.requesting">
      <div>
        <Spinner />
      </div>
    </div>

    <div v-show="!fm.navigator.requesting && fm.navigator.fileList.length < 1 && !fm.navigator.error" class="alert alert-warning">
      {{ t('no_files_in_folder') }}...
    </div>

    <div v-show="!fm.navigator.requesting && fm.navigator.error" class="alert alert-danger">
      {{ fm.navigator.error }}
    </div>
  </div>
</template>
