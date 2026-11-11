<script lang="ts">
/**
 * State that Bootstrap kept per document rather than per dialog: the one
 * `focusin.bs.modal` handler on `document` and the `resize.bs.modal` handlers
 * on `window` (any hide removes all of them). Also the shown dialogs in the
 * order they were shown, for Escape, and the page state: `modal-open` and the
 * scrollbar compensation are applied when the first dialog shows and undone
 * when the last one hides, restoring the inline `padding-right` of `body` and
 * of the fixed navbars from before. Bootstrap did both per dialog, which
 * broke with stacked dialogs: the page scrolled again behind the lower one,
 * or the padding stayed and grew.
 */
let focusinHandler: ((event: FocusEvent) => void) | null = null;
const resizeHandlers = new Set<() => void>();
const fixedPadding = new Map<HTMLElement, string>();
let openCount = 0;
let baselineBodyPad = '';

interface ShownDialog {
  el: HTMLElement;
  /** Whether the dialog is the topmost open one of its file manager. */
  isTop(): boolean;
  close(): void;
}
const shownDialogs: ShownDialog[] = [];

const FIXED_CONTENT = '.navbar-fixed-top, .navbar-fixed-bottom';

/**
 * Escape closes the topmost dialog wherever the focus is: dialogs without a
 * focusable field leave it on the page, and in the stacked state it may sit
 * in the lower dialog. The capture phase on `window` runs before any handler
 * that could stop the event. An open role list (MultiSelect) closes itself
 * through its own `keydown` handler on `document`, which still runs, so the
 * dialog stays open for that key. The last shown dialog wins should several
 * widgets on a page each have one open.
 */
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' && event.keyCode !== 27) return;
  for (let i = shownDialogs.length - 1; i >= 0; i--) {
    const dialog = shownDialogs[i];
    if (dialog.isTop()) {
      if (!dialog.el.querySelector('.checkboxLayer.show')) {
        dialog.close();
      }
      return;
    }
  }
}

function addShownDialog(dialog: ShownDialog): void {
  if (shownDialogs.length === 0) {
    window.addEventListener('keydown', onEscape, true);
  }
  shownDialogs.push(dialog);
}

function removeShownDialog(el: HTMLElement): void {
  const index = shownDialogs.findIndex((dialog) => dialog.el === el);
  if (index === -1) return;
  shownDialogs.splice(index, 1);
  if (shownDialogs.length === 0) {
    window.removeEventListener('keydown', onEscape, true);
  }
}

function onWindowResize(): void {
  resizeHandlers.forEach((handler) => handler());
}

function addResizeHandler(handler: () => void): void {
  if (resizeHandlers.size === 0) {
    window.addEventListener('resize', onWindowResize);
  }
  resizeHandlers.add(handler);
}

/** `$(window).off('resize.bs.modal')`: removes the handlers of every dialog, not only the closing one's. */
function clearResizeHandlers(): void {
  resizeHandlers.clear();
  window.removeEventListener('resize', onWindowResize);
}

function setFocusinHandler(handler: ((event: FocusEvent) => void) | null): void {
  if (focusinHandler) {
    document.removeEventListener('focusin', focusinHandler);
  }
  focusinHandler = handler;
  if (handler) {
    document.addEventListener('focusin', handler);
  }
}

/** jQuery's `css('padding-right', number)` appends `px` and ignores NaN. */
function setPx(el: HTMLElement, value: number): void {
  if (!Number.isNaN(value)) {
    el.style.paddingRight = `${value}px`;
  }
}
</script>

<script setup lang="ts">
/**
 * Frame of every dialog and the replacement for Bootstrap 3.4.1's modal
 * plugin (`bootstrap/js/modal.js`). The AngularJS dialogs carry
 * `modal animated fadeIn` but not `fade`, so the plugin ran every step
 * synchronously and without transitions; this component repeats those steps
 * in the same order. It is shown exactly while the modal manager has its id
 * open; Escape, a click on the backdrop area and the slot's `close` only
 * change that state.
 *
 * Reproduced on purpose (Q-32): every dialog appends its own backdrop, and
 * any hide drops the document-wide focus and resize handlers, even while
 * another dialog stays open. Unlike the plugin, the body state is shared by
 * all dialogs (see the module state above), and Escape is handled for the
 * whole page and closes the topmost dialog only (see `onEscape`).
 *
 * The enforced focus calls `focus()` on the `.modal` element, which has no
 * `tabindex` in the AngularJS markup: it takes
 * the focus only where the browser treats it as focusable (Chromium does so
 * for a scroll container whose content overflows); otherwise the focus stays
 * where it is, as in the AngularJS frontend.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useFileManager } from '../../services/fileManager.ts';

const props = defineProps<{
  /** Element id as in the AngularJS dialogs, also the key in the modal manager. */
  id: string;
  size?: 'lg';
}>();

defineSlots<{
  default(props: { close: () => void }): unknown;
}>();

const fm = useFileManager();
const root = ref<HTMLElement | null>(null);
// The `in` class; every other side effect is applied directly, as the plugin did.
const isIn = ref(false);

let isShown = false;
let backdrop: HTMLElement | null = null;
let backdropClickBound = false;
let ignoreBackdropClick = false;
let mouseupPending = false;
let bodyIsOverflowing = false;
let scrollbarWidth = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

/** Hides the dialog like `data-dismiss="modal"`: state only, the API error stays. */
function close(): void {
  fm.modals.close(props.id);
}

