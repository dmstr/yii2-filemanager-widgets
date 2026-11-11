import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, reactive, withDirectives } from 'vue';
import { tempModelField, textModel, vTextModel, type TextModel } from '../../src/components/modelTrim.ts';

let wrapper: VueWrapper;
afterEach(() => wrapper?.unmount());

/** Mounts one field bound to `model`; `tag` picks input or textarea. */
function mountField(model: TextModel, tag: 'input' | 'textarea' = 'input') {
  const holder = reactive({ model });
  wrapper = mount(
    defineComponent({
      setup: () => () => withDirectives(h(tag), [[vTextModel, holder.model]]),
    }),
    { attachTo: document.body },
  );
  const el = wrapper.element as HTMLInputElement;
  const fire = (type: string) => el.dispatchEvent(new Event(type));
  const type = (value: string) => {
    el.value = value;
    fire('input');
  };
  return { el, fire, type, holder };
}

describe('vTextModel', () => {
  it('writes the trimmed text and never rewrites the field while typing or on blur', async () => {
    const state = reactive({ name: 'a' });
    const set = vi.fn((value: string) => (state.name = value));
    const { el, fire, type } = mountField(textModel(() => state.name, set));
    expect(el.value).toBe('a');
    for (const step of ['f', 'fo', 'foo', 'foo ', 'foo b', 'foo ba', 'foo bar', 'foo bar ']) {
      type(step);
      await nextTick();
      expect(el.value).toBe(step);
    }
    expect(state.name).toBe('foo bar');
    // A backspace that leaves a trailing space changes the model but keeps the space in the field.
    type('foo ');
    await nextTick();
    expect(state.name).toBe('foo');
    expect(el.value).toBe('foo ');
    fire('change');
    await nextTick();
    expect(el.value).toBe('foo ');
    // A space typed into an emptied field writes ''.
    type(' ');
    await nextTick();
    expect(state.name).toBe('');
    expect(el.value).toBe(' ');
  });

  it('writes only when the trimmed text changed', () => {
    const state = reactive({ name: 'a' });
    const set = vi.fn((value: string) => (state.name = value));
    const { type, fire } = mountField(textModel(() => state.name, set));
    type('b');
    type('b ');
    type(' b ');
    fire('change');
    expect(set.mock.calls).toEqual([['b']]);
  });

  it('shows the model when it changes from outside, but not a value the field wrote itself', async () => {
    const state = reactive({ name: 'a' as string | undefined | null });
    const { el, type } = mountField(textModel(() => state.name, (value) => (state.name = value)));
    type('x ');
    await nextTick();
    state.name = 'x';
    await nextTick();
    expect(el.value).toBe('x ');
    state.name = 'other';
    await nextTick();
    expect(el.value).toBe('other');
    state.name = undefined;
    await nextTick();
    expect(el.value).toBe('');
    state.name = 'again';
    await nextTick();
    state.name = null;
    await nextTick();
    expect(el.value).toBe('');
  });

  it('ignores input during an IME composition and commits once it ends', async () => {
    const state = reactive({ name: '' });
    const set = vi.fn((value: string) => (state.name = value));
    const { el, fire, type } = mountField(textModel(() => state.name, set));
    fire('compositionstart');
    type('ni');
    type('nih ');
    expect(set).not.toHaveBeenCalled();
    fire('compositionend');
    expect(set.mock.calls).toEqual([['nih']]);
    await nextTick();
    expect(el.value).toBe('nih ');
  });

  it('empties the field again when the model does not take the value (Q-29)', async () => {
    const { el, type } = mountField(textModel(() => undefined, () => {}));
    type('x');
    expect(el.value).toBe('');
    await nextTick();
    expect(el.value).toBe('');
  });

  it('works on a textarea and keeps inner line breaks', async () => {
    const state = reactive({ content: 'one' });
    const { el, type } = mountField(textModel(() => state.content, (value) => (state.content = value)), 'textarea');
    expect(el.value).toBe('one');
    type('\n one\ntwo\n\n');
    await nextTick();
    expect(state.content).toBe('one\ntwo');
    expect(el.value).toBe('\n one\ntwo\n\n');
  });

  it('follows a replaced model object', async () => {
    const first = reactive({ name: 'first' });
    const second = reactive({ name: 'second' });
    const { el, holder, type } = mountField(textModel(() => first.name, (value) => (first.name = value)));
    holder.model = textModel(() => second.name, (value) => (second.name = value));
    await nextTick();
    expect(el.value).toBe('second');
    type('typed');
    expect(second.name).toBe('typed');
    expect(first.name).toBe('first');
  });

  it('stops listening and watching when unmounted', async () => {
    const state = reactive({ name: 'a' });
    const set = vi.fn();
    const { el } = mountField(textModel(() => state.name, set));
    wrapper.unmount();
    el.value = 'b';
    el.dispatchEvent(new Event('input'));
    state.name = 'c';
    await nextTick();
    expect(set).not.toHaveBeenCalled();
    expect(el.value).toBe('b');
  });
});

describe('tempModelField', () => {
  it('reads and writes tempModel[key] of the owner', () => {
    const owner = reactive({ tempModel: { name: 'a' } as Record<string, unknown> });
    const model = tempModelField(() => owner, 'name');
    expect(model.get()).toBe('a');
    model.set('b');
    expect(owner.tempModel.name).toBe('b');
  });

  it('reads undefined and drops the write without an owner (Q-29)', () => {
    for (const missing of [undefined, null, false] as const) {
      const model = tempModelField(() => missing, 'name');
      expect(model.get()).toBeUndefined();
      expect(() => model.set('x')).not.toThrow();
    }
  });
});
