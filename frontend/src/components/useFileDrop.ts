/**
 * Drop zone behaviour of the whole widget (F-70), ported from what the
 * legacy `ngf-drop` directive of ng-file-upload 12.2.13 did with
 * `ngf-drag-over-class="'upload-dragover'"` and `ngf-multiple="true"`:
 *
 * - every drag reacts, whatever it carries: the class is set on dragover,
 *   removed 1 ms after dragleave (so moving between child elements does not
 *   flicker, a following dragover cancels the removal) and at once on drop;
 * - `dropEffect` is only set in Chrome (the directive tests the user agent
 *   for "Chrome"): `move` when `effectAllowed` is `move` or `linkMove`,
 *   otherwise `copy`;
 * - a drop or paste hands its files to the callback, directories are walked
 *   recursively;
 * - without files, `<img src="...">` in the transfer's `text/html` is fetched
 *   and handed over as blobs, see `imagesOf`; when that yields nothing the
 *   callback is not called (Q-49, the directive called it with an empty list).
 *   Paste is never prevented, so text still pastes into fields.
 */
import { ref } from 'vue';

const LEAVE_DELAY_MS = 1;

/** The directive sets `dropEffect` only when the user agent mentions Chrome (also true for Chromium-based Edge). */
const setsDropEffect = (): boolean => navigator.userAgent.indexOf('Chrome') > -1;

/** All files below a dropped directory, depth first. */
async function readDirectory(directory: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = [];
  // `readEntries` returns at most one batch per call; an empty batch ends the listing.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) {
      break;
    }
    entries.push(...batch);
  }
  const files: File[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      files.push(...(await readDirectory(entry as FileSystemDirectoryEntry)));
    } else {
      files.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    }
  }
  return files;
}

/**
 * Files of a drop or paste. The item list is only valid while the event is
 * dispatched, so everything is read from it before the first `await`.
 */
export async function collectFiles(transfer: DataTransfer | null | undefined): Promise<File[]> {
  if (!transfer) {
    return [];
  }
  const files: File[] = [];
  const directories: FileSystemDirectoryEntry[] = [];
  if (transfer.items && transfer.items.length > 0 && window.location.protocol !== 'file:') {
    for (const item of Array.from(transfer.items)) {
      const entry = item.webkitGetAsEntry?.();
      if (entry && entry.isDirectory) {
        directories.push(entry as FileSystemDirectoryEntry);
        continue;
      }
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  } else if (transfer.files) {
    for (const file of Array.from(transfer.files)) {
      if (file.type || file.size > 0) {
        files.push(file);
      }
    }
  }
  for (const directory of directories) {
    files.push(...(await readDirectory(directory)));
  }
  return files;
}

/** The directive's pattern for image tags; only double-quoted `src` values are found, and they are not entity-decoded. */
const IMG_SRC = /<(img src|img [^>]* src) *="([^"]*)"/gi;

/**
 * The `text/html` of a transfer, or `undefined` when it cannot be read.
 * It has to be read while the event is dispatched, like the item list.
 */
function htmlOf(transfer: DataTransfer | null | undefined): string | undefined {
  try {
    const html = transfer?.getData?.('text/html');
    return typeof html === 'string' ? html : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches one image URL as a blob the way the directive's `urlToBlob` does:
 * the content type of the response (`image/WebP` when it has none) and the
 * last path segment of the URL as name. A URL without any `/` (a bare
 * `a.png`) fails there, which stalls the whole drop; the rejection reproduces
 * that visible result.
 */
async function urlToBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  const blob = new Blob([bytes], { type: response.headers.get('content-type') || 'image/WebP' });
  const name = url.match(/.*\/(.+?)(\?.*)?$/);
  if (!name) {
    throw new Error(`No file name in ${url}`);
  }
  return Object.assign(blob, { name: name[1] });
}

/**
 * Images named in dragged or pasted HTML (for example an image dragged from
 * another web page in a browser that offers no file for it). Resolves with
 * the blobs in the order their downloads finished, as the directive collects
 * them; if any download fails nothing is delivered (the directive's promise
 * is rejected and nobody handles it). Without images the list is empty.
 */
async function imagesOf(html: string): Promise<Blob[]> {
  const urls = Array.from(html.matchAll(IMG_SRC), (match) => match[2]);
  const blobs: Blob[] = [];
  await Promise.all(urls.map((url) => urlToBlob(url).then((blob) => void blobs.push(blob))));
  return blobs;
}

/** Event handlers for the drop zone element and the flag that drives its `upload-dragover` class. */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const dragOver = ref(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  function deliver(transfer: DataTransfer | null | undefined): void {
    const html = htmlOf(transfer);
    collectFiles(transfer)
      .then(async (files) => {
        if (!files.length && html !== undefined) {
          files = (await imagesOf(html)) as File[];
        }
        // Q-49: deliberate fix, the directive called the handler with an empty list here, opening the upload dialog.
        if (files.length) {
          onFiles(files);
        }
      })
      .catch(() => {
        // The directive drops a failed read or download without a trace as well (its promise is
        // rejected and unhandled): nothing is added and the dialog stays closed.
      });
  }

  function onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && setsDropEffect()) {
      const allowed = event.dataTransfer.effectAllowed;
      event.dataTransfer.dropEffect = allowed === 'move' || allowed === 'linkMove' ? 'move' : 'copy';
    }
    clearTimeout(leaveTimer);
    dragOver.value = true;
  }

  function onDragEnter(event: DragEvent): void {
    event.preventDefault();
  }

  function onDragLeave(event: DragEvent): void {
    event.preventDefault();
    leaveTimer = setTimeout(() => {
      dragOver.value = false;
    }, LEAVE_DELAY_MS);
  }

  function onDrop(event: DragEvent): void {
    event.preventDefault();
    clearTimeout(leaveTimer);
    dragOver.value = false;
    deliver(event.dataTransfer);
  }

  function onPaste(event: ClipboardEvent): void {
    deliver(event.clipboardData);
  }

  return { dragOver, onDragOver, onDragEnter, onDragLeave, onDrop, onPaste };
}
