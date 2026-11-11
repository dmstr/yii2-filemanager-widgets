/**
 * Copy helper of the link dialog, replacing `ngclipboard` / clipboard.js
 * 1.5.16 for a `data-clipboard-target` input.
 */

/** The `document.execCommand('copy')` path of clipboard.js; false when the command is unsupported or throws. */
function copyWithExecCommand(): boolean {
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

/**
 * Selects the whole content of an input and copies it. Like clipboard.js
 * (which did not clear anything unless asked to) the input keeps focus and
 * its selection afterwards, so the user sees what was copied. The text goes
 * through `navigator.clipboard.writeText` when the browser offers it and
 * falls back to `execCommand('copy')` otherwise or when writing is refused.
 * Resolves with whether the copy worked.
 */
export function copyToClipboard(input: HTMLInputElement | null | undefined): Promise<boolean> {
  if (!input) {
    return Promise.resolve(false);
  }
  input.focus();
  input.setSelectionRange(0, input.value.length);
  const text = input.value;
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => copyWithExecCommand(),
    );
  }
  return Promise.resolve(copyWithExecCommand());
}
