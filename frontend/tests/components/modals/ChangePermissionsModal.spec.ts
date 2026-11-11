import { afterEach, describe, expect, it, vi } from 'vitest';
import MultiSelect from '../../../src/components/MultiSelect.vue';
import ChangePermissionsModal from '../../../src/components/modals/ChangePermissionsModal.vue';
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

  it('copes with null role lists in the model and in the output', async () => {
    app = mountModal(ChangePermissionsModal);
    const a = item('a.txt');
    a.model.authRead = null;
    a.model.authUpdate = null;
    a.model.authDelete = undefined;
    a.tempModel.authRead = null;
    await expect(select(app.fm, a)).resolves.toBeUndefined();
    expect(selects()).toHaveLength(3);
    expect(selects()[0].props('inputModel')).toBeNull();
    expect(selects()[0].props('outputModel')).toBeNull();
    expect(selects()[2].props('inputModel')).toBeUndefined();
    selects()[0].vm.$emit('update:outputModel', []);
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

  it('never disables a button and keeps the id submit', async () => {
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
