import { describe, expect, it } from 'vitest';
import { buildInfo, pagesBasePath } from '../scripts/build-info';

describe('release identity and Pages paths', () => {
  it('uses the tag as the deployed version even when package.json is older', () => {
    expect(buildInfo('1.2.1', 'v1.3.0', 'abc123')).toEqual({ version: '1.3.0', tag: 'v1.3.0', commit: 'abc123' });
  });
  it('keeps normal local builds tied to package.json', () => {
    expect(buildInfo('1.2.1')).toEqual({ version: '1.2.1', tag: null, commit: null });
  });
  it.each(['v1.3.0-beta.1', 'main', '1.3.0', 'v01.3.0', '', 'v1.3.0\n'])('rejects an invalid stable release tag: %j', tag => {
    expect(() => buildInfo('1.2.1', tag)).toThrow();
  });
  it('supports local, project Pages, account Pages and custom-domain builds', () => {
    expect(pagesBasePath()).toBe('./');
    expect(pagesBasePath('/BlackJack')).toBe('/BlackJack/');
    expect(pagesBasePath('/BlackJack/')).toBe('/BlackJack/');
    expect(pagesBasePath('')).toBe('/');
    expect(pagesBasePath('/')).toBe('/');
  });
  it.each(['BlackJack', '/a/../b', '/a?b', '/a#b', '/a\\b'])('rejects an unsafe Pages path: %s', path => {
    expect(() => pagesBasePath(path)).toThrow();
  });
});
