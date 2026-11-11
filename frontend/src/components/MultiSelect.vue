<script lang="ts">
/** One role of the permissions dialog, as `resolvePermissions` returns it in `auth.read|update|delete`. */
export interface MultiSelectItem {
  role: string;
  selected: boolean;
  [key: string]: unknown;
}

/** One entry of the output model: a ticked item reduced to its `role` and `selected` keys. */
export interface MultiSelectOutputItem {
  role?: string;
  selected?: boolean;
}

// The directive's `output-properties="role selected"`.
const OUTPUT_PROPERTIES = ['role', 'selected'];

// AngularJS's ng-repeat writes `$$hashKey = 'object:<uid>'` onto every item it renders,
// from one counter shared by the whole app; the filter later searches that value.
let nextUid = 0;
const hashKeys = new WeakMap<object, string>();
</script>

<script setup lang="ts">
/**
 * Port of the third-party directive `isteven-multi-select` 4.0.0, limited to
 * what the permissions dialog uses (F-64): multiple selection, vertical
 * layout, all four helper elements, the fixed English texts and
 * `button-label`/`item-label` `role`, `tick-property` `selected`,
 * `output-properties` `role selected`. Markup, class names and the order of
 * state changes follow the directive's link function and template, so the
 * existing stylesheet applies unchanged.
 *
 * Like the directive, it ticks the input items in place (`selected`) and
 * writes the ticked items to the output model, which is bound with
 * `v-model:output-model`.
 */
import { onBeforeUnmount, ref, shallowReactive, shallowRef, toRaw, watch, type ComponentPublicInstance } from 'vue';

type ButtonLabel = { kind: 'empty' } | { kind: 'none' } | { kind: 'labels'; labels: string[] };

const props = defineProps<{
  inputModel?: MultiSelectItem[] | null;
  outputModel?: MultiSelectOutputItem[] | null;
}>();

const emit = defineEmits<{ 'update:outputModel': [value: MultiSelectOutputItem[]] }>();

const rootEl = ref<HTMLDivElement>();
const button = ref<HTMLButtonElement>();
const layer = ref<HTMLDivElement>();
const helperContainer = ref<HTMLDivElement>();
const filterInput = ref<HTMLInputElement>();
const checkBoxContainer = ref<HTMLDivElement>();

const filteredModel = shallowRef<MultiSelectItem[]>([]);
const shown = ref(false);
const spanClicked = ref(false);
const buttonLabel = shallowRef<ButtonLabel>({ kind: 'empty' });
// Bumped whenever `selected` is changed in place, so rows re-render even for a non-reactive input array.
const ticks = ref(0);
// Raw items whose row carries `multiSelectFocus`; the directive adds that class by hand.
const focused = shallowReactive(new Set<object>());

// What `$scope.outputModel` holds: the last emitted array, or a value the parent wrote into the binding.
let output: readonly MultiSelectOutputItem[] | null | undefined = props.outputModel;
let lastEmitted: unknown = undefined;
let backUp: Array<{ selected: unknown }> = [];
let labelFilter = '';
let composing = false;
let tabIndex = 0;
let prevTabIndex = 0;
let helperItems: HTMLElement[] = [];
let helperItemsLength = 0;
let formElements: HTMLElement[] = [];
let lastSnapshot = '';
const timers = new Set<ReturnType<typeof setTimeout>>();
// The directive's random `idx_*` and `spc_*` properties, kept off the items.
const indexOf = new WeakMap<object, number>();
const spacingOf = new WeakMap<object, number>();
const rowItem = new WeakMap<Element, object>();

const raw = (item: object): object => toRaw(item);

function hashKeyOf(item: object): string {
  let key = hashKeys.get(raw(item));
  if (key === undefined) {
    key = `object:${++nextUid}`;
    hashKeys.set(raw(item), key);
  }
  return key;
}

