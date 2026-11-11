/**
 * BaseModal against the behaviour of Bootstrap 3.4.1's modal plugin
 * (`node_modules/bootstrap/js/modal.js`) for dialogs without the `fade`
 * class. Line numbers in the comments refer to that file.
 */
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import BaseModal from '../../../src/components/modals/BaseModal.vue';
import MultiSelect from '../../../src/components/MultiSelect.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import { createFileManager, provideFileManager, type FileManager } from '../../../src/services/fileManager.ts';
import { makeConfig, makeI18n } from '../../services/helpers.ts';

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.className = '';
  document.body.removeAttribute('style');
});

/** Two dialogs as in the app: `move` first in the document, `selector` after it. */
function mountDialogs(attrs: Record<string, unknown> = {}): { fm: FileManager; move: HTMLElement; selector: HTMLElement } {
  const config = makeConfig();
  const i18n = makeI18n();
  const fm = createFileManager(config, i18n);
  const Host = defineComponent({
    setup() {
      provideConfig(config);
      provideI18n(i18n);
      provideFileManager(fm);
      return () =>
        h('div', [
          h(BaseModal, { id: 'move', ...attrs }, {
            default: ({ close }: { close: () => void }) => [
              h('a', { href: '', class: 'change' }, 'change'),
              h('input', { class: 'first', autofocus: 'autofocus' }),
              h('button', { class: 'dismiss', type: 'button', onClick: close }, 'cancel'),
            ],
          }),
          h(BaseModal, { id: 'selector', size: 'lg' }, {
            default: () => [h('button', { class: 'inner', type: 'button' }, 'inner')],
          }),
        ]);
    },
  });
  wrapper = mount(Host, { attachTo: document.body });
  return {
    fm,
    move: document.getElementById('move')!,
    selector: document.getElementById('selector')!,
  };
}

const backdrops = (): Element[] => [...document.body.querySelectorAll(':scope > .modal-backdrop')];
const escape = (target: Element): void => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  // jsdom drops `keyCode` from the init dictionary; MultiSelect reads only that.
  Object.defineProperty(event, 'keyCode', { value: 27 });
  target.dispatchEvent(event);
};
const click = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

/**
 * jsdom has no layout (its body is 0px wide, so it always overflows); simulates
 * a page whose body overflows the window, or with `false` one that fits, and a
 * scrollbar 50px wide (260-268, 295-302). Returns the restore function.
 */
function fakeScrollbar(overflowing = true): () => void {
  const clientWidth = vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(overflowing ? 1009 : 1024);
  const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.className === 'modal-scrollbar-measure' ? 50 : 0;
  });
  const innerWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
  return () => {
    clientWidth.mockRestore();
    offsetWidth.mockRestore();
    innerWidth.mockRestore();
  };
}

describe('BaseModal markup', () => {
  it('renders the AngularJS frame, the size class and passes attributes to the .modal element', () => {
    const { move, selector } = mountDialogs({ class: 'modal-fullscreen', 'data-x': '1' });
    expect(move.className).toBe('modal animated fadeIn modal-fullscreen');
    expect(move.getAttribute('data-x')).toBe('1');
    expect(move.querySelector(':scope > .modal-dialog > .modal-content > a.change')).not.toBeNull();
    expect(move.querySelector('.modal-dialog')!.className).toBe('modal-dialog');
    expect(selector.querySelector('.modal-dialog')!.className).toBe('modal-dialog modal-lg');
    // Like the AngularJS markup before the first show: no inline style, no tabindex.
    expect(move.hasAttribute('style')).toBe(false);
    expect(move.hasAttribute('tabindex')).toBe(false);
  });
});

