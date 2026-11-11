import { afterEach, describe, expect, it, vi } from 'vitest';
import MultiSelect from '../../../src/components/MultiSelect.vue';
import ChangePermissionsModal from '../../../src/components/modals/ChangePermissionsModal.vue';
import type { Item } from '../../../src/models/Item.ts';
import { flush, stubFetch, type FakeReply, type RecordedRequest } from '../../services/helpers.ts';
import { diffAgainstRecorded, isHidden, item, recordedContent, mountModal, select, text, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const nextTick = () => app.wrapper.vm.$nextTick();
const selects = () => app.wrapper.findAllComponents(MultiSelect);
const footerButtons = () => app.wrapper.findAll('.modal-footer button');
const submit = () => app.wrapper.find('button[type=submit]');
const roles = (...names: string[]) => names.map((role, i) => ({ role, selected: i === 0 }));
const KEYS = ['authRead', 'authUpdate', 'authDelete'] as const;

describe('ChangePermissionsModal', () => {
  it('has the structure of the recorded template', () => {
    app = mountModal(ChangePermissionsModal);
    expect(diffAgainstRecorded(recordedContent('changepermissions'), app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('renders the three sections with their headings and multi-selects', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a.txt');
    a.model.authRead = roles('admin', 'editor');
    await select(app.fm, a);
    expect(app.wrapper.find('#changepermissions').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('change_permissions'));
    expect(app.wrapper.findAll('.modal-body h4').map((h) => h.text())).toEqual([app.t('read'), app.t('write'), app.t('delete')]);
    expect(selects()).toHaveLength(3);
    expect(selects().every((s) => s.classes('permission-multi-select-button'))).toBe(true);
    expect(app.wrapper.findAll('.modal-body hr')).toHaveLength(3);
    expect(app.wrapper.find('form > input[type=hidden]').attributes('value')).toBeUndefined();
  });

  it('passes the model arrays themselves as input models, stable across re-renders, and keeps the components mounted', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a.txt');
    a.model.authRead = roles('r1');
    a.model.authUpdate = roles('u1');
    a.model.authDelete = roles('d1');
    await select(app.fm, a);
    const elements = selects().map((s) => s.element);
    KEYS.forEach((key, i) => expect(selects()[i].props('inputModel')).toBe(a.model[key]));
    app.fm.api.error = 'x';
    app.fm.api.inprocess = true;
    await nextTick();
    KEYS.forEach((key, i) => expect(selects()[i].props('inputModel')).toBe(a.model[key]));
    expect(selects().map((s) => s.element)).toEqual(elements);
    expect(app.wrapper.find('#changepermissions').element.contains(elements[0])).toBe(true);
  });

  it('hands the output model to the multi-select and writes its updates to tempModel', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a.txt');
    a.model.authRead = roles('r1');
    a.model.authUpdate = roles('u1');
    a.model.authDelete = roles('d1');
    a.tempModel.authUpdate = [{ role: 'u1', selected: true }];
    await select(app.fm, a);
    expect(selects()[1].props('outputModel')).toEqual([{ role: 'u1', selected: true }]);
    for (const [i, key] of KEYS.entries()) {
      const out = [{ role: `${key}-new`, selected: true }];
      selects()[i].vm.$emit('update:outputModel', out);
      expect(a.tempModel[key]).toEqual(out);
    }
    expect(a.model.authRead).toEqual(roles('r1'));
  });

  it('shows null role lists as no roles and writes an empty output to tempModel', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a.txt');
    a.model.authRead = roles('r1');
    await select(app.fm, a);
    a.model.authRead = null;
    a.model.authUpdate = null;
    a.model.authDelete = undefined;
    a.tempModel.authRead = null;
    await nextTick();
    await nextTick();
    expect(selects()).toHaveLength(3);
    expect(selects()[0].props('inputModel')).toBeNull();
    expect(selects()[2].props('inputModel')).toBeUndefined();
    expect(selects().map((s) => text(s.find('.multiSelect > button')))).toEqual(['None Selected', 'None Selected', 'None Selected']);
    expect(selects()[0].findAll('.multiSelectItem')).toHaveLength(0);
    expect(a.tempModel.authRead).toEqual([]);
  });

  it('binds undefined and drops writes without a single selection (empty, several, hole)', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a');
    const b = item('b');
    b.tempModel.authRead = roles('x');
    for (const selection of [[], [a, b], [undefined]]) {
      await expect(select(app.fm, ...selection)).resolves.toBeUndefined();
      expect(selects()).toHaveLength(3);
      for (const s of selects()) {
        expect(s.props('inputModel')).toBeUndefined();
        expect(s.props('outputModel')).toBeUndefined();
      }
      expect(() => selects()[0].vm.$emit('update:outputModel', roles('y'))).not.toThrow();
    }
    expect(b.tempModel.authRead).toEqual(roles('x'));
    expect(a.tempModel.authRead).toBeUndefined();
  });

  it('closes on the cross and on Cancel without refreshing', async () => {
    for (const control of [() => app.wrapper.find('button.close'), () => footerButtons()[0]]) {
      app = mountModal(ChangePermissionsModal);
      app.fm.refreshLocation = vi.fn();
      app.fm.modals.open('changepermissions');
      await control().trigger('click');
      expect(app.fm.modals.isOpen('changepermissions')).toBe(false);
      expect(app.fm.refreshLocation).not.toHaveBeenCalled();
      app.wrapper.unmount();
    }
  });

  it('submits through the form and prevents the native submit', async () => {
    app = mountModal(ChangePermissionsModal);
    app.fm.changePermissions = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.changePermissions).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    await submit().trigger('click');
    expect(app.fm.changePermissions).toHaveBeenCalledTimes(2);
  });

  it('does not disable a button while a request runs and keeps the id submit', async () => {
    app = mountModal(ChangePermissionsModal);
    app.fm.api.inprocess = true;
    await nextTick();
    expect(submit().attributes('id')).toBe('submit');
    expect(text(submit())).toBe(app.t('change'));
    expect(footerButtons().every((b) => b.attributes('disabled') === undefined)).toBe(true);
  });

  it('shows the API error in the error bar', async () => {
    app = mountModal(ChangePermissionsModal);
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(true);
    app.fm.api.error = 'boom';
    await nextTick();
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(false);
    expect(app.wrapper.find('.label-danger span').text()).toBe('boom');
  });
});