/** The directive's `writeLabel`: each label property is prefixed with `&nbsp;`, a falsy role gives no text. */
function writeLabel(item: MultiSelectItem): string {
  return item.role ? ` ${item.role}` : '';
}

function isTicked(item: MultiSelectItem): unknown {
  void ticks.value;
  return item.selected;
}

function rowClass(item: MultiSelectItem): Record<string, boolean> {
  return { selected: !!isTicked(item), vertical: true, multiSelectFocus: focused.has(raw(item)) };
}

function setRow(el: Element | ComponentPublicInstance | null, item: MultiSelectItem): void {
  if (el instanceof Element) rowItem.set(el, raw(item));
}

function later(fn: () => void): void {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, 0);
  timers.add(timer);
}

function emitOutput(value: MultiSelectOutputItem[]): void {
  output = value;
  lastEmitted = value;
  emit('update:outputModel', value);
}

/** Only ticked items (`=== true`), in input order, reduced to `role` and `selected` in the item's own key order. */
function refreshOutputModel(): void {
  const next: MultiSelectOutputItem[] = [];
  for (const value of props.inputModel ?? []) {
    if (value === undefined || value.selected !== true) continue;
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (OUTPUT_PROPERTIES.includes(key)) picked[key] = value[key];
    }
    next.push(picked as MultiSelectOutputItem);
  }
  emitOutput(next);
}

/**
 * Returns false where the directive throws: it reads `outputModel.length`,
 * which fails while the parent holds no array (Q-29: same visible result,
 * the label stays as it was and the rest of the caller is skipped).
 */
function refreshButton(): boolean {
  if (output === undefined || output === null) return false;
  if (output.length === 0) {
    buttonLabel.value = { kind: 'none' };
    return true;
  }
  const labels: string[] = [];
  for (const value of props.inputModel ?? []) {
    if (value !== undefined && value.selected === true) labels.push(writeLabel(value));
  }
  buttonLabel.value = { kind: 'labels', labels };
  return true;
}

/** Any non-boolean value of the item counts, including the hidden index, spacing and `$$hashKey`. */
function matches(item: MultiSelectItem, needle: string): boolean {
  const values: unknown[] = [];
  for (const key in item) values.push(item[key]);
  // The directive's own properties sit on the item in AngularJS; a filter of `0` or `obj` matches every row through them.
  const key = raw(item);
  if (spacingOf.has(key)) values.push(spacingOf.get(key));
  if (indexOf.has(key)) values.push(indexOf.get(key));
  if (hashKeys.has(key)) values.push(hashKeys.get(key));
  return values.some((value) => typeof value !== 'boolean' && String(value).toUpperCase().indexOf(needle) >= 0);
}

/**
 * The directive's `updateFilter`: case-insensitive substring match, collected
 * from the end of the input and reversed back to input order. Returns false
 * where the directive throws, which is for a `null` input model.
 */
function updateFilter(): boolean {
  const input = props.inputModel;
  if (input === undefined || input === null) {
    setFiltered([]);
    return input === undefined;
  }
  const needle = labelFilter.toUpperCase();
  const result: MultiSelectItem[] = [];
  for (let i = input.length - 1; i >= 0; i--) {
    if (matches(input[i], needle)) result.push(input[i]);
  }
  result.reverse();
  setFiltered(result);
  later(getFormElements);
  return true;
}

function setFiltered(list: MultiSelectItem[]): void {
  const kept = new Set(list.map(raw));
  // ng-repeat drops the row element of an item that leaves the list, and with it the hand-set focus class.
  for (const item of [...focused]) if (!kept.has(item)) focused.delete(item);
  for (const item of list) hashKeyOf(item);
  filteredModel.value = list;
}

function prepareGrouping(): void {
  for (const item of filteredModel.value) spacingOf.set(raw(item), 0);
}

function prepareIndex(): void {
  filteredModel.value.forEach((item, i) => indexOf.set(raw(item), i));
}

