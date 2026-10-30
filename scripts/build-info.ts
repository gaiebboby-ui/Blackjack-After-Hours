export function buildInfo(packageVersion: string, releaseTag?: string, commit?: string) {
  if (releaseTag !== undefined && (releaseTag.trim() !== releaseTag || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(releaseTag))) {
    throw new Error('Release tag must be a stable version such as v1.2.2');
  }
  return {
    version: releaseTag ? releaseTag.slice(1) : packageVersion,
    tag: releaseTag ?? null,
    commit: commit ?? null,
  };
}

export function pagesBasePath(path?: string) {
  if (path === undefined) return './';
  if (path === '' || path === '/') return '/';
  if (!path.startsWith('/') || /[?#\\]/.test(path) || path.split('/').includes('..')) {
    throw new Error('Pages base path must be an absolute URL path');
  }
  return path.replace(/\/+$/, '') + '/';
}
