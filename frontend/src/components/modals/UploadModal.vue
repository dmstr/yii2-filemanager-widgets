<script setup lang="ts">
/**
 * Upload dialog (`#uploadfile`). Port of the AngularJS modal markup with
 * `ngf-select` replaced by a hidden file input.
 *
 * ng-file-upload put that input into a hidden `<label>` appended to
 * `document.body`, not into the dialog; it is teleported there as well so the
 * dialog's own markup stays identical to AngularJS.
 */
import { ref } from 'vue';
import { useConfig } from '../../config/injection.ts';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import { humanReadableFileSize } from '../../utils/format.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement>();
// ng-file-upload kept the picked files in its input until the next click.
let hasPick = false;

/**
 * Click on the select button. The directive's click handler returned false,
 * which jQuery turns into preventDefault, so the button never submits the
 * form (hence `.prevent` in the template). Like the directive, a click after
 * a pick first reset the input and reported an empty file list, and with it
 * `addForUpload` cleared the dialog error.
 */
function openPicker(): void {
  if (hasPick) {
    hasPick = false;
    fm.addForUpload([]);
  }
  fileInput.value?.click();
}

/** Every `change` is reported, an emptied selection as an empty list; the input is reset so the same file can be chosen again. */
function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  hasPick = files.length > 0;
  fm.addForUpload(files);
}

/**
 * Rows are keyed by the file, as `ng-repeat` tracked them by object: removing
 * an entry removes its own row, button and focus with it (the focus falls back
 * to the body), instead of reusing the first row for the next file.
 */
const rowKeys = new WeakMap<File, number>();
let nextRowKey = 0;
function rowKey(file: File): number {
  let key = rowKeys.get(file);
  if (key === undefined) {
    key = nextRowKey++;
    rowKeys.set(file, key);
  }
  return key;
}

// The remove button's implicit submit never fired in the AngularJS frontend, because the click
// removed the button before the event reached the form; hence `.prevent`.
</script>

<template>
  <BaseModal id="uploadfile" v-slot="{ close }">
    <form @submit.prevent="fm.uploadFiles()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('upload_files') }}</h4>
      </div>
      <div class="modal-body">
        <label class="radio">
          {{ t('files_will_uploaded_to') }}
          <b>/{{ fm.navigator.currentPath.join('/') }}</b>
        </label>
        <button class="btn btn-default btn-block" @click.prevent="openPicker">
          {{ t('select_files') }}
        </button>

        <div class="upload-list">
          <ul class="list-group">
            <li class="list-group-item" v-for="(uploadFile, index) in fm.uploadFileList" :key="rowKey(uploadFile)">
              <button class="btn btn-sm btn-danger pull-right" @click.prevent="fm.removeFromUpload(index)">
                  &times;
              </button>
              <h5 class="list-group-item-heading">{{ uploadFile.name }}</h5>
              <p class="list-group-item-text">{{ humanReadableFileSize(uploadFile.size, config.useBinarySizePrefixes) }}</p>
            </li>
          </ul>
          <div v-show="fm.api.inprocess">
            <em>{{ t('uploading') }}... {{ fm.api.progress }}%</em>
            <div class="progress mb0">
              <div class="progress-bar active" role="progressbar" :aria-valuenow="fm.api.progress ?? ''" aria-valuemin="0" aria-valuemax="100" :style="`width: ${fm.api.progress ?? ''}%`"></div>
            </div>
          </div>
        </div>
        <ErrorBar />
      </div>
      <div class="modal-footer">
        <div>
          <button type="button" class="btn btn-default" @click="close()">{{ t('cancel') }}</button>
          <button type="submit" class="btn btn-primary" :disabled="!fm.uploadFileList.length || fm.api.inprocess">{{ t('upload') }}</button>
        </div>
      </div>
    </form>
    <Teleport to="body">
      <label style="visibility: hidden; position: absolute; overflow: hidden; width: 0; height: 0; border: none; margin: 0; padding: 0" tabindex="-1">upload<input ref="fileInput" type="file" multiple @change="onChange"></label>
    </Teleport>
  </BaseModal>
</template>
