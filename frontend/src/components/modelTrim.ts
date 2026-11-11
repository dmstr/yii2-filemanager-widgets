/**
 * The binding of every text input and textarea in the dialogs: a port of
 * AngularJS 1.5.11 `ng-model` on such a field with the default `ngTrim`
 * (`baseInputType` and the `ngModelWatch` of `NgModelController`).
 *
 * - On `input` and `change` the model receives the trimmed text, and only
 *   when that differs from the last value the field produced.
 * - The text in the field is never rewritten while the user types or when
 *   the field loses focus; a trailing space stays visible.
 * - When the model changes from outside (another item selected, `revert()`,
 *   content loaded) to something else than the field last wrote, the field
 *   shows the model value.
 * - While an IME composition runs, `input` events are ignored; its end
 *   counts as one input.
 *
 * Vue's `v-model.trim` trims the visible text on `change` (blur), and a
 * `:value` binding rewrites the field whenever the trimmed value changes
 * (a backspace that leaves a trailing space removes the space); neither
 * matches the legacy behaviour.
 */
import { watch, type Directive, type WatchStopHandle } from 'vue';

/** Read and write access to one model value. */
export interface TextModel {
  get(): unknown;
  set(value: string): void;
}

/** Creates a `TextModel`; declare it once in `<script setup>` so its identity stays stable. */
export const textModel = (get: () => unknown, set: (value: string) => void): TextModel => ({ get, set });

interface Owner {
  tempModel: object;
}

/**
 * `ng-model="<owner>.tempModel.<key>"` for an owner that may be missing,
 * such as `singleSelection()` with no or several items selected. AngularJS
 * read such a path as `undefined` and failed to assign through it (Q-29): the
 * read renders an empty field and the write is dropped; the directive then
 * empties the field again because the model did not take the value.
 */
export function tempModelField(owner: () => Owner | false | null | undefined, key: string): TextModel {
  return textModel(
    () => {
      const current = owner();
      return current ? (current.tempModel as Record<string, unknown>)[key] : undefined;
    },
    (value) => {
      const current = owner();
      if (current) {
        (current.tempModel as Record<string, unknown>)[key] = value;
      }
    },
  );
}

type Field = HTMLInputElement | HTMLTextAreaElement;

interface State {
  model: TextModel;
  /** `$modelValue`: what the model held when last read or written by this field. */
  modelValue: unknown;
  /** `$viewValue`: the formatted model value or the last trimmed field text. */
  viewValue: unknown;
  composing: boolean;
  stop: WatchStopHandle;
  listeners: Array<[string, EventListener]>;
}

const states = new WeakMap<Field, State>();

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === '' || value === null || (typeof value === 'number' && Number.isNaN(value));

/** `ngModelWatch` plus `$render`: shows the model value when it is not what the field last wrote. */
function syncFromModel(el: Field, state: State): void {
  const value = state.model.get();
  if (value === state.modelValue) {
    return;
  }
  state.modelValue = value;
  // The formatter of text inputs: empty values stay as they are, everything else becomes a string.
  const view = isEmpty(value) ? value : String(value);
  if (view !== state.viewValue) {
    state.viewValue = view;
    const text = isEmpty(view) ? '' : (view as string);
    if (el.value !== text) {
      el.value = text;
    }
  }
}

/** The input listener: trims, commits a changed value to the model, then lets the model answer. */
function onInput(el: Field, state: State): void {
  if (state.composing) {
    return;
  }
  const value = el.value.trim();
  if (state.viewValue === value) {
    return;
  }
  state.viewValue = value;
  if (state.modelValue !== value) {
    state.modelValue = value;
    state.model.set(value);
  }
  // The digest after the input: a model that did not take the value (Q-29) is rendered back.
  syncFromModel(el, state);
}

function observe(el: Field, state: State): void {
  state.stop = watch(
    () => state.model.get(),
    () => syncFromModel(el, state),
  );
}

/** `v-text-model="model"` on an `<input>` or `<textarea>`; the value is a `TextModel`. */
export const vTextModel: Directive<Field, TextModel> = {
  mounted(el, binding) {
    const state: State = {
      model: binding.value,
      modelValue: NaN,
      viewValue: undefined,
      composing: false,
      stop: () => {},
      listeners: [],
    };
    const handle = () => onInput(el, state);
    state.listeners = [
      ['input', handle],
      ['change', handle],
      ['compositionstart', () => (state.composing = true)],
      [
        'compositionend',
        () => {
          state.composing = false;
          handle();
        },
      ],
    ];
    state.listeners.forEach(([type, listener]) => el.addEventListener(type, listener));
    states.set(el, state);
    // NaN as the initial model value makes the first read render, like the first digest.
    syncFromModel(el, state);
    observe(el, state);
  },
  updated(el, binding) {
    const state = states.get(el);
    if (state && binding.value !== state.model) {
      state.stop();
      state.model = binding.value;
      syncFromModel(el, state);
      observe(el, state);
    }
  },
  beforeUnmount(el) {
    const state = states.get(el);
    if (state) {
      state.stop();
      state.listeners.forEach(([type, listener]) => el.removeEventListener(type, listener));
      states.delete(el);
    }
  },
};
