/**
 * Unit tests: memory merge logic (non-destructive, keep old if new is null).
 */

import { mergeMemory } from '../../src/lib/memoryMerge';

describe('mergeMemory', () => {
  it('merges new keys into existing', () => {
    const existing = { a: 1 };
    const updates = { b: 2 };
    expect(mergeMemory(existing, updates)).toEqual({ a: 1, b: 2 });
  });

  it('overwrites with non-null new value', () => {
    const existing = { a: 1, b: 2 };
    const updates = { a: 10 };
    expect(mergeMemory(existing, updates)).toEqual({ a: 10, b: 2 });
  });

  it('keeps old when new is null', () => {
    const existing = { a: 1, b: 2 };
    const updates = { a: null };
    expect(mergeMemory(existing, updates)).toEqual({ a: 1, b: 2 });
  });

  it('keeps old when new is undefined', () => {
    const existing = { a: 1 };
    const updates = { a: undefined };
    expect(mergeMemory(existing, updates)).toEqual({ a: 1 });
  });

  it('merges nested objects non-destructively', () => {
    const existing = { user: { name: 'Alice', age: 30 } };
    const updates = { user: { age: 31 } };
    expect(mergeMemory(existing, updates)).toEqual({ user: { name: 'Alice', age: 31 } });
  });

  it('does not add key when update value is null', () => {
    const existing = {};
    const updates = { x: null };
    expect(mergeMemory(existing, updates)).toEqual({});
  });
});
