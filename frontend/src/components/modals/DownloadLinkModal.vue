<script setup lang="ts">
/**
 * Link dialog (`#downloadlink`, F-61): path, stream and download link, or one
 * field per custom URL of the item.
 *
 * Legacy: the copy buttons have no `type`, so a click copied and then also
 * submitted the form, which re-ran `downloadLink()`: it rebuilds the same
 * values and clears the dialog error. That stays, because the buttons are
 * typeless here too.
 *
 * The fields bind the `value` attribute, as the legacy `value="{{...}}"`
 * interpolation did, not the property: the browser then keeps the caret at the
 * start of a field that was never edited, so a focused long link shows its
 * beginning, and a field the user edited keeps the edit when the dialog opens again.
 */
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import { copyToClipboard } from './copyToClipboard.ts';

const fm = useFileManager();
const { t } = useI18n();

/** The input next to the clicked button; Q-04: every button copies its own field, not the legacy `#afm-download-link`. */
function copy(event: Event): void {
  const group = (event.currentTarget as HTMLElement).closest('.input-group');
  void copyToClipboard(group?.querySelector('input'));
}
</script>

<template>
  <BaseModal id="downloadlink" v-slot="{ close }">
    <form @submit.prevent="fm.downloadLink()">
      <div class="modal-header">
        <button type="button" class="close" @click="close()">
          <span aria-hidden="true">&times;</span>
          <span class="sr-only">{{ t('close') }}</span>
        </button>
        <h4 class="modal-title">{{ t('copy_links') }}</h4>
      </div>
      <div class="modal-body">

        <label class="radio">{{ t('file_path') }}</label>

        <div class="input-group">
          <input class="form-control" id="filemanager-path-link" :value.attr="fm.path">
          <span class="input-group-btn">
            <button class="btn btn-primary" @click="copy">
              <i class="glyphicon glyphicon-copy"></i>
            </button>
          </span>
        </div>
        <div v-if="fm.showDefaultUrls">
          <label class="radio">{{ t('stream_link') }}</label>

          <div class="input-group">
            <input class="form-control" id="filemanager-stream-link" :value.attr="fm.streamLink">
            <span class="input-group-btn">
              <button class="btn btn-primary" @click="copy">
                <i class="glyphicon glyphicon-copy"></i>
              </button>
            </span>
          </div>

          <label class="radio">{{ t('download_link') }}</label>

          <div class="input-group">
            <input class="form-control" autofocus id="filemanager-download-link" :value.attr="fm.dlLink">
            <span class="input-group-btn">
              <button class="btn btn-primary" @click="copy">
                <i class="glyphicon glyphicon-copy"></i>
              </button>
            </span>
          </div>
        </div>

        <div v-if="fm.showCustomUrls">
          <div v-for="(value, key) in fm.urls" :key="key">
            <label class="radio">{{ t(String(key)) }}</label>
            <div class="input-group">
              <input class="form-control" autofocus :id="`filemanager-${key}-link`" :value.attr="value">
              <span class="input-group-btn">
                <button class="btn btn-primary" @click="copy">
                  <i class="glyphicon glyphicon-copy"></i>
                </button></span>
            </div>
          </div>
        </div>

      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" @click="close()">{{ t('cancel') }}</button>
      </div>
    </form>
  </BaseModal>
</template>
