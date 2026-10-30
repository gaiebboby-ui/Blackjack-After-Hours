import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';
import { buildInfo, pagesBasePath } from './scripts/build-info';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['APP_', 'PAGES_', 'GITHUB_SHA']);
  const info = buildInfo(pkg.version, env.APP_RELEASE_TAG, env.APP_COMMIT ?? env.GITHUB_SHA);
  return {
    base: pagesBasePath(env.PAGES_BASE_PATH),
    define: { __APP_VERSION__: JSON.stringify(info.version) },
    plugins: [{
      name: 'release-info',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info, null, 2) + '\n' });
      },
    }],
    test: { include: ['tests/**/*.test.ts'] },
    server: { port: 5173, strictPort: true },
    build: { target: 'es2022' },
  };
});
