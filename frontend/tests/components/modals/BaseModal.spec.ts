/**
 * BaseModal against the behaviour of Bootstrap 3.4.1's modal plugin
 * (`node_modules/bootstrap/js/modal.js`) for dialogs without the `fade`
 * class. Line numbers in the comments refer to that file.
 */
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import BaseModal from '../../../src/components/modals/BaseModal.vue';
import { provideConfig } from '../../../src/config/injection.ts';
import { provideI18n } from '../../../src/i18n/index.ts';
import { createFileManager, provideFileManager, type FileManager } from '../../../src/services/fileManager.ts';
import { makeConfig, makeI18n } from '../../services/helpers.ts';

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
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
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
};
const click = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

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
    // jsdom has no layout; simulate a page with a 15px scrollbar (260-268, 295-302).
    const clientWidth = vi.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(1009);
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.className === 'modal-scrollbar-measure' ? 50 : 0;
    });
    const innerWidth = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024);
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
    clientWidth.mockRestore();
    offsetWidth.mockRestore();
    innerWidth.mockRestore();
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

  it('closes on Escape pressed inside the dialog only', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    // 152-160: the handler sits on the dialog element, a key on body never reaches it
    escape(document.body);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(true);
    escape(move.querySelector('input')!);
    await nextTick();
    expect(fm.modals.isOpen('move')).toBe(false);
  });

  it('handles Escape before handlers on document, which still run (Q-45)', async () => {
    const { fm, move } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    const seen: boolean[] = [];
    const onDocument = (): void => {
      seen.push(fm.modals.isOpen('move'));
    };
    document.addEventListener('keydown', onDocument);
    escape(move.querySelector('input')!);
    document.removeEventListener('keydown', onDocument);
    expect(seen).toEqual([false]);
  });

  it('ignores Escape and clicks while hidden', async () => {
    const { fm, move } = mountDialogs();
    const close = vi.spyOn(fm.modals, 'close');
    escape(move);
    click(move);
    expect(close).not.toHaveBeenCalled();
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
  it('reproduces Bootstrap with the selector on top of the move dialog', async () => {
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
    // 174: the hide of the upper dialog removes `modal-open` although `move` is still open
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(move.style.display).toBe('block');
    expect(move.classList.contains('in')).toBe(true);

    fm.modals.close('move');
    await nextTick();
    expect(backdrops()).toHaveLength(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });

  it('closes the dialog that holds the focus on Escape, even the lower one', async () => {
    const { fm, move, selector } = mountDialogs();
    fm.modals.open('move');
    await nextTick();
    fm.modals.open('selector');
    await nextTick();
    // The "change" link inside `move` keeps the focus: Escape reaches only `move` (152-160).
    escape(move.querySelector('a.change')!);
    await nextTick();
    expect(fm.modals.stack).toEqual(['selector']);
    escape(selector.querySelector('button')!);
    await nextTick();
    expect(fm.modals.stack).toEqual([]);
    expect(backdrops()).toHaveLength(0);
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
});
