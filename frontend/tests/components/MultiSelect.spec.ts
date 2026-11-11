/**
 * MultiSelect against the recorded behaviour of the `isteven-multi-select` 4.0.0
 * directive: the component is driven through the same DOM events the directive
 * was and compared after every step with the recorded state (rendered tree,
 * button label, output model, input flags, focused element).
 */
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MultiSelect, { type MultiSelectItem } from '../../src/components/MultiSelect.vue';
import { loadFixture } from '../utils/fixtures.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

interface Driver {
  root: HTMLElement;
  output: () => unknown;
  input: () => Any;
  setInput: (value: Any) => Promise<void>;
  destroy: () => void;
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function vueDriver(input: Any, output?: Any): Driver & { wrapper: VueWrapper } {
  let parentOutput = output;
  let current = input;
  // The component emits during setup already, before `mount` has returned the wrapper.
  const wrapper: VueWrapper = mount(MultiSelect, {
    props: {
      inputModel: input,
      outputModel: output,
      'onUpdate:outputModel': (value: unknown) => {
        parentOutput = value;
        queueMicrotask(() => void wrapper.setProps({ outputModel: value as Any }));
      },
    },
    attrs: { class: 'permission-multi-select-button' },
    attachTo: document.body,
  });
  return {
    wrapper,
    root: wrapper.element as HTMLElement,
    output: () => parentOutput,
    input: () => current,
    setInput: async (value) => {
      current = value;
      await wrapper.setProps({ inputModel: value });
      await settle();
    },
    destroy: () => wrapper.unmount(),
  };
}

/** Tags, classes (without AngularJS's `ng-*` bookkeeping), the attributes that matter and non-blank text. */
function shape(node: Node, checked: boolean): unknown {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent!.trim() === '' ? null : node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const out: Record<string, unknown> = {
    tag: el.tagName,
    class: Array.from(el.classList)
      .filter((name) => !name.startsWith('ng-'))
      .sort()
      .join(' '),
  };
  for (const name of ['id', 'type', 'placeholder']) {
    if (el.hasAttribute(name)) out[name] = el.getAttribute(name);
  }
  if (el.style.cssText) out.style = el.style.cssText;
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) out.disabled = el.disabled;
  if (el instanceof HTMLInputElement && el.type === 'text') out.value = el.value;
  if (checked && el instanceof HTMLInputElement && el.type === 'checkbox') out.checked = el.checked;
  out.children = Array.from(el.childNodes)
    .map((child) => shape(child, checked))
    .filter((child) => child !== null);
  return out;
}

/** Child-index path from the host to the focused element, or null when focus is outside. */
function activePath(root: HTMLElement): number[] | null {
  const path: number[] = [];
  let el = document.activeElement;
  while (el && el !== root) {
    const parent: Element | null = el.parentElement;
    if (!parent) return null;
    path.unshift(Array.from(parent.children).indexOf(el));
    el = parent;
  }
  return el === root ? path : null;
}

const flags = (input: Any) =>
  Array.isArray(input) ? input.map((item: Any) => ({ role: item.role, selected: item.selected })) : input;

function state(d: Driver, checked: boolean) {
  return {
    dom: shape(d.root, checked),
    output: JSON.stringify(d.output()),
    input: JSON.stringify(flags(d.input())),
    active: activePath(d.root),
  };
}

/** One line per node of a `shape` tree, indented by depth: tag, then every recorded field, then the children. */
function describeShape(node: unknown, depth = 0): string[] {
  const pad = '  '.repeat(depth);
  if (typeof node === 'string') return [pad + JSON.stringify(node)];
  const { tag, children, ...fields } = node as { tag: string; children: unknown[] } & Record<string, unknown>;
  const head = [tag.toLowerCase(), ...Object.entries(fields).map(([name, value]) => `${name}=${JSON.stringify(value)}`)].join(' ');
  return [pad + head, ...children.flatMap((child) => describeShape(child, depth + 1))];
}

