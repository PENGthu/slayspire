import { defineConfig } from 'vitest/config';

// 构建为单个 JS + CSS，随后由 scripts/inline.mjs 内联成一个可离线游玩的 HTML 文件。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 100_000_000,
  },
  test: {
    environment: 'node',
    // gto-preflop/ 是独立的子项目，有自己的测试
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
