/**
 * Folder navigation state: current path, the listed items and the lazily
 * grown folder tree. Port of the AngularJS `fileNavigator`; every navigator owns
 * its API instance, so the main list and the destination dialog never share
 * loading or error state.
 */
import { reactive } from 'vue';
import type { FileManagerConfig } from '../config/types.ts';
import type { I18n } from '../i18n/index.ts';
import { Item } from '../models/Item.ts';
import { noop } from '../utils/noop.ts';
import { createApi, settleDeferred, type DeferredHandler } from './api.ts';

/** One node of the sidebar tree; the root node has no `item`. */
export interface TreeNode {
  item?: Item;
  name: string;
  nodes: TreeNode[];
}

export interface Navigator {
  requesting: boolean;
  fileList: Item[];
  currentPath: string[];
  history: TreeNode[];
  error: string;
  /**
   * Called after every successful refresh; the file manager hooks its selection reset in here.
   * `keepState` is set for a reload that must not disturb an open dialog.
   */
  onRefresh: (keepState: boolean) => void;
  /** `keepState` reloads the list without the `onRefresh` reset of selection and search. */
  refresh(recycle?: boolean, keepState?: boolean): Promise<void>;
  buildTree(path: string): void;
  folderClick(item?: Item): void;
  upDir(): void;
  goTo(index: number): void;
  fileNameExists(fileName: string): Item | undefined;
  listHasFolders(): Item | undefined;
}

/** Creates a navigator with its own API client. */
export function createNavigator(config: FileManagerConfig, i18n: I18n): Navigator {
  const api = createApi(config, i18n);
  // Assigned right below; the functions only run after that.
  let nav: Navigator;

  /** The navigator's own variant of `deferredHandler`: it writes to `nav.error` and keeps an error that is already set. */
  const deferredHandler: DeferredHandler = (data, deferred, code, defaultMsg) =>
    settleDeferred(nav, data, deferred, code, defaultMsg, false);

  function buildTree(path: string): void {
    const flatNodes: TreeNode[] = [];

    function recursive(parent: TreeNode, item: Item, currentPath: string): void {
      const absName = currentPath ? currentPath + '/' + item.model.name : item.model.name;
      // Q-24: a folder counts as "on the path" when its name appears at the start of the path as plain text.
      if (parent.name.trim() && currentPath.trim().indexOf(parent.name) !== 0) {
        parent.nodes = [];
      }
      if (parent.name !== currentPath) {
        parent.nodes.forEach((node) => recursive(node, item, currentPath));
      } else {
        for (const node of parent.nodes) {
          if (node.name === absName) {
            return;
          }
        }
        parent.nodes.push({ item, name: absName, nodes: [] });
      }

      parent.nodes = parent.nodes.sort((a, b) => {
        const left = a.name.toLowerCase();
        const right = b.name.toLowerCase();
        return left < right ? -1 : left === right ? 0 : 1;
      });
    }

    function flatten(node: TreeNode, array: TreeNode[]): void {
      array.push(node);
      for (const child of node.nodes) {
        flatten(child, array);
      }
    }

    !nav.history.length && nav.history.push({ name: '', nodes: [] });
    flatten(nav.history[0], flatNodes);
    const selectedNode = flatNodes.filter((node) => node.name === path)[0];
    selectedNode && (selectedNode.nodes = []);

    for (const item of nav.fileList) {
      item instanceof Item && item.isFolder() && recursive(nav.history[0], item, path);
    }
  }

  function refresh(recycle?: boolean, keepState = false): Promise<void> {
    const path = nav.currentPath.join('/');
    nav.requesting = true;
    nav.fileList = [];
    // Q-02 fixed: the AngularJS navigator never cleared a failed list's error, so every later refresh failed too.
    nav.error = '';
    const done = api
      .list(nav.currentPath, deferredHandler, recycle)
      .then((data) => {
        nav.fileList = (data.result || []).map((file: object) => new Item(file, nav.currentPath, config));
        buildTree(path);
        nav.onRefresh(keepState);
      })
      .finally(() => {
        nav.requesting = false;
      });
    // Callers may ignore the outcome, as the AngularJS ones all did.
    done.catch(noop);
    return done;
  }

  nav = reactive<Navigator>({
    requesting: false,
    fileList: [],
    currentPath: [],
    history: [],
    error: '',
    onRefresh: noop,

    refresh,
    buildTree,

    folderClick(item) {
      nav.currentPath = [];
      if (item && item.isFolder()) {
        nav.currentPath = item.model.fullPath().split('/').splice(1);
      }
      refresh();
    },

    upDir() {
      if (nav.currentPath[0]) {
        nav.currentPath = nav.currentPath.slice(0, -1);
        refresh();
      }
    },

    goTo(index) {
      nav.currentPath = nav.currentPath.slice(0, index + 1);
      refresh();
    },

    fileNameExists(fileName) {
      return nav.fileList.find((item) => fileName.trim && item.model.name.trim() === fileName.trim());
    },

    listHasFolders() {
      return nav.fileList.find((item) => item.model.type === 'dir');
    },
  });
  return nav;
}