/** The state of the directive after mount and after every step of a scenario; `dom` is an index into `doms`. */
interface RecordedState {
  dom: number;
  output: string | undefined;
  input: string | undefined;
  active: number[] | null;
}
const recorded = loadFixture<{ doms: string[][]; scenarios: Record<string, RecordedState[]> }>('components/multi-select.json');

type Step = (d: Driver) => unknown;

/**
 * Runs the steps of the running test on the component and compares the state
 * after mount and after every step with the one recorded from the directive
 * (the scenario is the full name of the test). With `sameAs` the states are
 * compared with the recording of that other scenario instead, except for the
 * input model, which is what the two differ in. Returns the component's
 * driver states for additional assertions.
 */
async function replay(
  fixture: () => Any,
  steps: Step[],
  options: { checked?: boolean; output?: () => Any; sameAs?: string } = {},
) {
  const checked = options.checked ?? true;
  const scenario = options.sameAs ?? expect.getState().currentTestName!;
  const expected = recorded.scenarios[scenario];
  if (!expected) throw new Error(`no recording for: ${scenario}`);
  const d = vueDriver(fixture(), options.output?.());
  await settle();
  const states = [state(d, checked)];
  for (const step of steps) {
    await step(d);
    await settle();
    states.push(state(d, checked));
  }
  d.destroy();
  expect(states).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const { dom, ...rest } = states[i];
    const input = options.sameAs ? expected[i].input : rest.input;
    expect({ ...rest, input, dom: describeShape(dom) }, `state after step ${i}`).toEqual({ ...expected[i], dom: recorded.doms[expected[i].dom] });
  }
  return states;
}

const $ = (d: Driver, selector: string) => d.root.querySelector(selector) as HTMLElement;
const $$ = (d: Driver, selector: string) => Array.from(d.root.querySelectorAll(selector)) as HTMLElement[];
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const mainButton = (d: Driver) => $(d, '.multiSelect > button');
const toggle = (d: Driver) => click(mainButton(d));
const row = (d: Driver, i: number) => $$(d, '.multiSelectItem')[i];
const helper = (d: Driver, i: number) => $$(d, '.helperButton')[i];
const type = (d: Driver, text: string) => {
  const field = $(d, '.inputFilter') as HTMLInputElement;
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};
const key = (keyCode: number, shiftKey = false) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, shiftKey });
  Object.defineProperty(event, 'keyCode', { value: keyCode });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
};
const leave = (el: Element) => {
  // jQuery implements mouseleave through mouseout; Vue listens to the native event.
  el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
  el.dispatchEvent(new MouseEvent('mouseleave'));
};

const roles = (): MultiSelectItem[] => [
  { role: 'Admin', selected: true },
  { role: 'Editor', selected: false },
  { role: 'Guest', selected: true },
  { role: 'Reviewer', selected: false },
];