describe('ChangePermissionsModal opened through updatePermissions', () => {
  type Reply = FakeReply | (() => FakeReply);
  let requests: RecordedRequest[];
  let replies: Record<string, Reply>;

  const auth = (read: unknown, update: unknown, del: unknown): FakeReply => ({ body: { auth: { read, update, delete: del } } });
  const A = () =>
    auth(
      [
        { role: 'Admin', selected: true },
        { role: 'Editor', selected: false },
      ],
      [{ role: 'Admin', selected: true }],
      [{ role: 'Guest', selected: true }],
    );
  const B = (update: unknown = [{ role: 'Owner', selected: false }]) =>
    auth(
      [{ role: 'Owner', selected: true }],
      update,
      [
        { role: 'Owner', selected: false },
        { role: 'Staff', selected: true },
      ],
    );
  const FAIL: FakeReply = { status: 500, body: {} };

  const settle = async () => {
    for (let i = 0; i < 4; i++) await flush();
  };

  function boot(): void {
    app = mountModal(ChangePermissionsModal);
    replies = {};
    requests = stubFetch((request) => {
      const body = request.body as { action: string; path: string };
      if (body.action !== 'resolvePermissions') return { body: { result: {} } };
      const reply = replies[body.path];
      return typeof reply === 'function' ? reply() : reply;
    });
  }

  /** Selects the item, loads its roles and opens the dialog, as the context menu does. */
  async function open(target: Item, reply: Reply): Promise<void> {
    replies[target.model.fullPath()] = reply;
    await select(app.fm, target);
    app.fm.updatePermissions();
    await settle();
  }

  const cancel = () => footerButtons()[0].trigger('click');
  const labels = () => selects().map((s) => text(s.find('.multiSelect > button')));
  const rows = () => selects().map((s) => s.findAll('.multiSelectItem').map((r) => text(r.find('label'))));
  const error = () => (isHidden(app.wrapper.find('.label-danger').element) ? '' : text(app.wrapper.find('.label-danger span')));

  /** Submits through the form and returns the posted role lists, or undefined when nothing was posted. */
  async function submitted(): Promise<Record<string, unknown> | undefined> {
    requests.length = 0;
    app.wrapper.find('form').element.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const request = requests.find((r) => (r.body as { action: string }).action === 'changePermissions');
    if (!request) return undefined;
    const { authRead, authUpdate, authDelete } = (request.body as { item: Record<string, unknown> }).item;
    return { authRead, authUpdate, authDelete };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows the load error, empty selectors and a disabled submit when the first load fails', async () => {
    boot();
    await open(item('a.txt'), FAIL);
    expect(app.fm.modals.isOpen('changepermissions')).toBe(true);
    expect(app.t('error_get_permissions')).not.toBe('error_get_permissions');
    expect(error()).toBe(app.t('error_get_permissions'));
    expect(labels()).toEqual(['None Selected', 'None Selected', 'None Selected']);
    expect(rows()).toEqual([[], [], []]);
    expect(submit().attributes('disabled')).toBeDefined();
    expect(await submitted()).toBeUndefined();
    expect(app.fm.modals.isOpen('changepermissions')).toBe(true);
  });

  it('leaves nothing of the previous item behind when the load for the next one fails', async () => {
    boot();
    const b = item('b.txt');
    await open(item('a.txt'), A());
    expect(labels()).toEqual(['Admin', 'Admin', 'Guest']);
    await cancel();
    await open(b, FAIL);
    expect(error()).toBe(app.t('error_get_permissions'));
    expect(labels()).toEqual(['None Selected', 'None Selected', 'None Selected']);
    expect(rows()).toEqual([[], [], []]);
    expect([b.tempModel.authRead, b.tempModel.authUpdate, b.tempModel.authDelete]).toEqual([[], [], []]);
    expect(submit().attributes('disabled')).toBeDefined();
    expect(await submitted()).toBeUndefined();
  });

  it('shows an empty selector for a null section, also after another item filled it', async () => {
    boot();
    await open(item('a.txt'), A());
    await cancel();
    await open(item('b.txt'), B(null));
    expect(error()).toBe('');
    expect(labels()).toEqual(['Owner', 'None Selected', 'Staff']);
    expect(rows()).toEqual([['Owner'], [], ['Owner', 'Staff']]);
    expect(submit().attributes('disabled')).toBeUndefined();
    expect(await submitted()).toEqual({
      authRead: [{ role: 'Owner', selected: true }],
      authUpdate: [],
      authDelete: [{ role: 'Staff', selected: true }],
    });
  });

  it('shows and submits the roles of the second item after a successful load for the first', async () => {
    boot();
    await open(item('a.txt'), A());
    expect(await submitted()).toEqual({
      authRead: [{ role: 'Admin', selected: true }],
      authUpdate: [{ role: 'Admin', selected: true }],
      authDelete: [{ role: 'Guest', selected: true }],
    });
    await open(item('b.txt'), B());
    expect(labels()).toEqual(['Owner', 'None Selected', 'Staff']);
    expect(rows()).toEqual([['Owner'], ['Owner'], ['Owner', 'Staff']]);
    expect(await submitted()).toEqual({
      authRead: [{ role: 'Owner', selected: true }],
      authUpdate: [],
      authDelete: [{ role: 'Staff', selected: true }],
    });
  });

  it('enables the submit again once a later load succeeds', async () => {
    boot();
    await open(item('a.txt'), FAIL);
    await cancel();
    await open(item('b.txt'), B());
    expect(error()).toBe('');
    expect(submit().attributes('disabled')).toBeUndefined();
    expect(labels()).toEqual(['Owner', 'None Selected', 'Staff']);
  });

  it('shows the server state again when the dialog is reopened for the same item after a cancelled edit', async () => {
    boot();
    await open(item('a.txt'), A);
    await selects()[0].find('.multiSelect > button').trigger('click');
    await selects()[0].findAll('.multiSelectItem')[1].trigger('click');
    expect(labels()[0]).toBe('Admin, Editor');
    await cancel();
    app.fm.updatePermissions();
    await settle();
    expect(labels()).toEqual(['Admin', 'Admin', 'Guest']);
    expect((await submitted())?.authRead).toEqual([{ role: 'Admin', selected: true }]);
  });
});
