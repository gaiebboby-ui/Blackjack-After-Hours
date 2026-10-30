import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLanguage, setLanguage, t } from '../src/i18n';
import { cardScale, volumePercent } from '../src/preferences';

afterEach(() => vi.unstubAllGlobals());
describe('language preferences', () => {
  it('defaults to Russian only for the Russian region', () => {
    expect(resolveLanguage('auto', 'ru-RU')).toBe('ru');
    expect(resolveLanguage('auto', 'RU-ru')).toBe('ru');
    for (const region of ['ru', 'ru-BY', 'en-RU', 'en-US', 'de-DE']) expect(resolveLanguage('auto', region)).toBe('en');
  });
  it('honours a manual override and translates live copy in both directions', () => {
    expect(resolveLanguage('ru', 'en-US')).toBe('ru');
    expect(resolveLanguage('en', 'ru-RU')).toBe('en');
    vi.stubGlobal('document', { documentElement: { lang: '' } });
    setLanguage('en');
    expect(t('Ваш ход · рука 2 из 3 — ещё карту или хватит?')).toBe('Your turn · hand 2 of 3 — hit or stand?');
    expect(t('Вы выиграли 100 фишек')).toBe('You won 100 chips');
    expect(t('«Хм. На этот раз твоя взяла.»')).toBe('«Hmm. You win this time.»');
    expect(t('Рука 1: туз пик, 11 очков')).toBe('Hand 1: ace of spades, 11 points');
    setLanguage('ru');
    expect(t('Ваш ход')).toBe('Ваш ход');
  });
});
describe('relabelled card scale', () => {
  it('preserves the two requested physical sizes and increases smoothly', () => {
    expect(cardScale(85)).toBeCloseTo(.85);
    expect(cardScale(120)).toBeCloseTo(1);
    expect(cardScale(100)).toBeGreaterThan(cardScale(95));
    expect(cardScale(100)).toBeLessThan(cardScale(105));
  });
});

describe('saved audio levels', () => {
  it('preserves mute and clamps the slider range', () => {
    expect(volumePercent(0)).toBe(0);
    expect(volumePercent(23.7)).toBe(24);
    expect(volumePercent(-5)).toBe(0);
    expect(volumePercent(150)).toBe(100);
  });

  it('uses the previous audio level for missing or malformed saved values', () => {
    for (const value of [undefined, null, NaN, Infinity, '80', {}, false]) {
      expect(volumePercent(value)).toBe(65);
    }
  });
});