beforeEach(() => {
  // The directive throws inside AngularJS handlers in some of the cases below; $exceptionHandler logs them.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('MultiSelect rendering', () => {
  it('renders the directive tree, button label and output model for a mixed selection', async () => {
    const [initial] = await replay(roles, []);
    expect(initial.output).toBe('[{"role":"Admin","selected":true},{"role":"Guest","selected":true}]');
  });

  it('has no whitespace between the helper buttons, like the directive (the recorded states drop blank text)', () => {
    const d = vueDriver(roles(), []);
    const line = helper(d, 0).parentElement!;
    expect(Array.from(line.childNodes).map((node) => node.nodeName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON']);
    d.destroy();
  });

  it('shows "None Selected" with the caret when nothing is ticked', async () => {
    await replay(() => roles().map((item) => ({ ...item, selected: false })), []);
  });

  it('renders an empty array like the directive', async () => {
    await replay(() => [], [toggle]);
  });

  // Deviation: the directive ignored a null or undefined input model (an empty button, no output, and no
  // opening for null). It counts as an empty list here, so it renders, opens and outputs like `[]`.
  for (const [name, value] of [
    ['undefined', undefined],
    ['null', null],
  ] as const) {
    it(`renders, opens and outputs an input model of ${name} like an empty array`, async () => {
      await replay(() => value, [toggle], { sameAs: 'MultiSelect rendering > renders an empty array like the directive' });
    });

    it(`renders an input model of ${name} like an empty array while the parent holds an output array`, async () => {
      await replay(() => value, [toggle], { output: () => [], sameAs: 'MultiSelect rendering > renders an empty array like the directive' });
    });
  }

  it('reduces the output to role and selected in the input key order, only for selected === true', async () => {
    const vue = await replay(
      () => [
        { selected: true, role: 'B', id: 7 },
        { role: 'A', selected: 1 },
        { role: 'C', selected: true, extra: { x: 1 } },
      ],
      [],
    );
    expect(vue[0].output).toBe('[{"selected":true,"role":"B"},{"role":"C","selected":true}]');
  });

  it('gives a falsy role an empty label', async () => {
    await replay(
      () => [
        { role: '', selected: true },
        { role: 'A', selected: true },
      ],
      [],
    );
  });
});

describe('MultiSelect opening and closing', () => {
  it('toggles show on the layer, buttonClicked on the span and moves focus to the filter and back', async () => {
    await replay(roles, [toggle, toggle, toggle]);
  });

  it('closes on a click outside and keeps buttonClicked on the span', async () => {
    const vue = await replay(roles, [toggle, () => click(document.body), toggle, toggle]);
    const span = (n: number) => ((vue[n].dom as Any).children[0] as Any).class;
    expect([span(1), span(2), span(4)]).toEqual(['buttonClicked inlineBlock multiSelect', 'buttonClicked inlineBlock multiSelect', 'inlineBlock multiSelect']);
  });

  it('stays open on clicks inside the layer', async () => {
    await replay(roles, [
      toggle,
      (d) => click($(d, '.checkBoxContainer')),
      (d) => click($(d, '.helperContainer')),
      (d) => click($(d, '.inputFilter')),
      (d) => click($(d, '.checkboxLayer')),
    ]);
  });

  it('closes on a click on the host element outside the span', async () => {
    await replay(roles, [toggle, (d) => click(d.root)]);
  });

  it('removes its document listeners on unmount', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const d = vueDriver(roles());
    toggle(d);
    const added = add.mock.calls.filter(([type]) => type === 'click' || type === 'keydown');
    expect(added).toHaveLength(2);
    remove.mockClear();
    d.destroy();
    for (const [type, listener] of added) {
      expect(remove).toHaveBeenCalledWith(type, listener);
    }
  });
});

describe('MultiSelect items', () => {
  it('toggles an item on a click on the row and on the label, and marks the row with multiSelectFocus', async () => {
    await replay(roles, [
      toggle,
      (d) => click(row(d, 1)),
      (d) => click($$(d, '.multiSelectItem span')[0]),
      (d) => leave(row(d, 3)),
      (d) => click($$(d, '.multiSelectItem label')[3]),
    ]);
  });

  it('toggles an item on a click on its checkbox and focuses it', async () => {
    // The hidden checkbox's `checked` differs after a direct click: the directive's preventDefault
    // lets the browser restore the old state after AngularJS has set the new one. Compared below without it.
    await replay(roles, [toggle, (d) => click($$(d, '.checkbox')[1]), (d) => click($$(d, '.checkbox')[0])], {
      checked: false,
    });
  });

  it('ticks the input items in place and shows them ticked on the next open', async () => {
    const vue = await replay(roles, [toggle, (d) => click(row(d, 3)), toggle, toggle]);
    expect(vue[vue.length - 1].input).toContain('{"role":"Reviewer","selected":true}');
  });

  it('removes multiSelectFocus of the current tab index on mouseleave of any row', async () => {
    const vue = await replay(roles, [toggle, (d) => click(row(d, 0)), (d) => leave(row(d, 2))]);
    expect(JSON.stringify(vue[2].dom)).toContain('multiSelectFocus');
    expect(JSON.stringify(vue[3].dom)).not.toContain('multiSelectFocus');
  });
});

describe('MultiSelect helpers', () => {
  it('selects all, none and resets to the state of the last input model', async () => {
    await replay(roles, [
      toggle,
      (d) => click(helper(d, 0)),
      (d) => click(helper(d, 1)),
      (d) => click(row(d, 3)),
      (d) => click(helper(d, 2)),
    ]);
  });

  it('applies select all, none and reset to the filtered items only', async () => {
    await replay(roles, [
      toggle,
      (d) => type(d, 'e'),
      (d) => type(d, 'er'),
      (d) => click(helper(d, 0)),
      (d) => click($(d, '.clearButton')),
      (d) => type(d, 'ad'),
      (d) => click(helper(d, 1)),
      (d) => type(d, 'gu'),
      (d) => click(helper(d, 1)),
      (d) => click($(d, '.clearButton')),
      (d) => type(d, 'min'),
      (d) => click(helper(d, 2)),
      (d) => click($(d, '.clearButton')),
    ]);
  });

  it('keeps the reset backup across closing and reopening', async () => {
    await replay(roles, [
      toggle,
      (d) => click(row(d, 0)),
      toggle,
      toggle,
      (d) => click(row(d, 1)),
      (d) => click(helper(d, 2)),
    ]);
  });
});

describe('MultiSelect filter', () => {
  it('filters case-insensitively by substring, trims, keeps input order and clears with the button', async () => {
    await replay(roles, [
      toggle,
      (d) => type(d, 'E'),
      (d) => type(d, 'ER'),
      (d) => type(d, ' er '),
      (d) => type(d, 'xyz'),
      (d) => click($(d, '.clearButton')),
    ]);
  });

  it('matches every row through the hidden properties the directive puts on the items', async () => {
    // `0` hits the spacing property, `obj`/`C` hit ng-repeat's `$$hashKey` ("object:<uid>").
    const vue = await replay(roles, [
      toggle,
      (d) => type(d, 'obj'),
      (d) => type(d, 'Admin'),
      (d) => type(d, '0'),
      (d) => type(d, 'c'),
    ]);
    expect((vue[2].dom as Any).children[0].children[1].children[1].children).toHaveLength(4);
  });

  it('clears the filter on reopen but not on close', async () => {
    await replay(roles, [toggle, (d) => type(d, 'gu'), toggle, () => click(document.body), toggle]);
  });

  it('keeps a filter left over from closing through the button', async () => {
    await replay(roles, [toggle, (d) => type(d, 'ad'), toggle, (d) => click(row(d, 0))]);
  });
});

describe('MultiSelect input model replaced from outside', () => {
  it('rebuilds list, label, output and reset backup', async () => {
    await replay(roles, [
      toggle,
      (d) => click(row(d, 1)),
      (d) =>
        d.setInput([
          { role: 'X', selected: false },
          { role: 'Y', selected: true },
        ]),
      (d) => click(row(d, 0)),
      (d) => click(helper(d, 2)),
    ]);
  });

  // Deviation: the directive kept the list, label, reset backup and output of the previous input model here,
  // so a dialog reused for another item showed and returned that item's roles.
  for (const [name, value] of [
    ['undefined', undefined],
    ['null', null],
  ] as const) {
    it(`clears list, label, output and reset backup when the input model becomes ${name}`, async () => {
      const previous = roles();
      const d = vueDriver(previous);
      await settle();
      toggle(d);
      type(d, 'ed');
      toggle(d);
      await settle();
      await d.setInput(value);
      expect(mainButton(d).textContent).toBe('None Selected');
      expect($$(d, '.multiSelectItem')).toHaveLength(0);
      expect(d.output()).toEqual([]);

      toggle(d);
      await settle();
      expect($(d, '.checkboxLayer').classList.contains('show')).toBe(true);
      expect($$(d, '.multiSelectItem')).toHaveLength(0);
      click(helper(d, 0));
      click(helper(d, 2));
      await settle();
      expect(d.output()).toEqual([]);
      expect(mainButton(d).textContent).toBe('None Selected');
      expect(flags(previous)).toEqual(flags(roles()));

      // A later input model gets its own backup: Reset restores its ticks, not those of `previous`.
      await d.setInput([
        { role: 'X', selected: false },
        { role: 'Y', selected: true },
      ]);
      click(helper(d, 0));
      click(helper(d, 2));
      await settle();
      expect(d.output()).toEqual([{ role: 'Y', selected: true }]);
      d.destroy();
    });
  }

  it('follows the filter that is active while the input model is replaced', async () => {
    await replay(roles, [
      toggle,
      (d) => type(d, 'e'),
      () => click(document.body),
      (d) => d.setInput([...roles(), { role: 'Zed', selected: true }]),
      toggle,
      (d) => click(row(d, 4)),
      (d) => click(helper(d, 2)),
    ]);
  });
});

describe('MultiSelect keyboard', () => {
  it('walks helpers, filter, clear button and checkboxes with arrows and Tab, with wrap-around', async () => {
    const steps: Step[] = [toggle];
    for (const code of [40, 39, 9, 40, 40, 40, 40, 40, 38, 37]) steps.push(() => key(code));
    steps.push(() => key(9, true));
    steps.push(() => key(9, true));
    await replay(roles, steps);
  });

  it('wraps backwards from the first helper to the last checkbox', async () => {
    await replay(roles, [toggle, () => key(38), () => key(38), () => key(38), () => key(38), () => key(38)]);
  });

  it('closes on Escape, blurs and focuses the button', async () => {
    const prevented: boolean[] = [];
    await replay(roles, [toggle, () => key(40), () => key(40), () => prevented.push(key(27).defaultPrevented), () => key(40)]);
    // Escape is intercepted; the directive did the same.
    expect(prevented).toEqual([true]);
  });

  it('leaves Space, Enter and other keys to the browser', async () => {
    // Space on a focused checkbox or button clicks it natively; jsdom does not synthesise that click,
    // so only the "not intercepted" part is comparable here.
    const prevented: boolean[] = [];
    await replay(roles, [
      toggle,
      () => key(40),
      () => key(40),
      () => prevented.push(key(32).defaultPrevented),
      () => prevented.push(key(13).defaultPrevented),
      () => prevented.push(key(65).defaultPrevented),
    ]);
    expect(prevented).toEqual([false, false, false]);
  });

  it('does not listen while closed', async () => {
    const prevented: boolean[] = [];
    await replay(roles, [toggle, toggle, () => prevented.push(key(40).defaultPrevented)]);
    expect(prevented).toEqual([false]);
  });

  it('runs a row click and the keyboard on the same tab index', async () => {
    await replay(roles, [toggle, (d) => click(row(d, 2)), () => key(40), () => key(38), () => key(38)]);
  });

  it('drops the focus class when the filter removes the row', async () => {
    await replay(roles, [toggle, () => key(40), () => key(40), (d) => type(d, 'gu'), (d) => click($(d, '.clearButton'))]);
  });
});

describe('MultiSelect labels as text', () => {
  it('renders role names as text, not as HTML', async () => {
    // Deviation: the directive binds labels with ng-bind-html; role names are plain text from the server.
    const d = vueDriver([{ role: '<b>x</b>', selected: true }]);
    await settle();
    expect($(d, '.buttonLabel').textContent).toBe(' <b>x</b>');
    expect($(d, '.multiSelectItem label span').textContent).toBe(' <b>x</b>');
    expect(d.root.querySelector('b')).toBeNull();
    d.destroy();
  });

  it('renders ordinary role names exactly like the directive', async () => {
    await replay(
      () => [
        { role: 'R&D', selected: true },
        { role: 'Team Lead', selected: false },
      ],
      [toggle],
    );
  });
});
