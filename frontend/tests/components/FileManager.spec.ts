import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FileManager from '../../src/components/FileManager.vue';

describe('FileManager', () => {
  it('mounts an empty div', () => {
    const wrapper = mount(FileManager);
    expect(wrapper.element.tagName).toBe('DIV');
  });
});