// modal.js 260-268
function checkScrollbar(): void {
  let fullWindowWidth = window.innerWidth;
  if (!fullWindowWidth) {
    const rect = document.documentElement.getBoundingClientRect();
    fullWindowWidth = rect.right - Math.abs(rect.left);
  }
  bodyIsOverflowing = document.body.clientWidth < fullWindowWidth;
  scrollbarWidth = measureScrollbar();
}

// modal.js 295-302
function measureScrollbar(): number {
  const scrollDiv = document.createElement('div');
  scrollDiv.className = 'modal-scrollbar-measure';
  document.body.appendChild(scrollDiv);
  const width = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  document.body.removeChild(scrollDiv);
  return width;
}

// modal.js 270-284
function setScrollbar(): void {
  const body = document.body;
  const bodyPad = parseInt(getComputedStyle(body).paddingRight || '0', 10);
  baselineBodyPad = body.style.paddingRight || '';
  if (bodyIsOverflowing) {
    setPx(body, bodyPad + scrollbarWidth);
    document.querySelectorAll<HTMLElement>(FIXED_CONTENT).forEach((element) => {
      fixedPadding.set(element, element.style.paddingRight);
      setPx(element, parseFloat(getComputedStyle(element).paddingRight) + scrollbarWidth);
    });
  }
}

// modal.js 286-293, but only the navbars that were compensated are reset.
function resetScrollbar(): void {
  document.body.style.paddingRight = baselineBodyPad;
  fixedPadding.forEach((padding, element) => {
    element.style.paddingRight = padding;
  });
  fixedPadding.clear();
}

// modal.js 244-251
function adjustDialog(): void {
  const el = root.value;
  if (!el) return;
  const modalIsOverflowing = el.scrollHeight > document.documentElement.clientHeight;
  el.style.paddingLeft = !bodyIsOverflowing && modalIsOverflowing ? `${scrollbarWidth}px` : '';
  el.style.paddingRight = bodyIsOverflowing && !modalIsOverflowing ? `${scrollbarWidth}px` : '';
}

// modal.js 140-150: one handler per document, owned by the dialog shown last.
function enforceFocus(el: HTMLElement): void {
  setFocusinHandler((event: FocusEvent) => {
    const target = event.target as Node | null;
    if (document !== target && el !== target && !(target && el.contains(target))) {
      el.focus();
    }
  });
}

// modal.js 52-107 for a dialog without `fade`
function show(): void {
  const el = root.value;
  if (isShown || !el) return;
  isShown = true;

  // Measured for every dialog, as `adjustDialog` uses it for the dialog's own padding.
  checkScrollbar();
  if (openCount++ === 0) {
    setScrollbar();
    document.body.classList.add('modal-open');
  }
  addResizeHandler(adjustDialog);

  backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  document.body.appendChild(backdrop);
  backdropClickBound = true;
  backdrop.classList.add('in');

  el.style.display = 'block';
  el.scrollTop = 0;
  adjustDialog();
  isIn.value = true;
  addShownDialog({ el, isTop: () => fm.modals.top === props.id, close });
  enforceFocus(el);
  el.focus();

  // `shown.bs.modal` handler of the AngularJS frontend: jQuery focuses
  // every `[autofocus]` element in turn, so the last focusable one wins. The
  // timer is not cancelled by a hide, as in the AngularJS frontend.
  const timer = setTimeout(() => {
    timers.delete(timer);
    el.querySelectorAll<HTMLElement>('[autofocus]').forEach((target) => target.focus());
  }, 100);
  timers.add(timer);
}

// modal.js 110-138 and hideModal 170-179 for a dialog without `fade`
function hide(): void {
  const el = root.value;
  if (!isShown || !el) return;
  isShown = false;
  removeShownDialog(el);

  clearResizeHandlers();
  setFocusinHandler(null);
  isIn.value = false;
  backdropClickBound = false;
  mouseupPending = false;

  el.style.display = 'none';
  backdrop?.remove();
  backdrop = null;
  el.style.paddingLeft = '';
  el.style.paddingRight = '';
  if (--openCount === 0) {
    document.body.classList.remove('modal-open');
    resetScrollbar();
  }
}

// modal.js 71-75
function onDialogMousedown(): void {
  if (isShown) {
    mouseupPending = true;
  }
}

function onMouseup(event: MouseEvent): void {
  if (!mouseupPending) return;
  mouseupPending = false;
  if (event.target === root.value) {
    ignoreBackdropClick = true;
  }
}

// modal.js 197-206: a press that started inside the dialog and ended outside does not close it.
function onClick(event: MouseEvent): void {
  if (!backdropClickBound) return;
  if (ignoreBackdropClick) {
    ignoreBackdropClick = false;
    return;
  }
  if (event.target !== event.currentTarget) return;
  close();
}

watch(
  () => fm.modals.isOpen(props.id),
  (open) => (open ? show() : hide()),
);

onMounted(() => {
  if (fm.modals.isOpen(props.id)) {
    show();
  }
});

onBeforeUnmount(() => {
  hide();
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  // Not a Bootstrap step: drop the document-wide handlers once no dialog is shown any more.
  if (openCount === 0) {
    clearResizeHandlers();
    setFocusinHandler(null);
  }
});
</script>

<template>
  <div
    :id="id"
    ref="root"
    class="modal animated fadeIn"
    :class="{ in: isIn }"
    @mouseup="onMouseup"
    @click="onClick"
  >
    <div class="modal-dialog" :class="{ 'modal-lg': size === 'lg' }" @mousedown="onDialogMousedown">
      <div class="modal-content">
        <slot :close="close" />
      </div>
    </div>
  </div>
</template>
