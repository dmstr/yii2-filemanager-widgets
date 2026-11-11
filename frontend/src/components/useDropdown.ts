/**
 * Open/close behaviour of a Bootstrap 3.4.1 dropdown without its JavaScript
 * (`data-toggle` is left out on purpose, so a host page that loads Bootstrap's
 * plugin does not handle the same click twice). The rules are those of
 * `dropdown.js`: the toggle button opens or closes its own menu and closes all
 * others, any other click closes every open menu except a click on an
 * `input` or `textarea` inside the open menu, a menu item click bubbles to
 * the document and closes it, and Escape (plus the arrow keys and space) on
 * the toggle or in the menu is handled like Bootstrap does.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';

/** Close functions of all mounted dropdowns; Bootstrap's `clearMenus()` closes every open menu at once. */
const closers = new Set<() => void>();

const isTextField = (el: EventTarget | null): boolean => !!el && /input|textarea/i.test((el as Element).tagName);

// jQuery's `:visible`: the element takes up layout space.
const isVisible = (el: HTMLElement): boolean => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

/**
 * Returns the template refs (`root` is the `.btn-group`, `toggle` its button)
 * and the state to bind: `open` for the `open` class and `expanded` for
 * `aria-expanded`.
 */
export function useDropdown() {
  const root = ref<HTMLElement | null>(null);
  const toggle = ref<HTMLElement | null>(null);
  const open = ref(false);
  // The legacy markup ships `aria-expanded="true"`; Bootstrap only rewrites it on open and on close of an open menu.
  const expanded = ref<'true' | 'false'>('true');

  function close(): void {
    if (!open.value) {
      return;
    }
    expanded.value = 'false';
    open.value = false;
  }

  /** Bootstrap's `Dropdown.prototype.toggle`, which ends in `return false`: no default action, no bubbling. */
  function onToggleClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const wasOpen = open.value;
    closers.forEach((closeOther) => closeOther());
    if (!wasOpen) {
      toggle.value?.focus();
      expanded.value = 'true';
      open.value = true;
    }
  }

  function onDocumentClick(event: MouseEvent): void {
    if (event.which === 3) {
      return;
    }
    if (isTextField(event.target) && root.value?.contains(event.target as Node)) {
      return;
    }
    close();
  }

  /** Bootstrap's `Dropdown.prototype.keydown`, bound to the toggle and to the menu. */
  function onKeydown(event: KeyboardEvent): void {
    const key = event.which;
    if (![38, 40, 27, 32].includes(key) || isTextField(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const isActive = open.value;
    if ((!isActive && key !== 27) || (isActive && key === 27)) {
      if (key === 27) {
        toggle.value?.focus();
      }
      return onToggleClick(new Event('click'));
    }
    const items = Array.from(root.value?.querySelectorAll<HTMLElement>('.dropdown-menu li:not(.disabled) a') ?? []).filter(isVisible);
    if (!items.length) {
      return;
    }
    let index = items.indexOf(event.target as HTMLElement);
    if (key === 38 && index > 0) {
      index--;
    }
    if (key === 40 && index < items.length - 1) {
      index++;
    }
    if (index === -1) {
      index = 0;
    }
    items[index].focus();
  }

  onMounted(() => {
    closers.add(close);
    document.addEventListener('click', onDocumentClick);
  });
  onBeforeUnmount(() => {
    closers.delete(close);
    document.removeEventListener('click', onDocumentClick);
  });

  return { root, toggle, open, expanded, close, onToggleClick, onKeydown };
}
