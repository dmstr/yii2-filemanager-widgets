/** Shared shape of the pieces `createFileManager` composes. */
import type { FileManagerConfig } from '../../config/types.ts';
import type { I18n } from '../../i18n/index.ts';
import { noop } from '../../utils/noop.ts';
import type { Api } from '../api.ts';
import type { ModalManager } from '../modals.ts';
import type { Navigator } from '../navigator.ts';
import type { createDestination } from './destination.ts';
import type { createSelection } from './selection.ts';

/** Legacy `modal(id, hide)`: opens or closes a modal and clears the dialog error state. */
export type ModalFn = (id: string, hide?: boolean) => true;

/** What the action modules need from the factory. */
export interface FileManagerContext {
  config: FileManagerConfig;
  i18n: I18n;
  /** The instance whose `error` and `inprocess` the dialogs show. */
  api: Api;
  navigator: Navigator;
  modals: ModalManager;
  selection: ReturnType<typeof createSelection>;
  destination: ReturnType<typeof createDestination>;
  modal: ModalFn;
}

/**
 * Runs `ok` or `fail` once the promise settles and swallows the rejection.
 * The legacy controller registered no rejection handlers for most calls; the
 * error is already on `api.error` by then.
 */
export function settled<T>(promise: Promise<T>, ok: (value: T) => void, fail: (reason: unknown) => void = noop): void {
  promise.then(ok, fail).catch((error: unknown) => console.error(error));
}
