<script setup lang="ts">
/**
 * Image preview dialog (`#imagepreview`). Port of the AngularJS modal
 * markup; the image source and the loading flag come from the file manager
 * state instead of the jQuery calls of `openImagePreview`.
 */
import { nextTick, ref, watch } from 'vue';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';
import BaseModal from './BaseModal.vue';
import ErrorBar from './ErrorBar.vue';

const fm = useFileManager();
const { t } = useI18n();
const target = ref<HTMLImageElement | null>(null);

/**
 * AngularJS `.attr('src', url)` made the browser load (and fire `load`) even
 * when the url had not changed, which is what clears the loading flag when
 * the same image is opened twice. A bound `src` that stays the same does
 * nothing, so the source is assigned again when the dialog opens over an
 * image that has already finished loading.
 */
watch(
  () => fm.modals.isOpen('imagepreview'),
  async (open) => {
    if (!open) {
      return;
    }
    await nextTick();
    const img = target.value;
    const src = img?.getAttribute('src');
    if (img && src && fm.api.inprocess && img.complete) {
      img.setAttribute('src', src);
    }
  },
);
</script>

<template>
  <BaseModal id="imagepreview" v-slot="{ close }">
    <div class="modal-header">
      <button type="button" class="close" @click="close()">
        <span aria-hidden="true">&times;</span>
        <span class="sr-only">{{ t('close') }}</span>
      </button>
      <h4 class="modal-title">{{ t('preview') }}</h4>
    </div>
    <div class="modal-body">
      <div class="text-center">

        <!-- Q-29: with no or several items selected AngularJS rendered an empty alt -->
        <img
          id="imagepreview-target"
          ref="target"
          class="preview"
          :alt="fm.singleSelection()?.model.name ?? ''"
          :src="fm.previewUrl || undefined"
          :class="{ loading: fm.api.inprocess }"
          @load="fm.imageLoaded()"
          @error="fm.imageLoaded()"
        >
        <span v-show="fm.api.inprocess" class="label label-warning">{{ t('loading') }} ...</span>
      </div>
      <ErrorBar />
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-default" :disabled="fm.api.inprocess" @click="close()">{{ t('close') }}</button>
    </div>
  </BaseModal>
</template>
