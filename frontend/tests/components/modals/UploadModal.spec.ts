import { afterEach, describe, expect, it, vi } from 'vitest';
import UploadModal from '../../../src/components/modals/UploadModal.vue';
import { humanReadableFileSize } from '../../../src/utils/format.ts';
import { diffAgainstRecorded, isHidden, recordedContent, mountModal, text, type MountedModal } from './helpers.ts';

let app: MountedModal;
afterEach(() => app?.wrapper.unmount());

const nextTick = () => app.wrapper.vm.$nextTick();
const makeFile = (name: string, size = 2048) => new File([new Uint8Array(size)], name);
const selectButton = () => app.wrapper.find('.modal-body > button.btn-block');
const rows = () => app.wrapper.findAll('.upload-list li');
const footerButtons = () => app.wrapper.findAll('.modal-footer button');
const cancel = () => footerButtons()[0];
const submit = () => app.wrapper.find('button[type=submit]');
/** The hidden input the dialog teleports to the body, as ng-file-upload did. */
const fileInput = () => document.body.querySelector<HTMLInputElement>('body > label > input[type=file]')!;

/** Fires `change` on the hidden input with the given files. */
function choose(files: File[]): void {
  Object.defineProperty(fileInput(), 'files', { value: files, configurable: true });
  fileInput().dispatchEvent(new Event('change'));
}

