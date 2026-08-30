import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`ecsite-app が起動しました (port=${env.PORT}, env=${env.NODE_ENV})`);
});

// ECS Fargateがタスクを停止する際、まずSIGTERMを送り一定時間後にSIGKILLする。
// この間に処理中のリクエストを完了させ、DBコネクションを正しく閉じることで
// 「デプロイのたびにリクエストが失敗する」事故を防ぐ(実務での必須対応)。
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} を受信しました。Graceful shutdown を開始します`);

  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Graceful shutdown が完了しました');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Shutdown処理中にエラーが発生しました');
      process.exit(1);
    }
  });

  // 一定時間内にcloseが完了しない場合は強制終了(ハングアップ対策)
  setTimeout(() => {
    logger.error('Graceful shutdownがタイムアウトしました。強制終了します');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
