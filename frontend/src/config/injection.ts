import { inject, provide, type InjectionKey } from 'vue';
import type { FileManagerConfig } from './types.ts';

const CONFIG_KEY: InjectionKey<FileManagerConfig> = Symbol('fileManagerConfig');

/** Makes the configuration available to all descendants of the calling component. */
export function provideConfig(config: FileManagerConfig): void {
  provide(CONFIG_KEY, config);
}

/** Returns the provided configuration; throws when no ancestor called `provideConfig`. */
export function useConfig(): FileManagerConfig {
  const config = inject(CONFIG_KEY, undefined);
  if (!config) {
    throw new Error('useConfig() was called without a configuration; call provideConfig() in an ancestor component first.');
  }
  return config;
}
