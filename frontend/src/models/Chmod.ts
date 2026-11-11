/** One permission triplet of a Unix mode. */
export interface Rwx {
  read: boolean;
  write: boolean;
  exec: boolean;
}

const CODE_VALUES = { read: 'r', write: 'w', exec: 'x' };
const KEYS = ['owner', 'group', 'others'] as const;

interface Codes {
  owner: Rwx;
  group: Rwx;
  others: Rwx;
}

function rwx(): Rwx {
  return { read: false, write: false, exec: false };
}

function fromCode(input: string | number): Codes | undefined {
  let str = ('' + input).replace(/\s/g, '');
  str = str.length === 10 ? str.substr(1) : str;
  if (!/^[-rwxts]{9}$/.test(str)) {
    return undefined;
  }
  const result = (str.match(/.{1,3}/g) as string[]).map((triplet) => ({
    read: /r/.test(triplet),
    write: /w/.test(triplet),
    exec: /x|t/.test(triplet),
  }));
  return { owner: result[0], group: result[1], others: result[2] };
}

function fromOctal(input: string | number): Codes | undefined {
  let str = ('' + input).replace(/\s/g, '');
  // A four digit value keeps its last three digits, whatever the first one is.
  str = str.length === 4 ? str.substr(1) : str;
  if (!/^[0-7]{3}$/.test(str)) {
    return undefined;
  }
  const result = (str.match(/.{1}/g) as string[]).map((digit) => ({
    read: /[4567]/.test(digit),
    write: /[2367]/.test(digit),
    exec: /[1357]/.test(digit),
  }));
  return { owner: result[0], group: result[1], others: result[2] };
}

/**
 * Unix permissions, parsed from octal (`644`, `0755`) or code notation
 * (`rwxr-xr-x`, `drwxr-xr-x`). Port of the legacy `chmod` service.
 */
export class Chmod {
  owner: Rwx = rwx();
  group: Rwx = rwx();
  others: Rwx = rwx();

  /**
   * Falsy input (including the number `0`) leaves every flag off, as
   * before; anything else that does not parse throws.
   */
  constructor(initValue?: string | number | null) {
    if (initValue) {
      const codes = isNaN(initValue as number) ? fromCode(initValue) : fromOctal(initValue);
      if (!codes) {
        throw new Error('Invalid chmod input data (%s)'.replace('%s', String(initValue)));
      }
      this.owner = codes.owner;
      this.group = codes.group;
      this.others = codes.others;
    }
  }

  /** Code string such as `rwxr-xr-x`. */
  toCode(prepend?: string, append?: string): string {
    const result = KEYS.map((key) => {
      let value = (this[key].read && CODE_VALUES.read) || '-';
      value += (this[key].write && CODE_VALUES.write) || '-';
      value += (this[key].exec && CODE_VALUES.exec) || '-';
      return value;
    });
    return (prepend || '') + result.join('') + (append || '');
  }
}