/** Helper buttons, filter field, clear button and checkboxes, in DOM order, as the keyboard navigation walks them. */
function getFormElements(): void {
  const lines = helperContainer.value?.children;
  if (!lines || !checkBoxContainer.value) return;
  formElements = [
    ...Array.from(lines[0].getElementsByTagName('button')),
    ...Array.from(lines[1].getElementsByTagName('input')),
    ...Array.from(lines[1].getElementsByTagName('button')),
    ...Array.from(checkBoxContainer.value.getElementsByTagName('input')),
  ];
}

function setFilter(value: string): void {
  // ng-model only re-renders the field when the model differs from its last parsed value.
  if (value === labelFilter) return;
  labelFilter = value;
  if (filterInput.value) filterInput.value.value = value;
}

function setShown(value: boolean): void {
  shown.value = value;
  // Applied at once as well, because the filter field must be visible before it can take focus.
  layer.value?.classList.toggle('show', value);
}

function focusRow(index: number, on: boolean): void {
  const row = formElements[index]?.parentElement?.parentElement?.parentElement;
  const item = row?.isConnected ? rowItem.get(row) : undefined;
  if (item === undefined) return;
  if (on) focused.add(item);
  else focused.delete(item);
}

function snapshot(): string {
  return JSON.stringify(props.inputModel ?? null);
}

/** The directive's deep watch on the input model, which runs after every AngularJS event handler. */
function digest(): void {
  const current = snapshot();
  if (current === lastSnapshot) return;
  lastSnapshot = current;
  if (props.inputModel) {
    refreshOutputModel();
    refreshButton();
  }
}

function addDocumentListeners(): void {
  document.addEventListener('click', externalClickListener);
  document.addEventListener('keydown', keyboardListener);
}

function removeDocumentListeners(): void {
  document.removeEventListener('click', externalClickListener);
  document.removeEventListener('keydown', keyboardListener);
}

/** Opens or closes the layer; returns false where the directive throws (opening with a `null` input model). */
function toggleCheckboxes(): boolean {
  removeDocumentListeners();
  if (shown.value) {
    setShown(false);
    // The directive adds and removes `buttonClicked` on the wrapping span, not on the button.
    spanClicked.value = false;
    focusRow(tabIndex, false);
    formElements[tabIndex]?.blur();
    button.value?.focus();
    return true;
  }
  setFilter('');
  if (!updateFilter()) return false;
  helperItems = [];
  helperItemsLength = 0;
  setShown(true);
  spanClicked.value = true;
  addDocumentListeners();
  // Runs before the list re-renders, as in the directive; the timer in updateFilter() catches up.
  getFormElements();
  tabIndex = 0;
  if (helperContainer.value) {
    helperItems = Array.from(helperContainer.value.getElementsByTagName('button'));
    helperItemsLength = helperItems.length + helperContainer.value.getElementsByTagName('input').length;
  }
  filterInput.value?.focus();
  tabIndex = tabIndex + helperItemsLength - 2;
  return true;
}

function onButtonClick(): void {
  // ng-click="toggleCheckboxes(); refreshSelectedItems(); refreshButton(); prepareGrouping; prepareIndex();"
  // refreshSelectedItems does not exist and prepareGrouping is not called, so both do nothing.
  if (toggleCheckboxes() && refreshButton()) prepareIndex();
  digest();
}

function externalClickListener(e: Event): void {
  const host = rootEl.value;
  const target = e.target as Node | null;
  if (host && target && target !== host && host.contains(target)) return;
  // The directive removes `buttonClicked` from the button here, which never has it; the span keeps it
  // until the next close through the button. The focus class on rows is left as it is.
  setShown(false);
  removeDocumentListeners();
  button.value?.focus();
}

