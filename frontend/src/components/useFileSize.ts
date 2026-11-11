import { useConfig } from '../config/injection.ts';
import { humanReadableFileSize } from '../utils/format.ts';

/** `sizeOf(size)` for the item titles and size columns: the size formatted per `useBinarySizePrefixes`. */
export function useFileSize(): (size: number | null | undefined) => string {
  const config = useConfig();
  return (size) => humanReadableFileSize(size as number, config.useBinarySizePrefixes);
}
