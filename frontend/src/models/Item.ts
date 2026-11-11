import type { FileManagerConfig } from '../config/types.ts';
import { deepCopy } from '../utils/copy.ts';
import { Chmod } from './Chmod.ts';

/** One role row of the permissions dialog. */
export interface RoleSelection {
  role: string;
  selected: boolean;
}

/** A list entry as sent by the filefly API; every field may be missing. */
export interface RawItem {
  name?: string;
  thumbnail?: string;
  preview?: string;
  urls?: Record<string, string> | string[];
  extension?: string;
  type?: string;
  size?: number | string;
  date?: string;
  rights?: string | number;
  content?: string;
}

/** The data part of an item; `Item` keeps two independent copies of it. */
export interface ItemModel {
  name: string;
  thumbnail: string;
  preview: string;
  urls: Record<string, string> | string[];
  extension: string;
  path: string[];
  type: string;
  /** `null`/`undefined` only when the item was built without a raw model. */
  size: number | null | undefined;
  date: Date;
  perms: Chmod;
  content: string;
  fullPath(): string;
  // Added by the permissions dialog after the item was created.
  authRead?: RoleSelection[] | null;
  authUpdate?: RoleSelection[] | null;
  authDelete?: RoleSelection[] | null;
}

/** The slice of the configuration an item looks at. */
export interface ItemConfig {
  isEditableFilePattern: RegExp;
  isImageFilePattern: RegExp;
  isExtractableFilePattern: RegExp;
  allowedActions: Pick<FileManagerConfig['allowedActions'], 'pickFiles' | 'pickFolders'>;
}

/**
 * Legacy `parseMySQLDate`: splits on `-`, space and `:` and hands the pieces
 * to the `Date` constructor. A missing or date-only value therefore yields an
 * Invalid Date rather than an error.
 */
function parseMySQLDate(mysqlDate: unknown): Date {
  const d = ((mysqlDate as { toString(): string }) || '').toString().split(/[- :]/);
  return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), Number(d[3]), Number(d[4]), Number(d[5]));
}

/**
 * Reproduces the legacy string building: `replace` with a pattern object
 * only collapses the first double slash, so slash-ended segments in the
 * middle can leave `//` behind.
 */
function fullPath(this: ItemModel): string {
  const path = this.path.filter(Boolean);
  return ('/' + path.join('/') + '/' + this.name).replace(/\/\//, '/');
}

function buildModel(model: RawItem | null | undefined, path?: string[]): ItemModel {
  return {
    name: (model && model.name) || '',
    thumbnail: (model && model.thumbnail) || '',
    preview: (model && model.preview) || '',
    urls: deepCopy((model && model.urls) || []),
    extension: (model && model.extension) || '',
    path: deepCopy(path || []),
    type: (model && model.type) || 'file',
    size: model ? parseInt(String(model.size || 0)) : (model as null | undefined),
    date: parseMySQLDate(model && model.date),
    perms: new Chmod(model && model.rights),
    content: (model && model.content) || '',
    fullPath,
  };
}

/**
 * A file or folder entry. Port of the legacy `item` factory.
 *
 * `model` is the server state, `tempModel` the editable copy the modals
 * bind to; they start as independent deep copies of the same raw model.
 * Only plain public fields are used so that Vue's `reactive()` works on
 * instances. Because a reactive wrapper is a different object than the
 * raw instance, items must be stored and compared in their reactive form
 * (for example inside a reactive array); never mix raw and wrapped items
 * in an identity check.
 */
export class Item {
  error = '';
  processing = false;
  model: ItemModel;
  tempModel: ItemModel;
  readonly config: ItemConfig;

  constructor(model: RawItem | null | undefined, path: string[] | undefined, config: ItemConfig) {
    this.config = config;
    // The legacy factory built one raw model and copied it twice; building
    // it twice gives the same independent copies.
    this.model = buildModel(model, path);
    this.tempModel = buildModel(model, path);
  }

  /** Resets the editable copy to the server state and clears the error. */
  revert(): void {
    Object.assign(this.tempModel, deepCopy(this.model));
    this.error = '';
  }

  isFolder(): boolean {
    return this.model.type === 'dir';
  }

  isEditable(): boolean {
    return !this.isFolder() && this.config.isEditableFilePattern.test(this.model.name);
  }

  isImage(): boolean {
    return this.config.isImageFilePattern.test(this.model.name);
  }

  isExtractable(): boolean {
    return !this.isFolder() && this.config.isExtractableFilePattern.test(this.model.name);
  }

  isSelectable(): boolean {
    const pick = this.config.allowedActions;
    return (this.isFolder() && pick.pickFolders) || (!this.isFolder() && pick.pickFiles);
  }
}