describe('BaseModal show and hide', () => {
  it('follows the modal manager: display, `in`, backdrop and body class', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    // 84-85 `.show()` sets an inline display, 94 adds `in`
    expect(move.style.display).toBe('block');
    expect(move.classList.contains('in')).toBe(true);
    // 193-210: a backdrop without `fade`, appended to body, class `in`
    expect(backdrops().map((b) => b.className)).toEqual(['modal-backdrop in']);
    // 64
    expect(document.body.classList.contains('modal-open')).toBe(true);

    fm.modals.close('move');
    await nextTick();
    // 126-127 and 172: `in` removed, inline display none
    expect(move.style.display).toBe('none');
    expect(move.classList.contains('in')).toBe(false);
    // 181-184 and 174
    expect(backdrops()).toEqual([]);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('shows a dialog that is already open when it mounts', async () => {
    const config = makeConfig();
    const i18n = makeI18n();
    const fm = createFileManager(config, i18n);
    fm.modals.open('x');
    const Host = defineComponent({
      setup() {
        provideConfig(config);
        provideI18n(i18n);
        provideFileManager(fm);
        return () => h(BaseModal, { id: 'x' });
      },
    });
    wrapper = mount(Host, { attachTo: document.body });
    await nextTick();
    expect(document.getElementById('x')!.style.display).toBe('block');
    expect(backdrops()).toHaveLength(1);
  });

  it('closes through the slot function without touching the API error state', async () => {
    const { fm, move } = mountDialogs();
    fm.modal('move');
    fm.api.error = 'boom';
    await nextTick();
    click(move.querySelector('.dismiss')!);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
    expect(fm.api.error).toBe('boom');
  });

  it('restores the body padding it added for the scrollbar', async () => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar();
    document.body.style.paddingRight = '3px';
    fm.modals.open('move');
    await nextTick();
    // 270-275: computed padding (3) + scrollbar width (50 - 0 clientWidth in jsdom)
    expect(document.body.style.paddingRight).toBe('53px');
    // 249: body overflows and the dialog does not, so the dialog gets the scrollbar width on the right
    expect(document.getElementById('move')!.style.paddingRight).toBe('50px');
    expect(document.querySelector('.modal-scrollbar-measure')).toBeNull();
    fm.modals.close('move');
    await nextTick();
    // 287 and 253-258
    expect(document.body.style.paddingRight).toBe('3px');
    expect(document.getElementById('move')!.style.paddingRight).toBe('');
    restore();
  });
});

// Bootstrap applied and undid the body state per dialog, which broke with stacked dialogs.
describe('BaseModal page state', () => {
  const isModalOpen = (): boolean => document.body.classList.contains('modal-open');

  it.each([
    ['without a scrollbar', false, '3px'],
    ['with a scrollbar', true, '53px'],
  ])('keeps the body class and padding while any of two dialogs is open, closed in either order, %s', async (_, scrollbar, padded) => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar(scrollbar);
    document.body.style.paddingRight = '3px';
    for (const [first, second] of [['selector', 'move'], ['move', 'selector']]) {
      fm.modals.open('move');
      await nextTick();
      expect(isModalOpen()).toBe(true);
      expect(document.body.style.paddingRight).toBe(padded);
      fm.modals.open('selector');
      await nextTick();
      expect(document.body.style.paddingRight).toBe(padded);
      fm.modals.close(first);
      await nextTick();
      expect(isModalOpen()).toBe(true);
      expect(document.body.style.paddingRight).toBe(padded);
      fm.modals.close(second);
      await nextTick();
      expect(isModalOpen()).toBe(false);
      expect(document.body.style.paddingRight).toBe('3px');
    }
    restore();
  });

  it('does not grow the padding over three rounds of stacked dialogs closed lower first', async () => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar();
    for (let round = 0; round < 3; round++) {
      fm.modals.open('move');
      await nextTick();
      fm.modals.open('selector');
      await nextTick();
      expect(document.body.style.paddingRight).toBe('50px');
      fm.modals.close('move');
      await nextTick();
      expect(isModalOpen()).toBe(true);
      fm.modals.close('selector');
      await nextTick();
      expect(isModalOpen()).toBe(false);
      expect(document.body.style.paddingRight).toBe('');
    }
    restore();
  });

  it('compensates fixed navbars once and restores their inline padding exactly', async () => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar();
    const top = document.createElement('nav');
    top.className = 'navbar-fixed-top';
    top.style.paddingRight = '7px';
    const bottom = document.createElement('nav');
    bottom.className = 'navbar-fixed-bottom';
    document.body.append(top, bottom);
    fm.modals.open('move');
    await nextTick();
    expect(top.style.paddingRight).toBe('57px');
    expect(bottom.style.paddingRight).toBe('50px');
    fm.modals.open('selector');
    await nextTick();
    expect(top.style.paddingRight).toBe('57px');
    fm.modals.close('move');
    await nextTick();
    expect(top.style.paddingRight).toBe('57px');
    fm.modals.close('selector');
    await nextTick();
    expect(top.style.paddingRight).toBe('7px');
    expect(bottom.style.paddingRight).toBe('');
    top.remove();
    bottom.remove();
    restore();
  });

  it('leaves the inline padding of body and navbars alone when there is no scrollbar', async () => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar(false);
    document.body.style.paddingRight = '3px';
    const top = document.createElement('nav');
    top.className = 'navbar-fixed-top';
    top.style.paddingRight = '7px';
    document.body.append(top);
    fm.modals.open('move');
    await nextTick();
    fm.modals.close('move');
    await nextTick();
    expect(document.body.style.paddingRight).toBe('3px');
    expect(top.style.paddingRight).toBe('7px');
    fm.modals.open('move');
    await nextTick();
    expect(document.body.style.paddingRight).toBe('3px');
    expect(top.style.paddingRight).toBe('7px');
    fm.modals.close('move');
    await nextTick();
    expect(top.style.paddingRight).toBe('7px');
    top.remove();
    restore();
  });

  it('keeps each dialog its own backdrop and inline padding', async () => {
    const { fm, move, selector } = mountDialogs();
    const restore = fakeScrollbar();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    expect(backdrops()).toHaveLength(2);
    expect(move.style.paddingRight).toBe('50px');
    fm.modals.close('move');
    await nextTick();
    expect(backdrops()).toHaveLength(1);
    expect(move.style.paddingRight).toBe('');
    expect(selector.style.display).toBe('block');
    restore();
  });
});

