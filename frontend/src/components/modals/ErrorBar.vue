<script setup lang="ts">
/** Port of the legacy `error-bar` partial with its `ng-include` wrapper: the API error of the open dialog. */
import { useFileManager } from '../../services/fileManager.ts';

const fm = useFileManager();
</script>

<template>
  <div class="clearfix">
    <div v-show="fm.api.error" class="label label-danger error-msg pull-left animated fadeIn">
      <i class="glyphicon glyphicon-remove-circle"></i>
      <span>{{ fm.api.error }}</span>
    </div>
  </div>
</template>
