<script setup lang="ts">
/** Folder tree of the visited folders. Port of the legacy `sidebar.html`. */
import { useFileManager } from '../services/fileManager.ts';
import SidebarBranch from './SidebarBranch.vue';

const fm = useFileManager();
</script>

<template>
  <ul class="nav nav-sidebar file-tree-root">
    <SidebarBranch v-for="node in fm.navigator.history" :key="node.name" :node="node" />
  </ul>
</template>
