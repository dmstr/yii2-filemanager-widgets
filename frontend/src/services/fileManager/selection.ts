/**
 * Selection state and the click gestures that change it. Port of the
 * selection half of the AngularJS `FileManagerCtrl`.
 */
import { computed, reactive, ref, type Ref } from 'vue';
import type { FileManagerConfig } from '../../config/types.ts';
import { Item, type RawItem } from '../../models/Item.ts';
import type { Navigator } from '../navigator.ts';

/** The parts of a DOM mouse event the gestures read. */
export interface SelectEvent {
  which?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: EventTarget | null;
}

/** Placeholder item for the multi-selection case; the compress dialog binds its `tempModel.name`. */
export type MultipleItem = Item & { multiple?: boolean };

/**
 * The array may contain `undefined`: a shift-click whose anchor is not in the
 * displayed list walks from index -1 and the AngularJS code pushed that hole
 * into the selection too.
 */
export type SelectedItems = Array<Item | undefined>;

export function createSelection(config: FileManagerConfig, navigator: Navigator, fileList: Ref<Item[]>) {
  const temps = ref<SelectedItems>([]);
  /** Draft of the open "new folder" dialog; kept apart from the selection so opening or cancelling the dialog leaves that untouched. */
  const newFolder = ref<Item | null>(null);

  const singleSelection = (): Item | undefined => (temps.value.length === 1 ? temps.value[0] : undefined);

  /**
   * Replaces the selection. The AngularJS `$watch('temps')` compared by
   * reference, so it fired exactly on replacement and, for a single item,
   * reverted its `tempModel`: input in a dialog is dropped by selecting the
   * item again, but not by a Ctrl-click that only adds to the array.
   */
  function replace(next: SelectedItems): void {
    temps.value = next;
    singleSelection()?.revert();
  }

  /**
   * Q-25: AngularJS `temp` was only refreshed when the selection was replaced; as
   * a computed it follows every change. A fresh placeholder (rights 644,
   * `multiple`) stands in unless exactly one item is selected.
   */
  const temp = computed<Item>(() => {
    const single = singleSelection();
    if (single) {
      return single;
    }
    const placeholder: MultipleItem = reactive(new Item({ rights: 644 } as RawItem, undefined, config));
    placeholder.multiple = true;
    return placeholder;
  });

  const isSelected = (item: Item | undefined): boolean => temps.value.indexOf(item) !== -1;

  /**
   * Click, Ctrl/Cmd-click, Shift-click and right-click logic. An event whose
   * target carries the `prevent` attribute (the free area of the icon views)
   * clears the selection.
   */
  function selectOrUnselect(item: Item | null | undefined, event?: SelectEvent): void {
    const indexInTemp = temps.value.indexOf(item as Item);
    const isRightClick = !!event && event.which == 3;

    if (event && event.target && (event.target as Element).hasAttribute?.('prevent')) {
      replace([]);
      return;
    }
    if (!item || (isRightClick && isSelected(item))) {
      return;
    }
    if (event && event.shiftKey && !isRightClick) {
      const list: Array<Item | undefined> = fileList.value;
      const indexInList = list.indexOf(item);
      const lastSelected = temps.value[0];
      let i = list.indexOf(lastSelected);
      const next: SelectedItems = [];
      if (lastSelected && i < indexInList) {
        while (i <= indexInList) {
          const current = list[i];
          !next.includes(current) && next.push(current);
          i++;
        }
        replace(next);
        return;
      }
      if (lastSelected && i > indexInList) {
        while (i >= indexInList) {
          const current = list[i];
          !next.includes(current) && next.push(current);
          i--;
        }
        replace(next);
        return;
      }
    }
    if (event && !isRightClick && (event.ctrlKey || event.metaKey)) {
      isSelected(item) ? temps.value.splice(indexInTemp, 1) : temps.value.push(item);
      return;
    }
    replace([item]);
  }

  const totalSelecteds = (): { total: number } => ({ total: temps.value.length });

  const selectionHas = (type: string): Item | undefined =>
    temps.value.find((item) => item && item.model.type === type);

  /** Starts a fresh draft for the current path, so a name abandoned in an earlier dialog never reappears. */
  function prepareNewFolder(): Item {
    const item = reactive(new Item(null, navigator.currentPath, config)) as Item;
    newFolder.value = item;
    return item;
  }

  return { temps, newFolder, temp, isSelected, selectOrUnselect, singleSelection, totalSelecteds, selectionHas, prepareNewFolder, replace };
}
