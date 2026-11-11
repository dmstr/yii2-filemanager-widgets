/**
 * Tracks which modals are open and in which order. It replaces the
 * `$('#id').modal('show' | 'hide')` calls and holds state only; the
 * components render from it. The stack lets the destination selector sit on
 * top of the move/copy dialog (Q-32): closing it reveals the dialog below.
 */
import { computed, reactive, type ComputedRef } from 'vue';

export interface ModalManager {
  /** Ids of the open modals, bottom first. */
  readonly stack: readonly string[];
  /** Id of the topmost open modal. */
  readonly top: string | undefined;
  /** Opens a modal on top; a modal that is already open keeps its place, as Bootstrap ignores a second `show`. */
  open(id: string): void;
  /** Closes a modal wherever it is in the stack; closing one that is not open does nothing. */
  close(id: string): void;
  isOpen(id: string): boolean;
}

export function createModalManager(): ModalManager {
  const state = reactive({ stack: [] as string[] });
  const top: ComputedRef<string | undefined> = computed(() => state.stack[state.stack.length - 1]);

  return reactive({
    stack: computed(() => state.stack),
    top,
    open(id: string): void {
      if (!state.stack.includes(id)) {
        state.stack.push(id);
      }
    },
    close(id: string): void {
      const index = state.stack.indexOf(id);
      if (index !== -1) {
        state.stack.splice(index, 1);
      }
    },
    isOpen(id: string): boolean {
      return state.stack.includes(id);
    },
  }) as unknown as ModalManager;
}
