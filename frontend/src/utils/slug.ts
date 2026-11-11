/**
 * Port of the AngularJS `ApiHandler.prototype.slug`.
 *
 * jQuery's `$.trim` is reproduced with its own pattern, and a `null` or
 * `undefined` input becomes an empty string as it did there.
 */
export function slug(input: unknown): string {
  const trimmed = (input == null ? '' : String(input)).replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, '');
  return trimmed
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