describe('BaseModal dismiss gestures', () => {
  it('closes on a click on the .modal element itself but not inside the dialog', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    click(move.querySelector('.modal-content')!);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(true);
    // 197-206: only `e.target === e.currentTarget` closes
    click(move);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
  });

  it('ignores the click of a press that started inside the dialog and ended on the backdrop area', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    // 71-75: mousedown in .modal-dialog, mouseup on .modal sets ignoreBackdropClick
    move.querySelector('.modal-dialog')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    move.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    click(move);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(true);
    // 198-200: the flag is used up by that one click
    click(move);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
  });

  it('ignores Escape and clicks while hidden', async () => {
    const { fm, move } = mountDialogs();
    const close = vi.spyOn(fm.modals, 'close');
    escape(move);
    escape(document.body);
    click(move);
    expect(close).not.toHaveBeenCalled();
  });
});

// Bootstrap bound Escape to the dialog element, which only saw the key while the focus was inside it.
describe('BaseModal Escape', () => {
  it.each([
    ['an element inside the dialog', (move: HTMLElement) => move.querySelector('a.change')!],
    ['a text field of the dialog', (move: HTMLElement) => move.querySelector('input')!],
    ['the dialog element', (move: HTMLElement) => move],
    ['body', () => document.body],
    ['an element of the page outside the dialog', () => document.getElementById('outside')!],
  ])('closes the open dialog with the key on %s', async (_, target) => {
    const { fm, move } = mountDialogs();
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    fm.modals.open('move');
    await nextTick();
    escape(target(move));
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
    expect(move.style.display).toBe('none');
    outside.remove();
  });

  it('closes the dialog even when a handler on the way stops the event', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    const stop = (event: Event): void => event.stopPropagation();
    document.body.addEventListener('keydown', stop);
    escape(document.body);
    document.body.removeEventListener('keydown', stop);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
  });

  it('ignores other keys', async () => {
    const { fm } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(true);
  });

  it('does nothing and listens to nothing while no dialog is open', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const { fm, move } = mountDialogs();
    const close = vi.spyOn(fm.modals, 'close');
    escape(document.body);
    expect(close).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalledWith('keydown', expect.any(Function), true);
    fm.modals.open('move');
    await nextTick();
    expect(add).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    escape(move);
    await nextTick();
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    close.mockClear();
    escape(document.body);
    expect(close).not.toHaveBeenCalled();
    add.mockRestore();
    remove.mockRestore();
  });

  it('lets an open role list close itself first, and closes the dialog on the next Escape', async () => {
    const config = makeConfig();
    const i18n = makeI18n();
    const fm = createFileManager(config, i18n);
    const Host = defineComponent({
      setup() {
        provideConfig(config);
        provideI18n(i18n);
        provideFileManager(fm);
        return () =>
          h(BaseModal, { id: 'changepermissions' }, {
            default: () => [h(MultiSelect, { inputModel: [{ role: 'Admin', selected: true }, { role: 'Guest', selected: false }] })],
          });
      },
    });
    wrapper = mount(Host, { attachTo: document.body });
    fm.modals.open('changepermissions');
    await nextTick();
    const dialog = document.getElementById('changepermissions')!;
    click(dialog.querySelector('.multiSelect > button')!);
    await nextTick();
    expect(dialog.querySelector('.checkboxLayer.show')).not.toBeNull();

    escape(document.activeElement ?? document.body);
    await nextTick();
    expect(dialog.querySelector('.checkboxLayer.show')).toBeNull();
    expect(fm.modals.isOpen('changepermissions')).toBe(true);

    escape(document.activeElement ?? document.body);
    await nextTick();
    expect(fm.modals.isOpen('changepermissions')).toBe(false);
  });
});

