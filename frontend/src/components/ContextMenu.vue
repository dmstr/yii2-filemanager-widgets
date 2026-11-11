<script setup lang="ts">
/**
 * Right-click menu. Port of the legacy `item-context-menu.html` together with
 * the document-level jQuery handlers of the bundle (lines 14-37). Like the
 * legacy code it keeps the element itself out of Vue's hands: the container
 * is shown and hidden through its inline `display` (jQuery `show()`/`hide()`)
 * and positioned absolutely, while the two lists inside toggle with `v-show`
 * (the legacy `ng-show`).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useConfig } from '../config/injection.ts';
import { useI18n } from '../i18n/index.ts';
import { useFileManager } from '../services/fileManager.ts';

const fm = useFileManager();
const config = useConfig();
const { t } = useI18n();

const menu = ref<HTMLElement | null>(null);

/**
 * Visibility of every entry, written as the legacy `ng-show` expressions.
 * Q-29: AngularJS evaluated `singleSelection().isFolder()` on an empty or
 * multiple selection to `undefined`; here the item is checked first and the
 * visible result is the same (`!single.isFolder()` is true for no item).
 * Q-03: the permissions entry needs exactly one item, as the action does.
 */
const show = computed(() => {
  const allowed = config.allowedActions;
  const single = fm.singleSelection();
  const hasDir = !!fm.selectionHas('dir');
  const isFolder = !!single && single.isFolder();
  return {
    open: isFolder,
    select: !!config.pickCallback && !!single && single.isSelectable(),
    download: !!allowed.download && !hasDir && !!single,
    downloadLink: !!allowed.downloadLink && !hasDir && !!single,
    customFile: !!allowed.customFileActions && !!single && !isFolder,
    customDir: !!allowed.customDirActions && !!single && isFolder,
    downloadMultiple: !!allowed.downloadMultiple && !hasDir && !single,
    preview: !!allowed.preview && !!single && single.isImage(),
    rename: !!allowed.rename && !!single && !isFolder,
    move: !!allowed.move && !hasDir && !isFolder,
    copy: !!allowed.copy && !hasDir,
    edit: !!allowed.edit && !!single && single.isEditable(),
    permissions: !!allowed.changePermissions && !!single,
    compress: !!allowed.compress && (!single || hasDir),
    extract: !!allowed.extract && !!single && single.isExtractable(),
  };
});

/** Label to callback pairs of a custom action option; `false` (the default) and anything else non-object yields none. */
const entries = (actions: unknown): Array<[string, unknown]> =>
  actions && typeof actions === 'object' ? Object.entries(actions as Record<string, unknown>) : [];

/** jQuery `.hide()`. */
function hideMenu(): void {
  if (menu.value && menu.value.style.display !== 'none') {
    menu.value.style.display = 'none';
  }
}

/** jQuery `.show()`: drop the inline value, and if the stylesheet still hides the element, show it as a block. */
function showMenu(el: HTMLElement): void {
  el.style.display = '';
  if (window.getComputedStyle(el).display === 'none') {
    el.style.display = 'block';
  }
}

/** jQuery `.width()` of a possibly hidden element: measured while temporarily displayed. */
function measureWidth(el: HTMLElement): number {
  const hidden = window.getComputedStyle(el).display === 'none';
  const saved = { display: el.style.display, visibility: el.style.visibility };
  if (hidden) {
    el.style.display = 'block';
    el.style.visibility = 'hidden';
  }
  const width = el.getBoundingClientRect().width;
  if (hidden) {
    el.style.display = saved.display;
    el.style.visibility = saved.visibility;
  }
  return width;
}

/** jQuery `.offset()`: document coordinates of an element's top left corner. */
function offsetOf(el: Element | null | undefined): { top: number; left: number } {
  if (!el || !el.getClientRects().length) {
    return { top: 0, left: 0 };
  }
  const rect = el.getBoundingClientRect();
  return { top: rect.top + window.pageYOffset, left: rect.left + window.pageXOffset };
}

/**
 * Positions the menu at the click. The coordinates are relative to the
 * grandparent of the menu (the widget's root div), and the menu moves left by
 * its own width when that relative x is within a menu width of the window
 * width. The comparison mixes relative and window coordinates; kept as is.
 */
function placeMenu(pageX: number, pageY: number): void {
  const el = menu.value;
  if (!el) {
    return;
  }
  const width = measureWidth(el);
  const offset = offsetOf(el.parentElement?.parentElement);
  let left = pageX - offset.left;
  if (left >= window.innerWidth - width) {
    left -= width;
  }
  hideMenu();
  el.style.position = 'absolute';
  el.style.left = left + 'px';
  el.style.top = pageY - offset.top + 'px';
  showMenu(el);
}

/**
 * Legacy delegated handler `.main-navigation .table-files tr.item-list:has("td"), .item-list`.
 * The first selector is a subset of the second, so any `.item-list` opens
 * the menu, including a row of the destination dialog. The default action is
 * prevented at once, the placement waits one render so that the list
 * visibility (which the click on the item just changed) is up to date, as it
 * was in the synchronous AngularJS digest.
 */
function onContextMenu(event: MouseEvent): void {
  const target = event.target as Element | null;
  if (!target || !target.closest || !target.closest('.item-list')) {
    return;
  }
  const { pageX, pageY } = event;
  event.preventDefault();
  void nextTick(() => placeMenu(pageX, pageY));
}

