import { describe, expect, it } from 'vitest';
import { Chmod } from '../../src/models/Chmod.ts';
import { legacyModels } from '../utils/legacy.ts';

const { Chmod: LegacyChmod } = legacyModels({});

describe('Chmod', () => {
  it.each([
    ['644', 'rw-r--r--', '644'],
    ['0755', 'rwxr-xr-x', '755'],
    [644, 'rw-r--r--', '644'],
    ['rwxr-xr-x', 'rwxr-xr-x', '755'],
    ['drwxr-xr-x', 'rwxr-xr-x', '755'],
    [' r w x r-x r-x ', 'rwxr-xr-x', '755'],
    ['rwsr-xr-t', 'rw-r-xr-x', '655'], // setuid 's' does not count as exec, 't' does
  ])('parses %s', (input, code, octal) => {
    const chmod = new Chmod(input);
    expect(chmod.toCode()).toBe(code);
    expect(chmod.toOctal()).toBe(octal);
  });

  it('exposes the rwx flags per class', () => {
    const chmod = new Chmod('640');
    expect(chmod.owner).toEqual({ read: true, write: true, exec: false });
    expect(chmod.group).toEqual({ read: true, write: false, exec: false });
    expect(chmod.others).toEqual({ read: false, write: false, exec: false });
  });

  it('starts with every flag off when there is no input', () => {
    expect(new Chmod().toCode()).toBe('---------');
    expect(new Chmod(undefined).toOctal()).toBe('000');
    expect(new Chmod(null).toCode()).toBe('---------');
  });

  it('treats falsy input, including the number 0, as no input', () => {
    expect(new Chmod(0).toCode()).toBe('---------');
    expect(new Chmod('').toCode()).toBe('---------');
  });

  it('prepends and appends around the code', () => {
    expect(new Chmod('755').toCode('d', '!')).toBe('drwxr-xr-x!');
    expect(new Chmod('755').toOctal('0', '#')).toBe('0755#');
  });

  it('throws the legacy message for invalid input', () => {
    expect(() => new Chmod('999')).toThrow('Invalid chmod input data (999)');
    expect(() => new Chmod('rwxrwx')).toThrow('Invalid chmod input data (rwxrwx)');
  });

  it('drops the first character of a ten character code, whatever it is', () => {
    expect(new Chmod('xrwxr-xr-x').toCode()).toBe('rwxr-xr-x');
  });

  it('keeps the last three digits of a four digit octal value, whatever the first is', () => {
    expect(new Chmod('9755').toOctal()).toBe('755');
    expect(() => new Chmod('77777')).toThrow();
  });

  it('matches the legacy service over a table of inputs', () => {
    const inputs: unknown[] = ['644', '0755', 644, 755, '1777', 'rwxr-xr-x', 'drwxr-xr-x', '---------', 'rwsrwsrwt', '', 0, null, undefined, '999', 'abc', ' 6 4 4 ', '9755', 'rwxrwxrwxx', '1e2', true];
    for (const input of inputs) {
      let expected: { code: string; octal: string } | string;
      try {
        const legacy = new LegacyChmod(input);
        expected = { code: legacy.toCode(), octal: legacy.toOctal() };
      } catch (error) {
        expected = (error as Error).message;
      }
      let actual: { code: string; octal: string } | string;
      try {
        const chmod = new Chmod(input as string);
        actual = { code: chmod.toCode(), octal: chmod.toOctal() };
      } catch (error) {
        actual = (error as Error).message;
      }
      expect(actual, String(input)).toEqual(expected);
    }
  });
});