describe('BaseModal focus', () => {
  it('focuses the [autofocus] element 100 ms after showing (carried over from the AngularJS frontend)', async () => {
    vi.useFakeTimers();
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    vi.advanceTimersByTime(99);
    expect(document.activeElement).not.toBe(move.querySelector('input'));
    vi.advanceTimersByTime(1);
    expect(document.activeElement).toBe(move.querySelector('input'));
  });

  it('calls focus() on the dialog when focus moves outside, which jsdom ignores for a div without tabindex (140-150)', async () => {
    const { fm, move } = mountDialogs();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const focus = vi.spyOn(move, 'focus');
    fm.modals.open('move');
    await nextTick();
    // 96 and 103/106: once on show
    expect(focus).toHaveBeenCalledTimes(1);
    outside.focus();
    expect(focus).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(outside);
    (move.querySelector('input') as HTMLElement).focus();
    expect(focus).toHaveBeenCalledTimes(2);
    fm.modals.close('move');
    await nextTick();
    // 124: the handler is gone after the hide
    outside.focus();
    expect(focus).toHaveBeenCalledTimes(2);
    outside.remove();
  });
});

describe('BaseModal stacked dialogs (Q-32)', () => {
  it('shows the selector on top of the move dialog', async () => {
    const { fm, move, selector } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    // 193-195: one backdrop per dialog
    expect(backdrops()).toHaveLength(2);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    // A click on the top dialog's own area closes only that dialog.
    click(selector);
    await nextTick();
    expect(fm.modals.stack).toEqual(['move']);
    expect(backdrops()).toHaveLength(1);
    // Unlike Bootstrap (174), `modal-open` stays while `move` is still open.
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(move.style.display).toBe('block');
    expect(move.classList.contains('in')).toBe(true);

    fm.modals.close('move');
    await nextTick();
    expect(backdrops()).toHaveLength(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it.each([
    ['the lower dialog', (move: HTMLElement) => move.querySelector('a.change')!],
    ['the upper dialog', (_: HTMLElement, selector: HTMLElement) => selector.querySelector('button.inner')!],
    ['body', () => document.body],
  ])('closes the topmost dialog only on Escape with the focus in %s, the next one on a second Escape', async (_, target) => {
    const { fm, move, selector } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    escape(target(move, selector));
    await nextTick();
    expect(fm.modals.stack).toEqual(['move']);
    expect(selector.style.display).toBe('none');
    expect(move.style.display).toBe('block');
    expect(backdrops()).toHaveLength(1);
    escape(target(move, selector));
    await nextTick();
    expect(fm.modals.stack).toEqual([]);
    expect(backdrops()).toHaveLength(0);
    // A third Escape finds no dialog.
    escape(document.body);
    await nextTick();
    expect(fm.modals.stack).toEqual([]);
  });

  it('closes one dialog per Escape even before the closed one is hidden', async () => {
    const { fm } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    escape(document.body);
    expect(fm.modals.stack).toEqual(['move']);
    escape(document.body);
    expect(fm.modals.stack).toEqual([]);
  });

  it('drops the enforced focus of the lower dialog when the upper one closes (124)', async () => {
    const { fm, move } = mountDialogs();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    fm.modals.close('selector');
    await nextTick();
    const focus = vi.spyOn(move, 'focus');
    outside.focus();
    expect(focus).not.toHaveBeenCalled();
    outside.remove();
  });
});

describe('BaseModal unmount', () => {
  it('removes backdrops, the body class and its listeners', async () => {
    vi.useFakeTimers();
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    const remove = vi.spyOn(document, 'removeEventListener');
    wrapper!.unmount();
    wrapper = undefined;
    expect(backdrops()).toHaveLength(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.paddingRight).toBe('');
    expect(remove).toHaveBeenCalledWith('focusin', expect.any(Function));
    // The pending autofocus timer is cancelled.
    const focus = vi.spyOn(move.querySelector('input')!, 'focus');
    vi.advanceTimersByTime(200);
    expect(focus).not.toHaveBeenCalled();
    remove.mockRestore();
  });

  it('restores the page state and stops listening for Escape when unmounted with dialogs open', async () => {
    const { fm } = mountDialogs();
    const restore = fakeScrollbar();
    document.body.style.paddingRight = '3px';
    const top = document.createElement('nav');
    top.className = 'navbar-fixed-top';
    top.style.paddingRight = '7px';
    document.body.append(top);
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    const remove = vi.spyOn(window, 'removeEventListener');
    wrapper!.unmount();
    wrapper = undefined;
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.paddingRight).toBe('3px');
    expect(top.style.paddingRight).toBe('7px');
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    top.remove();
    restore();

    // A widget mounted afterwards starts from a clean page state.
    const next = mountDialogs();
    next.fm.modals.open('move');
    await nextTick();
    expect(document.body.classList.contains('modal-open')).toBe(true);
    next.fm.modals.close('move');
    await nextTick();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.body.style.paddingRight).toBe('3px');
  });
});