function select(type: 'all' | 'none' | 'reset' | 'clear' | 'filter', e: Event): void {
  tabIndex = helperItems.indexOf(e.target as HTMLElement);
  switch (type) {
    case 'all':
    case 'none':
      for (const value of filteredModel.value) value.selected = type === 'all';
      ticks.value++;
      refreshOutputModel();
      refreshButton();
      break;
    case 'reset':
      for (const value of filteredModel.value) {
        const index = indexOf.get(raw(value));
        const saved = index === undefined ? undefined : backUp[index];
        // The directive throws on an item it never indexed; the items before it are already reset.
        if (saved === undefined) {
          ticks.value++;
          return;
        }
        value.selected = saved.selected as boolean;
      }
      ticks.value++;
      refreshOutputModel();
      refreshButton();
      break;
    case 'clear':
      tabIndex = tabIndex + 1;
      break;
    case 'filter':
      tabIndex = helperItems.length - 1;
      break;
  }
}

function onHelperClick(type: 'all' | 'none' | 'reset', e: Event): void {
  select(type, e);
  digest();
}

function onClearClick(e: Event): void {
  setFilter('');
  if (updateFilter()) select('clear', e);
  digest();
}

function onFilterClick(e: Event): void {
  select('filter', e);
  digest();
}

function onFilterInput(e: Event): void {
  if (composing) return;
  // ng-model trims the value and fires ng-change only when the trimmed value changed.
  const value = (e.target as HTMLInputElement).value.trim();
  if (value === labelFilter) return;
  labelFilter = value;
  updateFilter();
  digest();
}

function onCompositionEnd(e: Event): void {
  composing = false;
  onFilterInput(e);
}

/** The directive's `syncItems`, bound to the row and to its checkbox. */
function onItemClick(item: MultiSelectItem, e: MouseEvent, index: number): void {
  e.preventDefault();
  e.stopPropagation();
  syncItems(item, e, index);
  digest();
}

function syncItems(item: MultiSelectItem, e: MouseEvent, index: number): void {
  const target = filteredModel.value.find((value) => raw(value) === raw(item));
  if (target === undefined) return;
  target.selected = !target.selected;
  ticks.value++;
  const input = props.inputModel;
  const inputIndex = indexOf.get(raw(target));
  // The directive writes the tick back through the item's stored index and throws when there is none.
  if (!input || inputIndex === undefined || !input[inputIndex]) return;
  input[inputIndex].selected = target.selected;
  refreshOutputModel();
  refreshButton();
  prevTabIndex = tabIndex;
  tabIndex = index + helperItemsLength;
  (e.target as HTMLElement).focus();
  focusRow(prevTabIndex, false);
  focusRow(tabIndex, true);
}

function onItemMouseLeave(): void {
  // Removes the focus class of the element at the current tab index, whichever row the pointer left.
  focusRow(tabIndex, false);
  digest();
}

/** Escape closes; arrows and Tab move through `formElements`. Space and Enter are left to the browser. */
function keyboardListener(e: KeyboardEvent): void {
  const key = e.keyCode ? e.keyCode : e.which;
  if (key === 27) {
    e.preventDefault();
    e.stopPropagation();
    toggleCheckboxes();
    return;
  }
  const last = formElements.length - 1;
  if (key === 40 || key === 39 || (!e.shiftKey && key === 9)) {
    prevTabIndex = tabIndex;
    tabIndex++;
    if (tabIndex > last) {
      tabIndex = 0;
      prevTabIndex = last;
    }
  } else if (key === 38 || key === 37 || (e.shiftKey && key === 9)) {
    prevTabIndex = tabIndex;
    tabIndex--;
    if (tabIndex < 0) {
      tabIndex = last;
      prevTabIndex = 0;
    }
  } else {
    return;
  }
  // The directive skips disabled elements here; nothing is ever disabled in this usage.
  // It throws (before preventDefault) when the index points past a list that shrank under a filter.
  const next = formElements[tabIndex];
  if (next === undefined) return;
  e.preventDefault();
  next.focus();
  const active = document.activeElement as HTMLInputElement | null;
  if (typeof active?.type !== 'string') return;
  if (active.type.toUpperCase() === 'CHECKBOX') {
    focusRow(tabIndex, true);
    focusRow(prevTabIndex, false);
  } else {
    focusRow(prevTabIndex, false);
    focusRow(helperItemsLength, false);
    focusRow(formElements.length - 1, false);
  }
}

