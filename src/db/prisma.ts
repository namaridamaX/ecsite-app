import { PrismaClient } from '@prisma/client';

// 開発時のホットリロードで PrismaClient が多重生成されるのを防ぐため
// グローバルにキャッシュするパターン(実務でも一般的)
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma__ = prisma;
}
