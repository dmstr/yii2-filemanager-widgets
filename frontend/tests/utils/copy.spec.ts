import { describe, expect, it } from 'vitest';
import { deepCopy } from '../../src/utils/copy.ts';

describe('deepCopy', () => {
  it('copies nested structures independently', () => {
    const source = { a: [1, { b: 2 }], d: new Date(5), r: /x/gi };
    const copy = deepCopy(source);
    expect(copy).toEqual(source);
    expect(copy.a).not.toBe(source.a);
    expect(copy.a[1]).not.toBe(source.a[1]);
    expect(copy.d).not.toBe(source.d);
    expect(copy.r).not.toBe(source.r);
    expect(copy.r.flags).toBe('gi');
  });

  it('keeps prototypes and shares functions', () => {
    class Box {
      v = { n: 1 };
      get() {
        return this.v.n;
      }
    }
    const fn = () => 1;
    const copy = deepCopy({ box: new Box(), fn });
    expect(copy.box).toBeInstanceOf(Box);
    expect(copy.box.get()).toBe(1);
    expect(copy.fn).toBe(fn);
  });

  it('preserves cycles', () => {
    const source: { self?: unknown } = {};
    source.self = source;
    const copy = deepCopy(source);
    expect(copy.self).toBe(copy);
  });
});