let firstRun = true;
watch(
  [() => props.inputModel, () => props.outputModel],
  ([input, out], previous) => {
    const initial = firstRun;
    firstRun = false;
    // Two-way binding: a value the parent wrote replaces the directive's output model.
    if (!initial && out !== previous[1] && toRaw(out) !== toRaw(lastEmitted)) output = out;
    if (!initial && input === previous[0]) return;
    lastSnapshot = snapshot();
    if (!input) return;
    // The directive's reference watch: new backup for Reset, then filter, index and both outputs.
    backUp = input.map((item) => ({ selected: item.selected }));
    updateFilter();
    prepareGrouping();
    prepareIndex();
    refreshOutputModel();
    refreshButton();
  },
  { immediate: true },
);

// Picks up `selected` flags the parent changes on a reactive input model.
watch(() => props.inputModel, digest, { deep: true });

onBeforeUnmount(() => {
  removeDocumentListeners();
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
});
</script>

<template>
  <div ref="rootEl">
    <span class="multiSelect inlineBlock" :class="{ buttonClicked: spanClicked }">
      <button ref="button" id="" type="button" @click="onButtonClick"><template v-if="buttonLabel.kind === 'none'">None Selected<span class="caret"></span></template><template v-else-if="buttonLabel.kind === 'labels'"><template v-for="(text, i) in buttonLabel.labels" :key="i"><template v-if="i > 0">, </template><div class="buttonLabel">{{ text }}<span v-if="i === buttonLabel.labels.length - 1" class="caret"></span></div></template><span v-if="buttonLabel.labels.length === 0" class="caret"></span></template></button>
      <div ref="layer" class="checkboxLayer" :class="{ show: shown }">
        <div ref="helperContainer" class="helperContainer">
          <!-- No whitespace between the helper buttons: the directive's template had only comments there, and a space shifts them -->
          <div class="line"><button type="button" class="helperButton" @click="onHelperClick('all', $event)">&#10003;&nbsp;&nbsp;Select All</button><button type="button" class="helperButton" @click="onHelperClick('none', $event)">&times;&nbsp;&nbsp;Select None</button><button type="button" class="helperButton reset" @click="onHelperClick('reset', $event)">&#8630;&nbsp;&nbsp;Reset</button></div>
          <div class="line" style="position: relative">
            <input
              ref="filterInput"
              placeholder="Search..."
              type="text"
              class="inputFilter"
              @click="onFilterClick"
              @input="onFilterInput"
              @compositionstart="composing = true"
              @compositionend="onCompositionEnd"
            />
            <button type="button" class="clearButton" @click="onClearClick">&times;</button>
          </div>
        </div>
        <div ref="checkBoxContainer" class="checkBoxContainer">
          <div
            v-for="(item, index) in filteredModel"
            :key="hashKeyOf(item)"
            :ref="(el) => setRow(el, item)"
            class="multiSelectItem"
            :class="rowClass(item)"
            @click="onItemClick(item, $event, index)"
            @mouseleave="onItemMouseLeave"
          >
            <div class="acol">
              <label>
                <input class="checkbox focusable" type="checkbox" :checked="!!isTicked(item)" @click="onItemClick(item, $event, index)" />
                <span>{{ writeLabel(item) }}</span>
              </label>
            </div>
            <span v-if="isTicked(item) === true" class="tickMark">&#10003;</span>
          </div>
        </div>
      </div>
    </span>
  </div>
</template>
