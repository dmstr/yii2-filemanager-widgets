/**
 * Drop zone behaviour of the whole widget (F-70), ported from what the
 * legacy `ngf-drop` directive of ng-file-upload 12.2.13 did with
 * `ngf-drag-over-class="'upload-dragover'"` and `ngf-multiple="true"`: the
 * class is set on dragover, removed 1 ms after dragleave (so moving between
 * child elements does not flicker, a following dragover cancels the removal)
 * and at once on drop; dropped directories are walked recursively; files
 * pasted into the widget are taken like dropped ones.
 *
 * One deliberate difference: the legacy directive reacted to every drag,
 * this one only to drags that carry files, as the brief asks.
 */
import { ref } from 'vue';

const LEAVE_DELAY_MS = 1;

const carriesFiles = (transfer: DataTransfer | null | undefined): boolean => !!transfer && Array.from(transfer.types ?? []).includes('Files');

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

/** Event handlers for the drop zone element and the flag that drives its `upload-dragover` class. */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const dragOver = ref(false);
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;

  function deliver(transfer: DataTransfer | null | undefined): void {
    void collectFiles(transfer).then((files) => {
      if (files.length) {
        onFiles(files);
      }
    });
  }

  function onDragOver(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      const allowed = event.dataTransfer.effectAllowed;
      event.dataTransfer.dropEffect = allowed === 'move' || allowed === 'linkMove' ? 'move' : 'copy';
    }
    clearTimeout(leaveTimer);
    dragOver.value = true;
  }

  function onDragEnter(event: DragEvent): void {
    if (carriesFiles(event.dataTransfer)) {
      event.preventDefault();
    }
  }

  function onDragLeave(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    leaveTimer = setTimeout(() => {
      dragOver.value = false;
    }, LEAVE_DELAY_MS);
  }

  function onDrop(event: DragEvent): void {
    if (!carriesFiles(event.dataTransfer)) {
      return;
    }
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
