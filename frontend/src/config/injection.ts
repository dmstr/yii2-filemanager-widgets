import { inject, provide, type InjectionKey } from 'vue';
import type { FileManagerConfig } from './types.ts';

/** Injection key under which the app provides its resolved configuration. */
export const configKey: InjectionKey<FileManagerConfig> = Symbol('fileManagerConfig');

/** Makes the configuration available to all descendants of the calling component. */
export function provideConfig(config: FileManagerConfig): void {
  provide(configKey, config);
}

/** Returns the provided configuration; throws when no ancestor called `provideConfig`. */
export function useConfig(): FileManagerConfig {
  const config = inject(configKey, undefined);
  if (!config) {
    throw new Error('useConfig() was called without a configuration; call provideConfig() in an ancestor component first.');
  }
  return config;
}
