import { describe, expect, it } from 'vitest';
import { savedHistory, savedSettings } from '../src/saved-state';

describe('untrusted saved data', () => {
  it.each([undefined, null, {}, 42, '[]', true])('recovers from non-array history: %j', value => {
    expect(savedHistory(value)).toEqual([]);
  });
  it('keeps recent numeric outcomes and discards malformed entries', () => {
    expect(savedHistory([1, '1', null, {}, -10, 0, NaN, Infinity])).toEqual([1, -1, 0]);
    expect(savedHistory(Array.from({length: 15}, (_, i) => i))).toHaveLength(12);
  });
  it.each([undefined, null, [], 42, 'settings', false])('rejects non-object settings: %j', value => {
    expect(savedSettings(value)).toEqual({});
  });
  it('preserves existing preference objects', () => {
    expect(savedSettings({sound: true, scale: 100})).toEqual({sound: true, scale: 100});
  });
});