onMounted(() => {
  document.addEventListener('click', hideMenu);
  document.addEventListener('contextmenu', onContextMenu);
});
onBeforeUnmount(() => {
  document.removeEventListener('click', hideMenu);
  document.removeEventListener('contextmenu', onContextMenu);
});
</script>

<template>
  <div id="context-menu" ref="menu" class="dropdown clearfix animated fast fadeIn">
    <ul v-show="fm.temps.length" class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu">

      <li v-show="show.open">
        <a href="" tabindex="-1" @click.prevent="fm.smartClick(fm.singleSelection()!)">
          <i class="glyphicon glyphicon-folder-open"></i> {{ t('open') }}
        </a>
      </li>

      <li v-show="show.select">
        <a href="" tabindex="-1" @click.prevent="config.pickCallback && fm.singleSelection() && config.pickCallback(fm.singleSelection()!.model)">
          <i class="glyphicon glyphicon-hand-up"></i> {{ t('select_this') }}
        </a>
      </li>

      <li v-show="show.download">
        <a href="" tabindex="-1" @click.prevent="fm.download()">
          <i class="glyphicon glyphicon-cloud-download"></i> {{ t('download') }}
        </a>
      </li>

      <li v-show="show.downloadLink">
        <a href="" tabindex="-1" @click.prevent="fm.downloadLink()">
          <i class="glyphicon glyphicon-link"></i> {{ t('copy_links') }}
        </a>
      </li>

      <li v-for="[action, callback] in entries(config.allowedActions.customFileActions)" :key="'file-' + action" v-show="show.customFile">
        <a href="" tabindex="-1" @click.prevent="fm.customFileAction(action, callback)">
          <i class="glyphicon glyphicon-link"></i> {{ action }}
        </a>
      </li>

      <li v-for="[action, callback] in entries(config.allowedActions.customDirActions)" :key="'dir-' + action" v-show="show.customDir">
        <a href="" tabindex="-1" @click.prevent="fm.customDirAction(action, callback)">
          <i class="glyphicon glyphicon-link"></i> {{ action }}
        </a>
      </li>

      <li v-show="show.downloadMultiple">
        <a href="" tabindex="-1" @click.prevent="fm.download()">
          <i class="glyphicon glyphicon-cloud-download"></i> {{ t('download_as_zip') }}
        </a>
      </li>

      <li v-show="show.preview">
        <a href="" tabindex="-1" @click.prevent="fm.openImagePreview()">
          <i class="glyphicon glyphicon-picture"></i> {{ t('view_item') }}
        </a>
      </li>

      <li v-show="show.rename">
        <a href="" tabindex="-1" @click.prevent="fm.modal('rename')">
          <i class="glyphicon glyphicon-edit"></i> {{ t('rename') }}
        </a>
      </li>

      <li v-show="show.move">
        <a href="" tabindex="-1" @click.prevent="fm.modalWithPathSelector('move')">
          <i class="glyphicon glyphicon-arrow-right"></i> {{ t('move') }}
        </a>
      </li>

      <li v-show="show.copy">
        <a href="" tabindex="-1" @click.prevent="fm.modalWithPathSelector('copy')">
          <i class="glyphicon glyphicon-log-out"></i> {{ t('copy') }}
        </a>
      </li>

      <li v-show="show.edit">
        <a href="" tabindex="-1" @click.prevent="fm.openEditItem()">
          <i class="glyphicon glyphicon-pencil"></i> {{ t('edit') }}
        </a>
      </li>

      <li v-show="show.permissions">
        <a href="" tabindex="-1" @click.prevent="fm.updatePermissions()">
          <i class="glyphicon glyphicon-lock"></i> {{ t('permissions') }}
        </a>
      </li>

      <li v-show="show.compress">
        <a href="" tabindex="-1" @click.prevent="fm.modal('compress')">
          <i class="glyphicon glyphicon-compressed"></i> {{ t('compress') }}
        </a>
      </li>

      <li v-show="show.extract">
        <a href="" tabindex="-1" @click.prevent="fm.modal('extract')">
          <i class="glyphicon glyphicon-export"></i> {{ t('extract') }}
        </a>
      </li>

      <li v-show="config.allowedActions.remove" class="divider"></li>

      <li v-show="config.allowedActions.remove">
        <a href="" tabindex="-1" @click.prevent="fm.modal('remove')">
          <i class="glyphicon glyphicon-trash"></i> {{ t('remove') }}
        </a>
      </li>

    </ul>

    <ul v-show="!fm.temps.length" class="dropdown-menu dropdown-right-click" role="menu" aria-labelledby="dropdownMenu">
      <li v-show="config.allowedActions.createFolder">
        <a href="" tabindex="-1" @click.prevent="fm.modal('newfolder') && fm.prepareNewFolder()">
          <i class="glyphicon glyphicon-plus"></i> {{ t('new_folder') }}
        </a>
      </li>
      <li v-show="config.allowedActions.upload">
        <a href="" tabindex="-1" @click.prevent="fm.modal('uploadfile')">
          <i class="glyphicon glyphicon-cloud-upload"></i> {{ t('upload_files') }}
        </a>
      </li>
    </ul>
  </div>
</template>
