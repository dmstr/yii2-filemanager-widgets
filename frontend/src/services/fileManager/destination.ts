/**
 * State of the destination dialog used by move, copy, compress and extract:
 * its own navigator and sort state plus the chosen target path. Port of the
 * legacy `ModalFileManagerCtrl` and of the `$rootScope` values it shared.
 */
import { computed, ref } from 'vue';
import type { Item } from '../../models/Item.ts';
import type { Navigator } from '../navigator.ts';
import { orderBy } from './collection.ts';
import { createSortState } from './view.ts';
import type { createSelection } from './selection.ts';

interface Deps {
  navigator: Navigator;
  selectorNavigator: Navigator;
  selection: ReturnType<typeof createSelection>;
  modal: (id: string, hide?: boolean) => true;
}

export function createDestination({ navigator, selectorNavigator, selection, modal }: Deps) {
  const sort = createSortState();
  // Legacy `$rootScope.selectedModalPath`; a path array, `[]` is the root.
  const selectedModalPath = ref<string[]>([]);

  /** The folder list of the dialog, sorted by its own state. The template shows the folders among them. */
  const fileList = computed<Item[]>(() => orderBy(selectorNavigator.fileList, sort.predicate.value, sort.reverse.value));

  /** Picks a folder row. The leading empty element of `split('/')` stays, so the request path starts with `//`. */
  function select(item: Item): void {
    selectedModalPath.value = item.model.fullPath().split('/');
    modal('selector', true);
  }

  function selectCurrent(): void {
    selectedModalPath.value = selectorNavigator.currentPath;
    modal('selector', true);
  }

  /** Hides folders that are part of the selection, so they cannot be picked as their own destination. */
  function selectedFilesAreChildOfPath(item: Item): boolean {
    const path = item.model.fullPath();
    return selection.temps.value.some((selected) => !!selected && path == selected.model.fullPath());
  }

  /** Opens the dialog on top of the move/copy dialog (Q-32) at `path`. */
  function openNavigator(path: string[]): void {
    selectorNavigator.currentPath = path;
    selectorNavigator.refresh();
    modal('selector');
  }

  /** The target as shown in the path selector; a single file gets its (edited) name appended. */
  function getSelectedPath(): string {
    const path = selectedModalPath.value.filter(Boolean);
    let result = '/' + path.join('/');
    const single = selection.singleSelection();
    if (single && !single.isFolder()) {
      result += '/' + single.tempModel.name;
    }
    return result.replace(/\/\//, '/');
  }

  function modalWithPathSelector(id: string): true {
    selectedModalPath.value = navigator.currentPath;
    return modal(id);
  }

  /** Legacy `validateSamePath`: does the item live in the chosen destination? */
  function validateSamePath(item: Item | undefined): boolean {
    const selectedPath = selectedModalPath.value.join('');
    const selectedItemsPath = item && item.model.path.join('');
    return selectedItemsPath === selectedPath;
  }

  const isInThisPath = (path: string): boolean => navigator.currentPath.join('/').indexOf(path) !== -1;

  return {
    navigator: selectorNavigator,
    predicate: sort.predicate,
    reverse: sort.reverse,
    order: sort.order,
    fileList,
    selectedModalPath,
    select,
    selectCurrent,
    selectedFilesAreChildOfPath,
    openNavigator,
    getSelectedPath,
    modalWithPathSelector,
    validateSamePath,
    isInThisPath,
  };
}
