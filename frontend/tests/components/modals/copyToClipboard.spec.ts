import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '../../../src/components/modals/copyToClipboard.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  Reflect.deleteProperty(document, 'execCommand');
});

function makeInput(value = 'http://example.test/a?b=c'): HTMLInputElement {
  const input = document.createElement('input');
  input.value = value;
  document.body.append(input);
  return input;
}

/** jsdom has no `execCommand`; it is defined here and removed afterwards. */
function stubExecCommand(result: boolean | Error): ReturnType<typeof vi.fn> {
  const exec = vi.fn(() => {
    if (result instanceof Error) throw result;
    return result;
  });
  Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
  return exec;
}

describe('copyToClipboard', () => {
  it('selects the whole value and leaves focus and selection in place, as clipboard.js did', async () => {
    const input = makeInput();
    stubExecCommand(true);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    await copyToClipboard(input);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  });

  it('writes through navigator.clipboard when available and skips execCommand', async () => {
    const input = makeInput('hello');
    const exec = stubExecCommand(true);
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyToClipboard(input)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(exec).not.toHaveBeenCalled();
  });

  it('falls back to execCommand when the Clipboard API is missing', async () => {
    const input = makeInput('hello');
    const exec = stubExecCommand(true);
    vi.stubGlobal('navigator', {});
    await expect(copyToClipboard(input)).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when writeText is refused', async () => {
    const input = makeInput('hello');
    const exec = stubExecCommand(true);
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } });
    await expect(copyToClipboard(input)).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('resolves false when execCommand fails or throws', async () => {
    vi.stubGlobal('navigator', {});
    stubExecCommand(false);
    await expect(copyToClipboard(makeInput())).resolves.toBe(false);
    stubExecCommand(new Error('unsupported'));
    await expect(copyToClipboard(makeInput())).resolves.toBe(false);
  });

  it('resolves false without an input', async () => {
    await expect(copyToClipboard(null)).resolves.toBe(false);
    await expect(copyToClipboard(undefined)).resolves.toBe(false);
  });
});
