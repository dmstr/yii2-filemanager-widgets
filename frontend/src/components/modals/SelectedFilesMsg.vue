<script setup lang="ts">
/**
 * Port of the legacy `selected-files-msg` partial with its `ng-include`
 * wrapper. Every include had its own scope, so `showDetails` is per instance.
 * Vue drops whitespace-only text at the edges of an element; the `{{ ' ' }}`
 * keep the spaces AngularJS rendered inside the inline elements, which count
 * towards their width (the label of the details link in particular).
 */
import { ref } from 'vue';
import { useI18n } from '../../i18n/index.ts';
import { useFileManager } from '../../services/fileManager.ts';

const fm = useFileManager();
const { t } = useI18n();
const showDetails = ref(false);
</script>

<template>
  <span>
    <span v-show="fm.temps.length == 1">{{ ' ' }}
      <!-- Q-29/Q-39: a selection of one hole renders nothing, as AngularJS did -->
      {{ fm.singleSelection()?.model.name }}{{ ' ' }}</span>
    <span v-show="fm.temps.length > 1">{{ ' ' }}
      {{ t('these_elements', fm.totalSelecteds()) }}
      <a href="" class="label label-primary" @click.prevent="showDetails = !showDetails">{{ ' ' }}
        {{ showDetails ? '-' : '+' }} {{ t('details') }}{{ ' ' }}</a>{{ ' ' }}</span>
    <div v-show="fm.temps.length > 1 && showDetails">
      <ul class="selected-file-details">
        <li v-for="(tempItem, index) in fm.temps" :key="index">
          <!-- Q-39: a hole in the selection renders as an empty entry -->
          <b>{{ tempItem?.model.name }}</b>
        </li>
      </ul>
    </div>
  </span>
</template>
