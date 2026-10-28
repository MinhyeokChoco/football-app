import { defineConfig } from 'vitest/config';

// 보안 규칙 테스트: `npm run test:rules` (Firestore 에뮬레이터 위에서 실행)
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
