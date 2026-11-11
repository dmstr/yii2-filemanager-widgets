<script setup lang="ts">
/**
 * Path of a navigator as a Bootstrap breadcrumb. The navigator comes in as a
 * prop because the destination dialog shows the same breadcrumb for its own
 * navigator. Whether it is shown at all (`config.breadcrumb`) is decided by
 * the parent, as in the legacy navbar.
 */
import { useConfig } from '../config/injection.ts';
import type { Navigator } from '../services/navigator.ts';
import { strLimit } from '../utils/format.ts';

defineProps<{ navigator: Navigator }>();
const config = useConfig();
</script>

<template>
  <ol class="breadcrumb">
    <li>
      <a href="" @click.prevent="navigator.goTo(-1)">
        {{ config.appName }}
      </a>
    </li>
    <li
      v-for="(dir, key) in navigator.currentPath"
      :key="key"
      :class="{ active: key === navigator.currentPath.length - 1 }"
      class="animated fast fadeIn"
    >
      <!-- Vue drops the leading whitespace of an element; here it renders as the gap after the separator -->
      {{ ' ' }}
      <a v-show="key !== navigator.currentPath.length - 1" href="" @click.prevent="navigator.goTo(key)">
        {{ strLimit(dir, 8) }}
      </a>
      <span v-show="key === navigator.currentPath.length - 1">
        {{ strLimit(dir, 12) }}
      </span>
    </li>
  </ol>
</template>
