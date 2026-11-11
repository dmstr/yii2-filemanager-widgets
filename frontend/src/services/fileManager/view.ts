/**
 * What the active view shows of the current folder: search text, table sort
 * state, the chosen view template and the resulting list.
 */
import { computed, ref } from 'vue';
import type { FileManagerConfig } from '../../config/types.ts';
import type { Item } from '../../models/Item.ts';
import { initialView, storeView, type ViewName } from '../storage.ts';
import type { Navigator } from '../navigator.ts';
import { filterByName, orderBy } from './collection.ts';

/** AngularJS `order()`: a second click on the same column flips the direction, a new column starts ascending. */
export function createSortState() {
  const reverse = ref(false);
  // The first key is always the type, so folders come before files.
  const predicate = ref(['model.type', 'model.name']);
  function order(column: string): void {
    reverse.value = predicate.value[1] === column ? !reverse.value : false;
    predicate.value[1] = column;
  }
  return { reverse, predicate, order };
}

/** The permissions column's sort key; the table cell shows the same text. */
export const PERMISSIONS_COLUMN = 'permissions';

/** The text of the permissions column, e.g. `drwxr-xr-x`. */
export const permissionsCode = (item: Item): string => item.model.perms.toCode(item.model.type === 'dir' ? 'd' : '-');

/**
 * The permissions live in an object on the item, so that column sorts by an
 * accessor on the displayed text instead of by a property path.
 */
const sortKey = (column: string): string | ((item: Item) => string) =>
  column === PERMISSIONS_COLUMN ? permissionsCode : column;

export function createViewState(config: FileManagerConfig, navigator: Navigator) {
  const query = ref('');
  const sort = createSortState();
  const viewTemplate = ref<ViewName>(initialView(config));

  function setTemplate(name: ViewName): void {
    storeView(name);
    viewTemplate.value = name;
  }

  /**
   * The list every view displays: filtered by name and sorted by type and the
   * chosen column, so switching views never reorders it and a shift-click
   * range means the same in all of them.
   */
  const fileList = computed<Item[]>(() =>
    orderBy(
      filterByName(navigator.fileList, query.value),
      sort.predicate.value.map(sortKey),
      sort.reverse.value,
    ),
  );

  return { query, ...sort, viewTemplate, setTemplate, fileList };
}
