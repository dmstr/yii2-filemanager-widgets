<script setup lang="ts">
/**
 * One node of the folder tree and, recursively, its children. Port of the
 * AngularJS sidebar branch template.
 */
import { useFileManager } from '../services/fileManager.ts';
import type { TreeNode } from '../services/navigator.ts';
import { strLimit } from '../utils/format.ts';

defineProps<{ node: TreeNode }>();
const fm = useFileManager();
</script>

<template>
  <li :class="{ active: node.name == fm.navigator.currentPath.join('/') }">
    <a href="" class="animated fast fadeInDown" @click.prevent="fm.navigator.folderClick(node.item)">

      <span class="point">
        <i v-show="fm.isInThisPath(node.name)" class="glyphicon glyphicon-chevron-down"></i>
        <i v-show="!fm.isInThisPath(node.name)" class="glyphicon glyphicon-chevron-right"></i>
        <!-- Vue drops the trailing whitespace of an element; the AngularJS markup has it and the icon spacing depends on it -->
        {{ ' ' }}
      </span>

      <i v-show="fm.isInThisPath(node.name)" class="glyphicon glyphicon-folder-open mr2"></i>
      <i v-show="!fm.isInThisPath(node.name)" class="glyphicon glyphicon-folder-close mr2"></i>
      {{ strLimit(node.name.split('/').pop() || '/', 30) }}
    </a>
    <ul class="nav nav-sidebar">
      <SidebarBranch v-for="child in node.nodes" :key="child.name" :node="child" />
    </ul>
  </li>
</template>