describe('UploadModal', () => {
  it('has the structure of the recorded template', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFileList = [makeFile('a.txt'), makeFile('b.txt')];
    await nextTick();
    expect(diffAgainstRecorded(recordedContent('uploadfile'), app.wrapper.find('.modal-content').element, app.t)).toBeNull();
  });

  it('renders title, target path and an empty list', async () => {
    app = mountModal(UploadModal);
    app.fm.navigator.currentPath = ['x', 'y'];
    await nextTick();
    expect(app.wrapper.find('#uploadfile').classes()).toEqual(expect.arrayContaining(['modal', 'animated', 'fadeIn']));
    expect(text(app.wrapper.find('.modal-title'))).toBe(app.t('upload_files'));
    expect(text(app.wrapper.find('.modal-body label.radio'))).toBe(`${app.t('files_will_uploaded_to')} /x/y`);
    expect(text(selectButton())).toBe(app.t('select_files'));
    expect(rows()).toHaveLength(0);
    expect(submit().attributes('disabled')).toBeDefined();
  });

  it('does not depend on the file selection of the manager (empty, several, hole)', async () => {
    app = mountModal(UploadModal);
    for (const temps of [[], [undefined], [undefined, undefined]]) {
      app.fm.temps = temps;
      await expect(nextTick()).resolves.toBeUndefined();
    }
    expect(text(app.wrapper.find('.modal-body label.radio'))).toBe(`${app.t('files_will_uploaded_to')} /`);
  });

  it('lists name and size per file, with binary prefixes when configured', async () => {
    app = mountModal(UploadModal, (config) => {
      config.useBinarySizePrefixes = true;
    });
    app.fm.uploadFileList = [makeFile('a.txt', 2048), makeFile('b.png', 5 * 1024 * 1024)];
    await nextTick();
    expect(rows().map((row) => [row.find('h5').text(), row.find('p').text()])).toEqual([
      ['a.txt', humanReadableFileSize(2048, true)],
      ['b.png', humanReadableFileSize(5 * 1024 * 1024, true)],
    ]);
    expect(rows()[0].find('p').text()).toBe('2.0 KiB');
    expect(rows()[0].find('h5').classes()).toContain('list-group-item-heading');
    expect(submit().attributes('disabled')).toBeUndefined();
  });

  it('removes the clicked entry through removeFromUpload without submitting the form', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFileList = [makeFile('a.txt'), makeFile('b.txt'), makeFile('c.txt')];
    app.fm.uploadFiles = vi.fn();
    await nextTick();
    const remove = vi.spyOn(app.fm, 'removeFromUpload');
    await rows()[1].find('button').trigger('click');
    expect(remove).toHaveBeenCalledWith(1);
    expect(app.fm.uploadFileList.map((f) => f.name)).toEqual(['a.txt', 'c.txt']);
    expect(rows()).toHaveLength(2);
    expect(app.fm.uploadFiles).not.toHaveBeenCalled();
  });

  it('removes the row of the removed file itself, so its button and focus go with it', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFileList = [makeFile('a.txt'), makeFile('b.txt')];
    await nextTick();
    const [first, second] = rows().map((row) => row.element);
    (first.querySelector('button') as HTMLButtonElement).focus();
    await rows()[0].find('button').trigger('click');
    expect(first.isConnected).toBe(false);
    expect(rows()[0].element).toBe(second);
    expect(document.activeElement).toBe(document.body);
  });

  it('shows the percentage and the bar while uploading', async () => {
    app = mountModal(UploadModal);
    const block = () => app.wrapper.find('.upload-list > div');
    expect(isHidden(block().element)).toBe(true);
    app.fm.api.inprocess = true;
    app.fm.api.progress = 42;
    await nextTick();
    expect(isHidden(block().element)).toBe(false);
    expect(text(block().find('em'))).toBe(`${app.t('uploading')}... 42%`);
    const bar = block().find('.progress-bar');
    expect(bar.classes()).toEqual(expect.arrayContaining(['progress-bar', 'active']));
    expect(bar.attributes()).toMatchObject({ role: 'progressbar', 'aria-valuenow': '42', 'aria-valuemin': '0', 'aria-valuemax': '100' });
    expect((bar.element as HTMLElement).style.width).toBe('42%');
    expect(submit().attributes('disabled')).toBeDefined();
  });

  it('keeps its file input outside the dialog, hidden and multiple', () => {
    app = mountModal(UploadModal);
    expect(fileInput()).toBeTruthy();
    expect(fileInput().multiple).toBe(true);
    expect(app.wrapper.find('#uploadfile').element.contains(fileInput())).toBe(false);
    expect(fileInput().parentElement!.style.visibility).toBe('hidden');
    app.wrapper.unmount();
    expect(document.body.querySelector('input[type=file]')).toBeNull();
  });

  it('opens the file dialog from the select button without submitting the form', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFiles = vi.fn();
    const click = vi.spyOn(fileInput(), 'click').mockImplementation(() => {});
    await selectButton().trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    expect(app.fm.uploadFiles).not.toHaveBeenCalled();
  });

  it('passes the chosen files to addForUpload, resets the input and opens the dialog list', async () => {
    app = mountModal(UploadModal);
    const first = makeFile('a.txt');
    const setValue = vi.fn();
    Object.defineProperty(fileInput(), 'value', { set: setValue, get: () => '', configurable: true });
    choose([first]);
    await nextTick();
    expect(app.fm.uploadFileList).toEqual([first]);
    expect(setValue).toHaveBeenCalledWith('');
    expect(app.fm.modals.isOpen('uploadfile')).toBe(true);
    choose([makeFile('b.txt')]);
    await nextTick();
    expect(app.fm.uploadFileList.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(rows()).toHaveLength(2);
  });

  it('reports an emptied selection as an empty list', () => {
    app = mountModal(UploadModal);
    app.fm.addForUpload = vi.fn();
    choose([]);
    expect(app.fm.addForUpload).toHaveBeenCalledWith([]);
  });

  it('reports an empty list on the click after a pick, which clears the dialog error as ng-file-upload did', async () => {
    app = mountModal(UploadModal);
    vi.spyOn(fileInput(), 'click').mockImplementation(() => {});
    choose([makeFile('a.txt')]);
    app.fm.api.error = 'old error';
    await selectButton().trigger('click');
    expect(app.fm.api.error).toBe('');
    expect(app.fm.uploadFileList).toHaveLength(1);
    app.fm.api.error = 'second';
    await selectButton().trigger('click');
    expect(app.fm.api.error).toBe('second');
  });

  it('submits through the form and prevents the native submit', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFiles = vi.fn();
    const event = new Event('submit', { cancelable: true });
    app.wrapper.find('form').element.dispatchEvent(event);
    expect(app.fm.uploadFiles).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    app.fm.uploadFileList = [makeFile('a.txt')];
    await nextTick();
    await submit().trigger('click');
    expect(app.fm.uploadFiles).toHaveBeenCalledTimes(2);
  });

  it('keeps the list when the dialog is cancelled or closed (Q-11), and Cancel is never disabled', async () => {
    app = mountModal(UploadModal);
    app.fm.uploadFileList = [makeFile('a.txt')];
    app.fm.api.inprocess = true;
    await nextTick();
    expect(cancel().attributes('disabled')).toBeUndefined();
    app.fm.modals.open('uploadfile');
    await cancel().trigger('click');
    expect(app.fm.modals.isOpen('uploadfile')).toBe(false);
    expect(app.fm.uploadFileList).toHaveLength(1);
    app.fm.modals.open('uploadfile');
    await app.wrapper.find('button.close').trigger('click');
    expect(app.fm.modals.isOpen('uploadfile')).toBe(false);
    expect(app.fm.uploadFileList).toHaveLength(1);
  });

  it('shows the API error in the error bar', async () => {
    app = mountModal(UploadModal);
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(true);
    app.fm.api.error = 'boom';
    await nextTick();
    expect(isHidden(app.wrapper.find('.label-danger').element)).toBe(false);
    expect(app.wrapper.find('.label-danger span').text()).toBe('boom');
  });
});
