import { describe, expect, it } from 'vitest';
import { createDefaults } from '../../src/config/defaults.ts';
import { readGlobalConfig, resolveConfig } from '../../src/config/resolve.ts';
import { angularMerge } from '../utils/legacy.ts';

describe('resolveConfig', () => {
  it('yields the defaults for undefined input', () => {
    expect(resolveConfig(undefined)).toEqual(createDefaults());
    expect(resolveConfig(null)).toEqual(createDefaults());
  });

  it('ignores non-object input like angular.merge', () => {
    expect(resolveConfig('nonsense')).toEqual(createDefaults());
    expect(resolveConfig(42)).toEqual(createDefaults());
  });

  it('returns a fresh copy each time', () => {
    const a = resolveConfig(undefined);
    a.allowedActions.upload = false;
    a.appName = 'changed';
    expect(resolveConfig(undefined).allowedActions.upload).toBe(true);
    expect(resolveConfig(undefined).appName).toBe('angular-filemanager v1.5');
  });

  it('has the legacy default values', () => {
    const config = resolveConfig(undefined);
    expect(config.defaultLang).toBe('en');
    expect(config.listUrl).toBe('bridges/php/handler.php');
    expect(config.pickCallback).toBeNull();
    expect(config.enableThumbnails).toBe(true);
    expect(config.enableIconPreviewView).toBe(false);
    expect(config.allowedActions.pickFiles).toBe(false);
    expect(config.allowedActions.customFileActions).toBe(false);
    expect(config.hidePermissions).toBeUndefined();
    expect(Object.keys(config)).not.toContain('tplPath');
    expect(config.isImageFilePattern.test('A.JPEG')).toBe(true);
    expect(config.isEditableFilePattern.test('x.php7')).toBe(false);
    expect(config.isEditableFilePattern.test('x.php5')).toBe(true);
  });

  it('merges nested allowedActions without dropping siblings', () => {
    const config = resolveConfig({ allowedActions: { rename: false, pickFiles: true }, appName: 'My Files' });
    expect(config.allowedActions.rename).toBe(false);
    expect(config.allowedActions.pickFiles).toBe(true);
    expect(config.allowedActions.upload).toBe(true);
    expect(config.appName).toBe('My Files');
  });

  it('takes options only PHP or templates know', () => {
    const config = resolveConfig({ hidePermissions: true, hideSize: true, hideDate: true, editUrl: '/edit' });
    expect(config.hidePermissions).toBe(true);
    expect(config.hideSize).toBe(true);
    expect(config.hideDate).toBe(true);
    expect(config.editUrl).toBe('/edit');
  });

  it('keeps function values by reference, in the root and in nested objects', () => {
    const pick = () => undefined;
    const action = () => undefined;
    const config = resolveConfig({ pickCallback: pick, allowedActions: { customFileActions: { Open: action, Named: 'globalFn' } } });
    expect(config.pickCallback).toBe(pick);
    expect(config.allowedActions.customFileActions).toEqual({ Open: action, Named: 'globalFn' });
    expect((config.allowedActions.customFileActions as Record<string, unknown>).Open).toBe(action);
  });

  it('merges a custom action record over the default false', () => {
    const config = resolveConfig({ allowedActions: { customDirActions: { Zip: 'zipIt' } } });
    expect(config.allowedActions.customDirActions).toEqual({ Zip: 'zipIt' });
  });

  it('lets false switch a custom action record off again', () => {
    expect(resolveConfig({ allowedActions: { customFileActions: false } }).allowedActions.customFileActions).toBe(false);
  });

  it('replaces defaults with null and undefined like angular.merge does', () => {
    const config = resolveConfig({ pickCallback: undefined, appName: null });
    expect(config.pickCallback).toBeUndefined();
    expect(config.appName).toBeNull();
  });

  describe('pattern options', () => {
    it('passes RegExp values through as equivalent expressions', () => {
      const config = resolveConfig({ isImageFilePattern: /\.webp$/i });
      expect(config.isImageFilePattern).toBeInstanceOf(RegExp);
      expect(config.isImageFilePattern.source).toBe('\\.webp$');
      expect(config.isImageFilePattern.flags).toBe('i');
    });

    it('converts strings in literal notation', () => {
      const config = resolveConfig({
        isImageFilePattern: '/\\.(jpe?g|png)$/i',
        isEditableFilePattern: '/\\.(!)/i',
        isExtractableFilePattern: '/^a\\/b\\.zip$/',
      });
      expect(config.isImageFilePattern.test('x.JPG')).toBe(true);
      expect(config.isImageFilePattern.test('x.gif')).toBe(false);
      expect(config.isImageFilePattern.flags).toBe('i');
      expect(config.isEditableFilePattern.test('anything.txt')).toBe(false);
      expect(config.isExtractableFilePattern.source).toBe('^a\\/b\\.zip$');
      expect(config.isExtractableFilePattern.flags).toBe('');
    });

    it('splits pattern and flags at the last slash', () => {
      const config = resolveConfig({ isImageFilePattern: '/a/b/gi' });
      expect(config.isImageFilePattern.source).toBe('a\\/b');
      expect(config.isImageFilePattern.flags).toBe('gi');
    });

    it.each(['isImageFilePattern', 'isEditableFilePattern', 'isExtractableFilePattern'])('throws naming %s for a string that is not a literal', (option) => {
      expect(() => resolveConfig({ [option]: 'png|jpg' })).toThrow(option);
      expect(() => resolveConfig({ [option]: '' })).toThrow(option);
      expect(() => resolveConfig({ [option]: '/' })).toThrow(option);
      expect(() => resolveConfig({ [option]: '/abc' })).toThrow(option);
    });

    it('throws naming the option for a literal with an invalid body or flags', () => {
      expect(() => resolveConfig({ isImageFilePattern: '/(/' })).toThrow('isImageFilePattern');
      expect(() => resolveConfig({ isImageFilePattern: '/a/zz' })).toThrow('isImageFilePattern');
    });
  });

  describe('against the real angular.merge', () => {
    const inputs: unknown[] = [
      {},
      { appName: 'x', allowedActions: { rename: false } },
      { allowedActions: { customFileActions: { A: 'a', B: 'b' } } },
      { pickCallback: undefined, sidebar: null },
      { allowedActions: { changePermissions: false, pickFolders: true }, hidePermissions: true },
      { allowedActions: { customDirActions: ['x', 'y'] } },
      { isImageFilePattern: /\.x$/gi },
    ];

    it('produces the same configuration as the legacy integration', () => {
      for (const input of inputs) {
        const expected = angularMerge(createDefaults(), input);
        expect(resolveConfig(input), JSON.stringify(input)).toEqual(expected);
      }
    });
  });
});

describe('readGlobalConfig', () => {
  it('resolves window.fileManagerConfig', () => {
    window.fileManagerConfig = { appName: 'From Window', isImageFilePattern: '/\\.png$/' };
    try {
      const config = readGlobalConfig();
      expect(config.appName).toBe('From Window');
      expect(config.isImageFilePattern.test('a.png')).toBe(true);
    } finally {
      delete window.fileManagerConfig;
    }
  });

  it('yields the defaults when the global is missing', () => {
    delete window.fileManagerConfig;
    expect(readGlobalConfig()).toEqual(createDefaults());
  });
});
